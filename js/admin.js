// js/admin.js
import { app, db } from "./firebase-config.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithRedirect,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const ADMIN_EMAILS = ["seuEmail@gmail.com"];
const isAdminEmail = (email) => ADMIN_EMAILS.includes((email || "").toLowerCase());

const adminUserLabel = document.getElementById("admin-user-label");
const adminLogoutBtn = document.getElementById("admin-logout-btn");
const adminBlocked = document.getElementById("admin-blocked");
const adminGoLogin = document.getElementById("admin-go-login");

const form = document.getElementById("shoe-form");
const formTitle = document.getElementById("form-title");
const newShoeBtn = document.getElementById("new-shoe-btn");
const shoesListEl = document.getElementById("shoes-list");

const fieldId = document.getElementById("shoe-id");
const fieldNome = document.getElementById("nome");
const fieldValorOriginal = document.getElementById("valorOriginal");
const fieldValorPromocao = document.getElementById("valorPromocao");
const fieldCategoria = document.getElementById("categoria");
const fieldPreDescricao = document.getElementById("preDescricao");
const fieldFoto1 = document.getElementById("foto1");
const fieldFoto2 = document.getElementById("foto2");
const fieldFoto3 = document.getElementById("foto3");
const fieldFoto4 = document.getElementById("foto4");
const sizesGrid = document.getElementById("sizes-grid");
const fieldPrioridade = document.getElementById("prioridade"); 


const tamanhos = ["34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44"];

function createSizeInputs() {
  sizesGrid.innerHTML = "";
  tamanhos.forEach((t) => {
    const item = document.createElement("div");
    item.className = "size-item";
    item.innerHTML = `
      <div class="size-label">Tam. ${t}</div>
      <div class="size-controls">
        <button type="button" data-size="${t}" data-delta="-1">-</button>
        <input type="number" id="size-${t}" min="0" value="0" />
        <button type="button" data-size="${t}" data-delta="1">+</button>
      </div>
    `;
    sizesGrid.appendChild(item);
  });

  // eventos dos botões + e -
  sizesGrid.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-size]");
    if (!btn) return;
    const size = btn.dataset.size;
    const delta = Number(btn.dataset.delta);
    const input = document.getElementById(`size-${size}`);
    const current = Number(input.value || 0);
    const next = Math.max(0, current + delta);
    input.value = next;
  });
}

createSizeInputs();

// helpers para ler/gravar estoque do form
function getEstoqueFromForm() {
  const estoque = {};
  tamanhos.forEach((t) => {
    const input = document.getElementById(`size-${t}`);
    estoque[t] = Number(input.value || 0);
  });
  return estoque;
}

function setEstoqueToForm(estoque = {}) {
  tamanhos.forEach((t) => {
    const input = document.getElementById(`size-${t}`);
    input.value = estoque[t] != null ? estoque[t] : 0;
  });
}

function resetForm() {
  fieldId.value = "";
  formTitle.textContent = "Adicionar novo tênis";
  form.reset();
  setEstoqueToForm({});
  fieldPrioridade.value = 1; // padrão: prioridade 1
}


newShoeBtn.addEventListener("click", (e) => {
  e.preventDefault();
  resetForm();
});

// submit (salvar)
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    nome: fieldNome.value.trim(),
    valorOriginal: Number(fieldValorOriginal.value || 0),
    valorPromocao: Number(fieldValorPromocao.value || 0),
    categoria: fieldCategoria.value,
    preDescricao: fieldPreDescricao.value,
    foto1: fieldFoto1.value.trim(),
    foto2: fieldFoto2.value.trim(),
    foto3: fieldFoto3.value.trim(),
    foto4: fieldFoto4.value.trim(),
    estoque: getEstoqueFromForm(),
    prioridade: Number(fieldPrioridade.value || 0), 
    atualizadoEm: new Date().toISOString(),
  };

  if (!data.nome) {
    alert("Preencha o nome do tênis.");
    return;
  }

  try {
    if (fieldId.value) {
      const ref = doc(db, "tenis", fieldId.value);
      await updateDoc(ref, data);
      alert("Tênis atualizado com sucesso!");
    } else {
      data.criadoEm = new Date().toISOString();
      await addDoc(collection(db, "tenis"), data);
      alert("Tênis criado com sucesso!");
    }
    resetForm();
  } catch (err) {
    console.error(err);
    alert("Erro ao salvar tênis.");
  }
});

