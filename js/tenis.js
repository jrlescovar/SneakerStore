import { app, db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,setDoc, 
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const auth = getAuth(app);
const headerCartButtons = document.querySelectorAll(".header-cart-button");
headerCartButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    window.location.href = "carrinho.html";
  });
});

let currentUser = null;
let currentLikes = new Set();
let currentTenis = null;

async function loadUserLikes(user) {
  if (!user) {
    currentLikes = new Set();
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
      await updateDoc(userRef, { likes: arrayRemove(shoeId) });
      currentLikes.delete(shoeId);
      buttonEl.classList.remove("liked");
    } else {
      await updateDoc(userRef, { likes: arrayUnion(shoeId) });
      currentLikes.add(shoeId);
      buttonEl.classList.add("liked");
    }
  } catch (err) {
    console.error("Erro ao atualizar like:", err);
    alert("Não foi possível atualizar os favoritos agora. Tente de novo.");
  }
}


function initSideMenu() {
  const menuButton = document.querySelector('.menu-button');
  const sideMenu = document.querySelector('.side-menu');
  const overlay = document.querySelector('.menu-overlay');

  if (!menuButton || !sideMenu || !overlay) return;

  const openMenu = () => {
    sideMenu.classList.add('side-menu--open');
    overlay.classList.add('menu-overlay--visible');
  };

  const closeMenu = () => {
    sideMenu.classList.remove('side-menu--open');
    overlay.classList.remove('menu-overlay--visible');
  };

  menuButton.addEventListener('click', openMenu);
  overlay.addEventListener('click', closeMenu);

  const sideFilters = sideMenu.querySelectorAll('.side-menu-filter');
  sideFilters.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const filter = link.dataset.filter || 'ALL';
      window.location.href = `index.html?cat=${encodeURIComponent(filter)}`;
    });
  });

  const sideStyles = sideMenu.querySelectorAll('.side-menu-style');
  sideStyles.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const style = link.dataset.style || 'ALL';
      window.location.href = `index.html?style=${encodeURIComponent(style)}`;
    });
  });
}

function initSizeGuideModal() {
  const btn = document.querySelector('.product-size-guide');
  const modal = document.getElementById('size-guide-modal');
  const backdrop = document.getElementById('size-guide-backdrop');
  const closeBtn = document.getElementById('size-guide-close');

  if (!btn || !modal) return;

  const open = () => modal.classList.add('size-guide-modal--open');
  const close = () => modal.classList.remove('size-guide-modal--open');

  btn.addEventListener('click', open);
  if (backdrop) backdrop.addEventListener('click', close);
  if (closeBtn) closeBtn.addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      close();
    }
  });
}
function initCartSuccessModal() {
  const modal = document.getElementById("cart-success-modal");
  if (!modal) return;

  const backdrop = document.getElementById("cart-success-backdrop");
  const closeBtn = document.getElementById("cart-success-close");
  const continueBtn = document.getElementById("cart-success-continue");
  const viewCartBtn = document.getElementById("cart-success-view-cart");

  const close = () => modal.classList.remove("cart-success-modal--open");

  backdrop?.addEventListener("click", close);
  closeBtn?.addEventListener("click", close);
  continueBtn?.addEventListener("click", close);
  viewCartBtn?.addEventListener("click", () => {
    window.location.href = "carrinho.html";
  });
}

function openCartSuccessModal({ tenis, tamanho, precoUnitario }) {
  const modal = document.getElementById("cart-success-modal");
  if (!modal) return;

  const imgEl = document.getElementById("cart-success-img");
  const nameEl = document.getElementById("cart-success-name");
  const sizeEl = document.getElementById("cart-success-size");
  const priceEl = document.getElementById("cart-success-price");

  if (imgEl) imgEl.src = tenis.foto1 || "";
  if (nameEl) nameEl.textContent = tenis.nome || "";
  if (sizeEl) sizeEl.textContent = tamanho;
  if (priceEl) priceEl.textContent = formatarMoeda(precoUnitario || 0);

  modal.classList.add("cart-success-modal--open");
}

