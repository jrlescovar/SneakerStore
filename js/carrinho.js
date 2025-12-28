import { app, db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const auth = getAuth(app);

const itemsContainer = document.getElementById("cart-items");
const subtotalEl = document.getElementById("cart-subtotal");
const shippingEl = document.getElementById("cart-shipping");
const totalEl = document.getElementById("cart-total");
const stockWarningEl = document.getElementById("cart-stock-warning");
const checkoutBtn = document.getElementById("cart-checkout-button");
const installmentsEl = document.getElementById("cart-installments");

function formatPrice(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

async function loadCart(user) {
  if (!user) {
    itemsContainer.innerHTML =
        '<p class="cart-empty">Faça login para ver seu carrinho.</p>';
    checkoutBtn.disabled = true;
    subtotalEl.textContent = formatPrice(0);
    shippingEl.textContent = formatPrice(0);
    totalEl.textContent = formatPrice(0);
    if (installmentsEl) installmentsEl.textContent = "";
    checkoutBtn.disabled = true;
    return;
    }


  const cartRef = doc(db, "carrinhos", user.uid);
  const cartSnap = await getDoc(cartRef);

if (!cartSnap.exists() || !cartSnap.data().items?.length) {
    itemsContainer.innerHTML =
        '<p class="cart-empty">Seu carrinho está vazio.</p>';
    subtotalEl.textContent = formatPrice(0);
    shippingEl.textContent = formatPrice(0);
    totalEl.textContent = formatPrice(0);
    if (installmentsEl) installmentsEl.textContent = "";
    checkoutBtn.disabled = true;
    return;
    }


  const items = cartSnap.data().items;
  itemsContainer.innerHTML = "";

  let subtotal = 0;
  let canFinalize = true;
  stockWarningEl.textContent = "";

  for (const item of items) {
    const quantidade = item.quantidade || 1;
    const precoUnitario = item.precoUnitario || 0;
    subtotal += quantidade * precoUnitario;

    // checa estoque atual
    let estoqueOk = true;
    try {
      if (item.tenisId && item.tamanho) {
        const tenisRef = doc(db, "tenis", item.tenisId);
        const tenisSnap = await getDoc(tenisRef);
        if (tenisSnap.exists()) {
          const estoque = tenisSnap.data().estoque || {};
          const disponivel = Number(estoque[item.tamanho]) || 0;
          if (disponivel < quantidade) {
            estoqueOk = false;
          }
        }
      }
    } catch (e) {
      console.error("Erro verificando estoque:", e);
    }

    if (!estoqueOk) {
      canFinalize = false;
    }

    const line = document.createElement("article");
    line.className = "cart-item";
    if (!estoqueOk) line.classList.add("cart-item--no-stock");

    line.innerHTML = `
      <div class="cart-item-image">
        ${item.foto ? `<img src="${item.foto}" alt="${item.nome || ""}">` : ""}
      </div>
      <div class="cart-item-info">
        <p class="cart-item-name">${item.nome || "Tênis"}</p>
        <p class="cart-item-size">Tamanho: ${item.tamanho || "-"}</p>
        <p class="cart-item-qty">Quantidade: ${quantidade}</p>
        <p class="cart-item-price">${formatPrice(precoUnitario)}</p>
        ${
          !estoqueOk
            ? '<p class="cart-item-stock-msg">Sem estoque no momento para este tamanho.</p>'
            : ""
        }
      </div>
      <button class="cart-item-remove" type="button" aria-label="Remover">
        <span class="material-symbols-outlined">close</span>
      </button>
    `;

    const removeBtn = line.querySelector(".cart-item-remove");
    removeBtn.addEventListener("click", async () => {
      const newItems = items.filter(
        (i) => !(i.tenisId === item.tenisId && i.tamanho === item.tamanho)
      );
      await setDoc(
        cartRef,
        { uid: user.uid, items: newItems, updatedAt: new Date() },
        { merge: true }
      );
      loadCart(user);
    });

    itemsContainer.appendChild(line);
  }

    const shipping = 0;
  const total = subtotal + shipping; 

  subtotalEl.textContent = formatPrice(subtotal);
  shippingEl.textContent = formatPrice(shipping);
  totalEl.textContent = formatPrice(total);

  if (installmentsEl) {
    if (total > 0) {
      const parcela = total / 2;
      installmentsEl.textContent = `ou 2x de ${formatPrice(
        parcela
      )} sem juros`;
    } else {
      installmentsEl.textContent = "";
    }
  }

  if (!canFinalize) {
    stockWarningEl.textContent =
      "Alguns produtos estão sem estoque no momento. Remova-os para continuar.";
  }

  checkoutBtn.disabled = !canFinalize;
    checkoutBtn.onclick = () => {
    if (checkoutBtn.disabled) return;

    const numeroWhats = "5518997621499";

    let mensagem = `🛒 *Pedido nome da loja aqui*%0A%0A`;

    items.forEach((item, index) => {
      const nome = item.nome || "Tênis";
      const tamanho = item.tamanho || "-";
      const qtd = item.quantidade || 1;
      const preco = item.precoUnitario || 0;
      const totalItem = qtd * preco;

      mensagem += `*${index + 1})* ${nome}%0A`;
      mensagem += `Tamanho: ${tamanho}%0A`;
      mensagem += `Qtd: ${qtd}%0A`;
      mensagem += `Valor: ${formatPrice(totalItem)}%0A%0A`;
    });

    mensagem += `💰 *Total:* ${formatPrice(total)}%0A`;
    mensagem += `📌 Parcelado: 2x de ${formatPrice(total / 2)} sem juros%0A%0A`;
    mensagem += `Quero finalizar meu pedido ✅`;

    const url = `https://wa.me/${numeroWhats}?text=${mensagem}`;
    window.open(url, "_blank");
  };

}

const headerCartButtons = document.querySelectorAll(".header-cart-button");
headerCartButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    window.location.href = "carrinho.html";
  });
});

onAuthStateChanged(auth, (user) => {
  loadCart(user);
});
