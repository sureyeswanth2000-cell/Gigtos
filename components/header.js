// components/header.js

import { auth, db } from "../firebase.js";
import { onAuthStateChanged, signOut } 
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } 
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export function renderHeader() {

  document.body.insertAdjacentHTML("afterbegin", `
    <header class="global-header">
      <div class="hamburger" onclick="toggleSideMenu()">☰</div>
      <div class="logo" onclick="goHome()">Gigto</div>
      <div id="headerProfile" class="header-profile hidden"></div>
    </header>

    <nav id="sideMenu" class="side-menu">

      <!-- MENU HEADER (COLORED SECTION) -->
      <div class="menu-top">
        <div class="menu-brand">Gigto</div>
        <div id="menuUser" class="menu-user hidden"></div>
        <div class="close-btn" onclick="toggleSideMenu()">✕</div>
      </div>

      <!-- MENU LINKS -->
      <div class="menu-links">
        <a href="index.html">🏠 Home</a>
        <a href="profile.html">👤 Profile</a>
        <a href="my-bookings.html">📋 My Bookings</a>
        <a href="contact.html">📞 Contact</a>
        <a href="#" onclick="logout()">🚪 Logout</a>
      </div>

    </nav>

    <div id="menuOverlay" class="menu-overlay hidden" onclick="toggleSideMenu()"></div>
  `);

  initAuthHeader();
}

// Toggle
window.toggleSideMenu = function() {
  document.getElementById("sideMenu").classList.toggle("open");
  document.getElementById("menuOverlay").classList.toggle("hidden");
};

// Home redirect
window.goHome = function() {
  window.location.href = "index.html";
};

// Logout
window.logout = async function() {
  await signOut(auth);
  window.location.href = "index.html";
};

// Load profile into header + menu
async function initAuthHeader() {

  const headerProfile = document.getElementById("headerProfile");
  const menuUser = document.getElementById("menuUser");

  onAuthStateChanged(auth, async (user) => {

    if (user) {

      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);

      let name = user.phoneNumber;

      if (snap.exists() && snap.data().name) {
        name = snap.data().name;
      }

      headerProfile.textContent = `👤 ${name}`;
      headerProfile.classList.remove("hidden");
      headerProfile.onclick = () => window.location.href = "profile.html";

      menuUser.textContent = name;
      menuUser.classList.remove("hidden");

    }
  });
}
