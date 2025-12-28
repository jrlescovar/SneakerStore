import { app, db } from "./firebase-config.js";

import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const tabs = document.querySelectorAll(".products-tab");
const styleTabs = document.querySelectorAll(".products-subfilter");
const headerCartButtons = document.querySelectorAll(".header-cart-button");
headerCartButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    window.location.href = "carrinho.html";
  });
});

const grid = document.querySelector(".products-grid");

const sideMenuLinks = document.querySelectorAll(".side-menu-filter");
const menuButton = document.querySelector(".menu-button");
const sideMenu = document.querySelector(".side-menu");
const menuOverlay = document.querySelector(".menu-overlay");
const productsSection = document.querySelector(".products-section");
const sideMenuStyleLinks = document.querySelectorAll(".side-menu-style");
const productsHeader = document.querySelector(".products-header");
const mainHeader = document.querySelector(".main-header");
document.body.style.overflow = "auto";

function openMenu() {
  if (!sideMenu || !menuOverlay) return;
  sideMenu.classList.add("side-menu--open");
  menuOverlay.classList.add("menu-overlay--visible");
}

function closeMenu() {
  if (!sideMenu || !menuOverlay) return;
  sideMenu.classList.remove("side-menu--open");
  menuOverlay.classList.remove("menu-overlay--visible");
  document.body.style.overflow = "auto";
}
function scrollToProducts() {
  const target = productsHeader || productsSection;
  if (!target) return;

  const headerHeight = mainHeader ? mainHeader.offsetHeight : 0;
  const rect = target.getBoundingClientRect();
  const targetY = rect.top + window.scrollY - headerHeight - 8;

  if (window.scrollY >= targetY - 10) {
    return;
  }

  window.scrollTo({
    top: targetY,
    behavior: "smooth",
  });
}


function toggleMenu() {
  if (!sideMenu) return;
  const isOpen = sideMenu.classList.contains("side-menu--open");
  if (isOpen) {
    closeMenu();
  } else {
    openMenu();
  }
}

if (menuButton) {
  menuButton.addEventListener("click", (event) => {
    event.preventDefault(); 
    toggleMenu();
  });
}

if (menuOverlay) {
  menuOverlay.addEventListener("click", () => {
    closeMenu();
  });
}


const paginationEl = document.querySelector(".products-pagination");
const prevBtn = document.querySelector(".pagination-prev");
const nextBtn = document.querySelector(".pagination-next");
const pageLabelEl = document.querySelector(".pagination-label");
const barFillEl = document.querySelector(".pagination-bar-fill");

let allShoes = [];
let activeCategory = "ALL";
let activeStyle = "ALL";
function applyInitialFiltersFromURL() {
  const params = new URLSearchParams(window.location.search);
  const catParam = params.get("cat");
  const styleParam = params.get("style");

  if (catParam) {
    activeCategory = catParam.toUpperCase();

    // Atualiza visual das tabs principais
    tabs.forEach((t) => t.classList.remove("products-tab--active"));
    const tabToActivate = document.querySelector(
      `.products-tab[data-filter="${activeCategory}"]`
    );
    if (tabToActivate) {
      tabToActivate.classList.add("products-tab--active");
    }
  }

  if (styleParam) {
    activeStyle = styleParam.toUpperCase();

    styleTabs.forEach((b) =>
      b.classList.remove("products-subfilter--active")
    );
    const styleTabToActivate = document.querySelector(
      `.products-subfilter[data-style="${activeStyle}"]`
    );
    if (styleTabToActivate) {
      styleTabToActivate.classList.add("products-subfilter--active");
    }
  }

  if (catParam || styleParam) {
    scrollToProducts();
  }
}

const PAGE_SIZE = 8; 
let currentPage = 1;

const auth = getAuth(app);
let currentUser = null;
let currentLikes = new Set();