async function handleAddToCart(tenis, tamanhoSelecionado, precoPrincipal) {
  if (!currentUser) {
    alert("Faça login para adicionar itens ao carrinho :)");
    return;
  }

  try {
    const tenisRef = doc(db, "tenis", tenis.id);
    const tenisSnap = await getDoc(tenisRef);
    const tenisData = tenisSnap.exists() ? tenisSnap.data() : tenis;
    const estoque = tenisData.estoque || {};
    const disponivel = Number(estoque[tamanhoSelecionado]) || 0;

    if (disponivel <= 0) {
      alert(`Sem estoque no momento para o tamanho ${tamanhoSelecionado}.`);
      return;
    }

    const cartRef = doc(db, "carrinhos", currentUser.uid);
    const cartSnap = await getDoc(cartRef);
    let items = [];

    if (cartSnap.exists()) {
      items = cartSnap.data().items || [];
    }

    const idx = items.findIndex(
      (item) =>
        item.tenisId === tenis.id && item.tamanho === tamanhoSelecionado
    );

    let qtdJaNoCarrinho = 0;
    if (idx !== -1) {
      qtdJaNoCarrinho = items[idx].quantidade || 0;
    }

    if (qtdJaNoCarrinho + 1 > disponivel) {
      alert(`Sem estoque no momento para o tamanho ${tamanhoSelecionado}.`);
      return;
    }

    if (idx === -1) {
      items.push({
        tenisId: tenis.id,
        nome: tenis.nome,
        foto: tenis.foto1 || "",
        tamanho: tamanhoSelecionado,
        quantidade: 1,
        precoUnitario: precoPrincipal,
        valorOriginal: tenis.valorOriginal ?? null,
      });
    } else {
      items[idx].quantidade += 1;
    }

    await setDoc(
      cartRef,
      {
        uid: currentUser.uid,
        items,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    openCartSuccessModal({
      tenis,
      tamanho: tamanhoSelecionado,
      precoUnitario: precoPrincipal,
    });
  } catch (err) {
    console.error("Erro ao adicionar ao carrinho:", err);
    alert("Não foi possível adicionar ao carrinho agora. Tente de novo.");
  }
}

function formatarMoeda(valor) {
  const n = Number(valor);
  if (Number.isNaN(n)) return 'R$ 0,00';
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function labelCategoria(categoria) {
  if (!categoria) return '';
  const c = categoria.toUpperCase();
  if (c === 'HOMEM') return 'Homem';
  if (c === 'MULHER') return 'Mulher';
  if (c === 'UNISSEX') return 'Unissex';
  return categoria;
}

function labelEstilo(preDescricao) {
  if (!preDescricao) return '';
  return preDescricao;
}

function montarPaginaTenis(tenis) {
  const mainImgEl = document.getElementById('produto-img-principal');
  const thumbsEl = document.getElementById('produto-thumbs');
  const titleEl = document.getElementById('product-title');
  const tagEl = document.getElementById('product-tag');
  const breadcrumbCatEl = document.getElementById('breadcrumb-category');
  const pricePromoEl = document.getElementById('product-price-promo');
  const priceOriginalEl = document.getElementById('product-price-original');
  const installmentsEl = document.getElementById('product-installments');
  const sizesGridEl = document.getElementById('product-sizes-grid');
  const ctaBtn = document.getElementById('product-cta-button');
  const descEl = document.getElementById('product-description');

  if (!tenis) {
    window.location.href = 'index.html';
    return;
  }

  titleEl.textContent = tenis.nome || 'Tênis DP Shoes';

  const catLabel = labelCategoria(tenis.categoria);
  const estiloLabel = labelEstilo(tenis.preDescricao);

  const tagParts = [];
  if (catLabel) tagParts.push(catLabel);
  if (estiloLabel) tagParts.push(estiloLabel);
  tagEl.textContent = tagParts.join(' • ') || 'Tênis';

  breadcrumbCatEl.textContent = catLabel || 'Tênis';

  descEl.textContent =
    tenis.descricao ||
    `Modelo ${tenis.nome || ''}. Estilo: ${estiloLabel || 'clássico'}.`;

  const promo = tenis.valorPromocao ?? tenis.valorPromocao === 0
    ? Number(tenis.valorPromocao)
    : undefined;
  const original = tenis.valorOriginal ?? tenis.valorOriginal === 0
    ? Number(tenis.valorOriginal)
    : undefined;

  const precoPrincipal = !Number.isNaN(promo) && promo > 0
    ? promo
    : original;

  pricePromoEl.textContent = formatarMoeda(precoPrincipal || 0);

  if (original && promo && original > promo) {
    priceOriginalEl.style.display = 'inline';
    priceOriginalEl.textContent = formatarMoeda(original);
  } else {
    priceOriginalEl.style.display = 'none';
  }



  const parcelas = 2;
  installmentsEl.textContent = `Até ${parcelas}x de ${formatarMoeda(
    precoPrincipal / parcelas
  )} sem juros`;


  const imagens = [tenis.foto1, tenis.foto2, tenis.foto3, tenis.foto4].filter(
    (url) => !!url
  );

  thumbsEl.innerHTML = '';

  if (imagens.length === 0) {
    mainImgEl.src = '';
    thumbsEl.style.display = 'none';
  } else if (imagens.length === 1) {
    mainImgEl.src = imagens[0];
    thumbsEl.style.display = 'none';
  } else {
    mainImgEl.src = imagens[0];
    thumbsEl.style.display = ''; 

    imagens.forEach((url, index) => {
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className =
        'product-thumb' + (index === 0 ? ' product-thumb--active' : '');
      thumb.innerHTML = `<img src="${url}" alt="${tenis.nome}" loading="lazy" />`;

      thumb.addEventListener('click', () => {
        mainImgEl.src = url;
        document
          .querySelectorAll('.product-thumb')
          .forEach((el) => el.classList.remove('product-thumb--active'));
        thumb.classList.add('product-thumb--active');
      });

      thumbsEl.appendChild(thumb);
    });
  }


  const estoque = tenis.estoque || {};
  const tamanhos = Object.keys(estoque)
    .map((t) => t.trim())
    .filter((t) => t !== '')
    .sort((a, b) => Number(a) - Number(b));

  let tamanhoSelecionado = null;

  sizesGridEl.innerHTML = '';
  tamanhos.forEach((tamanho) => {
    const qtd = Number(estoque[tamanho]) || 0;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'size-option';
    btn.textContent = tamanho;

    if (qtd <= 0) {
      btn.classList.add('size-option--disabled');
    } else {
      btn.addEventListener('click', () => {
        document
          .querySelectorAll('.size-option')
          .forEach((el) => el.classList.remove('size-option--selected'));
        btn.classList.add('size-option--selected');
        tamanhoSelecionado = tamanho;
        ctaBtn.disabled = false;
        ctaBtn.textContent = 'Adicionar ao carrinho';
      });
    }

    sizesGridEl.appendChild(btn);
  });


  ctaBtn.addEventListener("click", async () => {
    if (!tamanhoSelecionado) return;
    await handleAddToCart(tenis, tamanhoSelecionado, precoPrincipal);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initSideMenu();
  initSizeGuideModal();
      initCartSuccessModal(); 
  const salvo = localStorage.getItem('dpTenisSelecionado');
  const tenis = salvo ? JSON.parse(salvo) : null;
  currentTenis = tenis;

  montarPaginaTenis(tenis);

  const bottomBtn = document.getElementById('product-bottom-button');
  if (bottomBtn) {
    bottomBtn.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }

  const wishlistBtn = document.querySelector('.product-wishlist-button');

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    await loadUserLikes(user);

    if (!wishlistBtn || !currentTenis || !currentTenis.id) return;

    if (currentLikes.has(currentTenis.id)) {
      wishlistBtn.classList.add('liked');
    }

    wishlistBtn.addEventListener('click', () => {
      toggleLike(currentTenis.id, wishlistBtn);
    });
  });
});
