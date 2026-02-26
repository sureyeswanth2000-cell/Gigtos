import { auth } from "../firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

export function renderAdminHeader(name){

  document.body.insertAdjacentHTML("afterbegin",`

    <!-- Overlay -->
    <div id="adminOverlay" class="admin-overlay"></div>

    <!-- Side Menu -->
    <div id="adminSideMenu" class="admin-side-menu">
      <div class="menu-header">
        <div>
          <div style="font-size:13px;">Welcome</div>
          <div style="font-weight:600;">${name}</div>
        </div>
        <span class="close-btn" onclick="closeAdminMenu()">✕</span>
      </div>

      <a href="dashboard.html">🏠 Dashboard</a>
      <a href="viewgigs.html">👷 Workers</a>
      <a href="managebookings.html">📦 Bookings</a>
      <a href="#" onclick="logout()" style="color:#dc2626;">🚪 Logout</a>
    </div>

    <!-- Top Header -->
    <div class="admin-header">
      <div class="hamburger" onclick="openAdminMenu()">☰</div>
      <div class="admin-logo">Gigto</div>
    </div>
  `);

  injectAdminCSS();
}

/* ====== MENU OPEN/CLOSE ====== */

window.openAdminMenu = function(){
  document.getElementById("adminSideMenu").classList.add("open");
  document.getElementById("adminOverlay").classList.add("show");
};

window.closeAdminMenu = function(){
  document.getElementById("adminSideMenu").classList.remove("open");
  document.getElementById("adminOverlay").classList.remove("show");
};

/* ====== LOGOUT ====== */

window.logout = async function(){
  await signOut(auth);
  window.location.href="../auth.html";
};

/* ====== CSS ====== */

function injectAdminCSS(){

  const style = document.createElement("style");
  style.innerHTML = `

    .admin-header{
      height:60px;
      background:#4f46e5;
      color:white;
      display:flex;
      align-items:center;
      padding:0 20px;
      font-weight:600;
      font-size:18px;
      position:fixed;
      width:100%;
      top:0;
      left:0;
      z-index:1000;
    }

    .hamburger{
      font-size:22px;
      margin-right:15px;
      cursor:pointer;
    }

    .admin-logo{
      flex:1;
    }

    .admin-side-menu{
      position:fixed;
      top:0;
      left:-260px;
      width:260px;
      height:100%;
      background:white;
      box-shadow:6px 0 20px rgba(0,0,0,0.2);
      transition:left 0.3s ease;
      z-index:1100;
      display:flex;
      flex-direction:column;
    }

    .admin-side-menu.open{
      left:0;
    }

    .menu-header{
      padding:18px;
      background:linear-gradient(90deg,#4f46e5,#06b6d4);
      color:white;
      display:flex;
      justify-content:space-between;
      align-items:center;
    }

    .admin-side-menu a{
      padding:15px 20px;
      text-decoration:none;
      color:#333;
      border-bottom:1px solid #eee;
      font-weight:500;
      transition:background 0.2s ease;
    }

    .admin-side-menu a:hover{
      background:#f5f7ff;
    }

    .close-btn{
      cursor:pointer;
      font-size:18px;
    }

    .admin-overlay{
      position:fixed;
      top:0;
      left:0;
      width:100%;
      height:100%;
      background:rgba(0,0,0,0.3);
      display:none;
      z-index:1000;
    }

    .admin-overlay.show{
      display:block;
    }

    body{
      padding-top:60px;
    }

  `;
  document.head.appendChild(style);
}
