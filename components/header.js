import { auth, db } from "../firebase.js";
import { onAuthStateChanged } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export function renderHeader() {

  const placeholder = document.getElementById("header-placeholder");

  if (!placeholder) return;

  placeholder.innerHTML = `
    <header class="global-header">
      <div class="hamburger" onclick="openMenu()">☰</div>
      <div class="logo" onclick="goHome()">Gigto</div>
      <div id="headerProfile" class="header-profile hidden"></div>
    </header>
  `;

  initAuthHeader();
}

window.goHome = function() {
  window.location.href = "index.html";
};

function initAuthHeader() {

  const profile = document.getElementById("headerProfile");

  onAuthStateChanged(auth, async (user) => {

    if (!profile) return;

    // Not logged in
    if (!user) {
      profile.innerText = "Login";
      profile.classList.remove("hidden");
      profile.onclick = () => {
        window.location.href = "auth.html";
      };
      return;
    }

    // Logged in
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    let name = user.phoneNumber;

    if (snap.exists() && snap.data().name) {
      name = snap.data().name;
    }

    profile.innerText = "👤 " + name;
    profile.classList.remove("hidden");
    profile.onclick = () => window.location.href = "profile.html";
  });
}
