// js/auth.js
import { app, db } from "./firebase-config.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const ADMIN_EMAILS = ["SEUEMAILQUALQUERAQUI@gmail.com"];
const isAdminEmail = (email) => ADMIN_EMAILS.includes((email || "").toLowerCase());

const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });
getRedirectResult(auth)
  .then((result) => {
    if (!result || !result.user) return;

    const user = result.user;
    const isAdmin = isAdminEmail(user.email);

    alert(
      isAdmin
        ? `Bem-vindo, admin ${user.displayName || user.email}!`
        : `Bem-vindo, ${user.displayName || user.email}!`
    );
  })
  .catch((err) => {
    console.error("Erro em getRedirectResult:", err);
    if (err.code === "auth/no-auth-event") return;
  });
const profileButton = document.getElementById("profile-button");
const menuToggle = document.getElementById("menu-toggle");

let scrollPosition = 0;
function updateBodyScrollLock() {
  if (menuToggle && menuToggle.checked) {
    scrollPosition = window.scrollY || window.pageYOffset;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollPosition}px`;
    document.body.style.width = "100%";
  } else {
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    window.scrollTo(0, scrollPosition);
  }
}
menuToggle?.addEventListener("change", updateBodyScrollLock);
updateBodyScrollLock();

const sideGreeting = document.getElementById("side-profile-greeting");
const sideAction = document.getElementById("side-profile-action");
const sideAvatar = document.getElementById("side-profile-avatar");
const sideAvatarImg = document.getElementById("side-profile-avatar-img");
const adminSection = document.getElementById("admin-section");



async function ensureUserDoc(user) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const isAdmin = isAdminEmail(user.email);

  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      isAdmin,
      likes: [],
      createdAt: new Date().toISOString(),
    });
  } else {
    await setDoc(
      userRef,
      {
        isAdmin,
        email: user.email,
      },
      { merge: true }
    );
  }
}

function updateUserUI(user) {
  if (user) {
    const displayName = user.displayName || user.email;
    const firstName = displayName.split(" ")[0];
    const isAdmin = isAdminEmail(user.email);
    profileButton?.classList.add("logged-in");
    profileButton?.setAttribute("title", user.email);
    sideGreeting && (sideGreeting.textContent = `Olá, ${firstName}`);
    sideAction && (sideAction.textContent = "Conta conectada (clique para sair)");

    if (sideAvatarImg && user.photoURL) {
      sideAvatarImg.src = user.photoURL;
      sideAvatarImg.style.removeProperty("display");
      sideAvatar?.classList.add("has-photo");
    } else {
      if (sideAvatarImg) {
        sideAvatarImg.removeAttribute("src");
        sideAvatarImg.style.display = "none";
      }
      sideAvatar?.classList.remove("has-photo");
    }

    if (adminSection) {
      adminSection.style.display = isAdmin ? "block" : "none";
    }
  } else {
    // deslogado
    profileButton?.classList.remove("logged-in");
    profileButton?.removeAttribute("title");

    sideGreeting && (sideGreeting.textContent = "Olá, visitante");
    sideAction && (sideAction.textContent = "Entrar ou cadastrar");

    if (sideAvatarImg) {
      sideAvatarImg.removeAttribute("src");
      sideAvatarImg.style.display = "none";
    }
    sideAvatar?.classList.remove("has-photo");

    if (adminSection) {
      adminSection.style.display = "none";
    }
  }
}



function isMobileChrome() {
  const ua = navigator.userAgent || "";
  return /Chrome/i.test(ua) && /Android|iPhone|iPad|iPod/i.test(ua);
}

async function loginWithPopup() {
  const result = await signInWithPopup(auth, provider);
  const user = result.user;
  await ensureUserDoc(user);
  updateUserUI(user);
  const isAdmin = isAdminEmail(user.email);
  alert(
    isAdmin
      ? `Bem-vindo, admin ${user.displayName || user.email}!`
      : `Bem-vindo, ${user.displayName || user.email}!`
  );
}

async function loginWithRedirect() {
  await signInWithRedirect(auth, provider);
}

async function handleAuthClick() {
  const currentUser = auth.currentUser;

  try {
    if (!currentUser) {
      if (isMobileChrome()) {
        await loginWithRedirect();
        return;
      }
      try {
        await loginWithPopup();
      } catch (err) {
        console.error("Erro no popup, tentando redirect:", err);
        const fallbackCodes = [
          "auth/popup-blocked",
          "auth/popup-closed-by-user",
          "auth/cancelled-popup-request",
        ];
        if (fallbackCodes.includes(err.code)) {
          await loginWithRedirect();
          return;
        }

        alert(`Erro ao autenticar com o Google: ${err.code || err.message}`);
      }
    } else {
      const confirmLogout = confirm(
        "Você já está logado. Deseja sair da conta?"
      );
      if (confirmLogout) {
        await signOut(auth);
        updateUserUI(null);
        alert("Você saiu da conta.");
      }
    }
  } catch (err) {
    console.error(err);
    alert(`Erro ao autenticar com o Google: ${err.code || err.message}`);
  }
}

profileButton?.addEventListener("click", handleAuthClick);
sideAction?.addEventListener("click", handleAuthClick);

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      await ensureUserDoc(user);
    } catch (e) {
      console.error("Erro ao garantir documento do usuário:", e);
    }
  }
  updateUserUI(user);
});