function renderShoesList(snapshot) {
  shoesListEl.innerHTML = "";

  const docs = snapshot.docs
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

  docs.forEach((d) => {
    const card = document.createElement("div");
    card.className = "admin-shoe-card";
    card.dataset.id = d.id;
    card.innerHTML = `
      <div class="admin-shoe-name">${d.nome || "(sem nome)"}</div>
      <div class="admin-shoe-meta">
        ${d.categoria || "-"} · ${d.preDescricao || "-"}<br/>
        R$ ${Number(d.valorPromocao || d.valorOriginal || 0).toFixed(2)}
      </div>
    `;
    shoesListEl.appendChild(card);
  });
}


shoesListEl.addEventListener("click", async (e) => {
  const card = e.target.closest(".admin-shoe-card");
  if (!card) return;

  const id = card.dataset.id;
  const ref = doc(db, "tenis", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const d = snap.data();

  fieldId.value = id;
  formTitle.textContent = "Editar tênis";
  fieldNome.value = d.nome || "";
  fieldValorOriginal.value = d.valorOriginal != null ? d.valorOriginal : "";
  fieldValorPromocao.value = d.valorPromocao != null ? d.valorPromocao : "";
  fieldCategoria.value = d.categoria || "HOMEM";
fieldPreDescricao.value = d.preDescricao || "Casual";
fieldPrioridade.value = d.prioridade != null ? d.prioridade : 1; 
  fieldFoto1.value = d.foto1 || "";
  fieldFoto2.value = d.foto2 || "";
  fieldFoto3.value = d.foto3 || "";
  fieldFoto4.value = d.foto4 || "";
  setEstoqueToForm(d.estoque || {});
});


adminLogoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

adminGoLogin.addEventListener("click", () => {
  window.location.href = "index.html";
});

onAuthStateChanged(auth, (user) => {
const isAdmin = user && isAdminEmail(user.email);

  if (!user || !isAdmin) {
    adminBlocked.classList.remove("hidden");
    adminUserLabel.textContent = "Não autenticado como admin";
    return;
  }

  adminBlocked.classList.add("hidden");
  adminUserLabel.textContent = `Admin: ${user.email}`;


  const tenisRef = collection(db, "tenis");

onSnapshot(tenisRef, (snapshot) => {
  const docs = snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      prioridade: Number(data.prioridade || 9999),
    };
  });

  docs.sort((a, b) => {
    if (a.prioridade !== b.prioridade) {
      return a.prioridade - b.prioridade;
    }
    return (a.nome || "").localeCompare(b.nome || "");
  });

  // renderiza a lista
  const shoesListEl = document.getElementById("shoes-list");
  shoesListEl.innerHTML = "";

  docs.forEach((d) => {
    const card = document.createElement("div");
    card.className = "admin-shoe-card";
    card.dataset.id = d.id;
    card.innerHTML = `
      <div class="admin-shoe-name">${d.nome || "(sem nome)"}</div>
      <div class="admin-shoe-meta">
        ${d.categoria || "-"} · ${d.preDescricao || "-"}<br/>
        R$ ${Number(d.valorPromocao || d.valorOriginal || 0).toFixed(2)}
      </div>
    `;
    shoesListEl.appendChild(card);
  });
});


});

onAuthStateChanged(auth, (user) => {
  if (!user) {
  }
});
