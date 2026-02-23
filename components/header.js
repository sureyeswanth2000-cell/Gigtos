// components/header.js

export function renderHeader() {

  document.body.insertAdjacentHTML("afterbegin", `
    <header class="global-header">
      <div class="hamburger" onclick="toggleSideMenu()">☰</div>
      <div class="logo" onclick="goHome()">Gigto</div>
      <div id="headerProfile" class="header-profile hidden"></div>
    </header>

    <nav id="sideMenu" class="side-menu">
      <div class="close-btn" onclick="toggleSideMenu()">✕</div>
      <a href="index.html">Home</a>
      <a href="profile.html">Profile</a>
      <a href="my-bookings.html">My Bookings</a>
      <a href="contact.html">Contact</a>
      <a href="#" onclick="logout()">Logout</a>
    </nav>

    <div id="menuOverlay" class="menu-overlay hidden"></div>
  `);

  initAuthHeader(); // setup profile display
}

// Toggle menu
window.toggleSideMenu = function() {
  const menu = document.getElementById("sideMenu");
  const overlay = document.getElementById("menuOverlay");
  menu.classList.toggle("open");
  overlay.classList.toggle("hidden");
};

// Home redirect
window.goHome = function() {
  window.location.href = "index.html";
};

// Logout (clear session)
window.logout = async function() {
  await firebase.auth().signOut();
  window.location.href = "index.html";
};

// Show profile info
async function initAuthHeader() {
  const profile = document.getElementById("headerProfile");
  firebase.auth().onAuthStateChanged(async user => {
    if (user) {
      // Load stored user detail
      const docSnap = await firebase.firestore()
                         .collection("users").doc(user.uid).get();
      let name = user.phoneNumber;
      if (docSnap.exists && docSnap.data().name) {
        name = docSnap.data().name;
      }
      profile.textContent = `👤 ${name}`;
      profile.classList.remove("hidden");
      profile.onclick = () => window.location.href = "profile.html";
    }
  });
}