function formatPrice(value) {
  if (value == null) return "";
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function matchesCategory(shoe, category) {
  const cat = (shoe.categoria || "").toUpperCase();

  if (category === "ALL") return true;

  if (category === "HOMEM") {
    return cat === "HOMEM" || cat === "UNISSEX";
  }
  if (category === "MULHER") {
    return cat === "MULHER" || cat === "UNISSEX";
  }

  return true;
}

function matchesStyle(shoe, style) {
  if (style === "ALL") return true;

  const pre = (shoe.preDescricao || "").toUpperCase();

  if (style === "CASUAL") {
    return pre.includes("CASUAL");
  }
  if (style === "TREINO") {
    return pre.includes("TREINO") || pre.includes("ACADEMIA");
  }
  if (style === "CORRIDA") {
    return pre.includes("CORRIDA");
  }

  return true;
}

function filterShoes(category, style) {
  let base = allShoes;
  if (category === "FAVORITOS") {
    base = allShoes.filter((shoe) => currentLikes.has(shoe.id));
  }

  return base.filter(
    (shoe) => matchesCategory(shoe, category) && matchesStyle(shoe, style)
  );
}


function updatePagination(totalItems) {
  if (!paginationEl) return;

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  if (totalPages <= 1) {
    paginationEl.style.display = "none";
    return;
  }

  paginationEl.style.display = "flex";

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  if (pageLabelEl) {
    pageLabelEl.textContent = `Página ${currentPage} de ${totalPages}`;
  }

  if (barFillEl) {
    const percent = (currentPage / totalPages) * 100;
    barFillEl.style.width = `${percent}%`;
  }

  if (prevBtn) {
    prevBtn.disabled = currentPage === 1;
    prevBtn.style.visibility = currentPage === 1 ? "hidden" : "visible";
  }

  if (nextBtn) {
    const totalPagesCalc = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    nextBtn.disabled = currentPage === totalPagesCalc;
    nextBtn.style.visibility =
      currentPage === totalPagesCalc ? "hidden" : "visible";
  }
}

// ===== LIKES =====
async function loadUserLikes(user) {
  if (!user) {
    currentLikes = new Set();
    renderGrid();
    return;
  }

  try {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    const data = snap.exists() ? snap.data() : {};
    const likesArray = Array.isArray(data.likes) ? data.likes : [];
    currentLikes = new Set(likesArray);
  } catch (err) {
    console.error("Erro ao carregar likes do usuário:", err);
    currentLikes = new Set();
  }

  renderGrid();
}

async function toggleLike(shoeId, buttonEl) {
  if (!currentUser) {
    alert("Faça login para favoritar seus tênis :)");
    return;
  }

  const userRef = doc(db, "users", currentUser.uid);
  const alreadyLiked = currentLikes.has(shoeId);

  try {
    if (alreadyLiked) {
      await updateDoc(userRef, {
        likes: arrayRemove(shoeId),
      });
      currentLikes.delete(shoeId);
      buttonEl.classList.remove("liked");
    } else {
      await updateDoc(userRef, {
        likes: arrayUnion(shoeId),
      });
      currentLikes.add(shoeId);
      buttonEl.classList.add("liked");
    }
  } catch (err) {
    console.error("Erro ao atualizar like:", err);
    alert("Não foi possível atualizar os favoritos agora. Tente de novo.");
  }
}
function renderGrid() {
  if (!grid) return;

    const shoes = filterShoes(activeCategory, activeStyle);
  grid.innerHTML = "";

  updatePagination(shoes.length);

  if (!shoes.length) {
    let msg = "Sem tênis disponíveis para os filtros aplicados.";

    if (activeCategory === "FAVORITOS") {
      if (!currentLikes.size) {
        msg = "Você ainda não favoritou nenhum tênis.";
      } else {
        msg = "Nenhum tênis favorito encontrado para esses filtros.";
      }
    }

    grid.innerHTML = `
      <p style="grid-column: 1/-1; padding: 8px 4px; font-size: 0.9rem;">
        ${msg}
      </p>`;
    return;
  }


  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageShoes = shoes.slice(startIndex, startIndex + PAGE_SIZE);

  pageShoes.forEach((shoe) => {
    const card = document.createElement("article");
    card.className = "product-card";

    const nome = shoe.nome || "Tênis sem nome";
    const preDescricao = shoe.preDescricao || "";
    const imgUrl = shoe.foto1 || "";

    const original = shoe.valorOriginal ?? shoe.valorPromocao ?? 0;
    const promo = shoe.valorPromocao;

    const hasPromo =
      promo != null && promo !== 0 && original != null && promo < original;

    let priceHtml = "";

    if (hasPromo) {
      priceHtml = `
        <span class="product-price-original">${formatPrice(original)}</span>
        <span class="product-price-promo">${formatPrice(promo)}</span>
      `;
    } else {
      priceHtml = `
        <span class="product-price-promo">${formatPrice(
          original || promo || 0
        )}</span>
      `;
    }

    card.innerHTML = `
      <div class="product-image">
        <button class="product-fav icon-button" type="button">
          <span class="material-symbols-outlined">favorite</span>
        </button>
        ${imgUrl ? `<img src="${imgUrl}" alt="${nome}">` : ""}
      </div>
      <div class="product-info">
        <p class="product-price">
          ${priceHtml}
        </p>
        <p class="product-name">${nome}</p>
        <p class="product-category">${preDescricao}</p>
      </div>
    `;

    card.addEventListener("click", () => {
      localStorage.setItem("dpTenisSelecionado", JSON.stringify(shoe));
      window.location.href = "tenis.html";
    });

    const favBtn = card.querySelector(".product-fav");
    if (currentLikes.has(shoe.id)) {
      favBtn.classList.add("liked");
    }

    favBtn.addEventListener("click", (ev) => {
      ev.stopPropagation(); 
      toggleLike(shoe.id, favBtn);
    });

    grid.appendChild(card);
  });
}


async function loadShoes() {
  try {
    const tenisRef = collection(db, "tenis");
    const q = query(tenisRef, orderBy("prioridade", "asc"));
    const snap = await getDocs(q);

    allShoes = snap.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }))
      .sort((a, b) => {
        const pa = a.prioridade ?? 9999;
        const pb = b.prioridade ?? 9999;
        if (pa !== pb) return pa - pb;
        return (a.nome || "").localeCompare(b.nome || "");
      });

    currentPage = 1;
    renderGrid();
  } catch (err) {
    console.error("Erro ao carregar tênis:", err);
    if (grid) {
      grid.innerHTML =
        '<p style="grid-column: 1/-1; padding: 8px 4px; font-size: 0.9rem;">Erro ao carregar produtos.</p>';
    }
  }
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("products-tab--active"));
    tab.classList.add("products-tab--active");

    activeCategory = tab.dataset.filter || "ALL";
    currentPage = 1;
    renderGrid();
  });
});

sideMenuLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();

    const filter = (link.dataset.filter || "ALL").toUpperCase();
    const isIndexPage = !!document.querySelector(".products-section");

    if (isIndexPage) {
      const targetTab = document.querySelector(
        `.products-tab[data-filter="${filter}"]`
      );

      if (targetTab) {
        targetTab.click();
      }

      closeMenu();
      scrollToProducts();
    } else {
      if (filter && filter !== "ALL") {
        window.location.href = `index.html?cat=${encodeURIComponent(filter)}`;
      } else {
        window.location.href = "index.html";
      }
    }
  });
});
sideMenuStyleLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();

    const style = link.dataset.style || "ALL";
    const isIndexPage = !!document.querySelector(".products-section");

    if (isIndexPage) {
      const targetStyleTab = document.querySelector(
        `.products-subfilter[data-style="${style}"]`
      );

      if (targetStyleTab) {
        targetStyleTab.click(); 
      }

      closeMenu();
      scrollToProducts();
    } else {
      if (style && style !== "ALL") {
        window.location.href = `index.html?style=${encodeURIComponent(style)}`;
      } else {
        window.location.href = "index.html";
      }
    }
  });
});



styleTabs.forEach((button) => {
  button.addEventListener("click", () => {
    styleTabs.forEach((b) =>
      b.classList.remove("products-subfilter--active")
    );
    button.classList.add("products-subfilter--active");

    activeStyle = button.dataset.style || "ALL";
    currentPage = 1;
    renderGrid();
  });
});

if (prevBtn) {
  prevBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderGrid();
    }
  });
}

if (nextBtn) {
  nextBtn.addEventListener("click", () => {
    currentPage++;
    renderGrid();
  });
}

applyInitialFiltersFromURL();

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  loadUserLikes(user);
});

loadShoes();
