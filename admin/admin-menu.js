import { auth } from "../firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

export function renderAdminHeader(name){

  document.body.insertAdjacentHTML("afterbegin",`
    <div class="admin-header">
      <div class="admin-logo">Gigto Admin</div>
      <div class="admin-right">
        <button onclick="goDashboard()">Dashboard</button>
        <button onclick="goWorkers()">Workers</button>
        <button onclick="goBookings()">Bookings</button>
        <span>${name}</span>
        <button onclick="logout()">Logout</button>
      </div>
    </div>
  `);
}

window.logout = async function(){
  await signOut(auth);
  window.location.href="../auth.html";
};

window.goDashboard = ()=> window.location.href="dashboard.html";
window.goWorkers = ()=> window.location.href="viewgigs.html";
window.goBookings = ()=> window.location.href="managebookings.html";
