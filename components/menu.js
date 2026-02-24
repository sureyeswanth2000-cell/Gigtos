// components/menu.js

document.addEventListener("DOMContentLoaded", () => {

  // Inject Menu HTML
  document.body.insertAdjacentHTML("afterbegin", `
    <div id="menuOverlay" class="menu-overlay"></div>

    <div id="sideMenu" class="side-menu">
      <div class="menu-header">
        <span>Menu</span>
        <span id="closeMenuBtn" class="close-btn">✕</span>
      </div>

      <a href="index.html">🏠 Home</a>
      <a href="profile.html">👤 Profile</a>
      <a href="my-bookings.html">📦 My Bookings</a>
      <a href="contact.html">☎ Contact</a>
    </div>
  `);

  // Inject CSS
  const style = document.createElement("style");
  style.innerHTML = `

    .side-menu {
      position: fixed;
      top: 0;
      left: -260px;
      width: 250px;
      height: 100%;
      background: #ffffff;
      box-shadow: 4px 0 18px rgba(0,0,0,0.15);
      transition: left 0.3s ease;
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
      font-weight: bold;
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
      transition: background 0.2s ease;
    }

    .side-menu a:hover {
      background: #f5f7ff;
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
    }

    .menu-overlay.show {
      display: block;
    }
  `;
  document.head.appendChild(style);

  // Setup references
  const overlay = document.getElementById("menuOverlay");
  const sideMenu = document.getElementById("sideMenu");
  const closeBtn = document.getElementById("closeMenuBtn");

  // Open Menu
  window.openMenu = function() {
    sideMenu.classList.add("open");
    overlay.classList.add("show");
  };

  // Close Menu
  window.closeMenu = function() {
    sideMenu.classList.remove("open");
    overlay.classList.remove("show");
  };

  // Events
  overlay.addEventListener("click", closeMenu);
  closeBtn.addEventListener("click", closeMenu);

});
