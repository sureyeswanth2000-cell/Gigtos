// components/footer.js

export function renderFooter() {

  document.body.insertAdjacentHTML("beforeend", `
    <footer class="global-footer">
      <div class="footer-container">
        <div class="footer-brand">
          <h3>Gigto</h3>
          <p>Trusted Home Services in Kavali</p>
        </div>

        <div class="footer-links">
          <a href="index.html">Home</a>
          <a href="profile.html">Profile</a>
          <a href="my-bookings.html">My Bookings</a>
          <a href="contact.html">Contact</a>
        </div>

        <div class="footer-copy">
          © ${new Date().getFullYear()} Gigto. All rights reserved.
        </div>
      </div>
    </footer>
  `);

}
