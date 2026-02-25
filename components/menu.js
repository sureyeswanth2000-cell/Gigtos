// components/menu.js

import { auth, db } from "../firebase.js";
import { onAuthStateChanged, signOut } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

window.openMenu = function() {
  const menu = document.getElementById("sideMenu");
  const overlay = document.getElementById("menuOverlay");
  if(menu && overlay){
    menu.classList.add("open");
    overlay.classList.add("show");
  }
};

window.closeMenu = function() {
  const menu = document.getElementById("sideMenu");
  const overlay = document.getElementById("menuOverlay");
  if(menu && overlay){
    menu.classList.remove("open");
    overlay.classList.remove("show");
  }
};

document.addEventListener("DOMContentLoaded", () => {

  document.body.insertAdjacentHTML("afterbegin", `
    <div id="menuOverlay" class="menu-overlay"></div>

    <div id="sideMenu" class="side-menu">
      <div class="menu-header">
        <div>
          <div style="font-size:14px;">Welcome</div>
          <div id="menuUserName" style="font-weight:600;">Guest</div>
        </div>
        <span id="closeMenuBtn" class="close-btn">✕</span>
      </div>

      <a href="index.html" data-link="index.html">🏠 Home</a>
      <a href="profile.html" data-link="profile.html">👤 Profile</a>
      <a href="my-bookings.html" data-link="my-bookings.html">📦 My Bookings</a>
      <a href="contact.html" data-link="contact.html">☎ Contact</a>

      <a href="#" id="logoutBtn" style="color:#dc2626;">🚪 Logout</a>
    </div>

    <div id="authLoader" class="auth-loader hidden">
      <div class="spinner"></div>
    </div>
  `);

  injectCSS();

  const overlay = document.getElementById("menuOverlay");
  const closeBtn = document.getElementById("closeMenuBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  overlay.addEventListener("click", closeMenu);
  closeBtn.addEventListener("click", closeMenu);

  logoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    await signOut(auth);
    window.location.href = "../index.html";
  });

  highlightActivePage();
  loadUserName();
});

function highlightActivePage(){
  const current = window.location.pathname.split("/").pop();
  document.querySelectorAll(".side-menu a").forEach(link => {
    if(link.dataset.link === current){
      link.classList.add("active-link");
    }
  });
}

async function loadUserName(){
  const userNameEl = document.getElementById("menuUserName");

  onAuthStateChanged(auth, async (user) => {

    const loader = document.getElementById("authLoader");
    loader.classList.remove("hidden");

    if(!user){
      userNameEl.innerText = "Guest";
      loader.classList.add("hidden");
      return;
    }

    const snap = await getDoc(doc(db,"users",user.uid));
    let name = user.phoneNumber;

    if(snap.exists() && snap.data().name){
      name = snap.data().name;
    }

    userNameEl.innerText = name;
    loader.classList.add("hidden");
  });
}

function injectCSS(){

  const style = document.createElement("style");
  style.innerHTML = `
    .side-menu {
      position: fixed;
      top: 0;
      left: -260px;
      width: 260px;
      height: 100%;
      background: #ffffff;
      box-shadow: 6px 0 25px rgba(0,0,0,0.2);
      transition: left 0.35s cubic-bezier(.4,0,.2,1);
      z-index: 1000;
      display: flex;
      flex-direction: column;
    }

    .side-menu.open {
      left: 0;
    }

    .menu-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px;
      background: linear-gradient(90deg,#4f46e5,#06b6d4);
      color: white;
    }

    .close-btn {
      cursor: pointer;
      font-size: 18px;
    }

    .side-menu a {
      padding: 16px 20px;
      text-decoration: none;
      color: #333;
      border-bottom: 1px solid #eee;
      font-weight: 500;
      transition: background 0.2s ease, padding-left 0.2s ease;
    }

    .side-menu a:hover {
      background: #f5f7ff;
      padding-left: 24px;
    }

    .active-link {
      background: #eef2ff;
      font-weight: 600;
      color: #4f46e5;
    }

    .menu-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.3);
      display: none;
      z-index: 999;
      transition: opacity 0.3s ease;
    }

    .menu-overlay.show {
      display: block;
    }

    .auth-loader {
      position: fixed;
      top:0;
      left:0;
      width:100%;
      height:100%;
      background: rgba(255,255,255,0.6);
      display:flex;
      align-items:center;
      justify-content:center;
      z-index:2000;
    }

    .hidden { display:none; }

    .spinner {
      width:40px;
      height:40px;
      border:4px solid #e5e7eb;
      border-top:4px solid #4f46e5;
      border-radius:50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}
