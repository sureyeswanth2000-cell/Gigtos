// components/modal.js

export function initModal() {

  document.body.insertAdjacentHTML("beforeend", `
    <div id="confirmOverlay" class="confirm-overlay hidden">
      <div class="confirm-modal">
        <h3 id="confirmTitle">Confirm Action</h3>
        <p id="confirmMessage">Are you sure?</p>

        <div class="confirm-buttons">
          <button class="btn-cancel" onclick="closeModal()">Cancel</button>
          <button class="btn-confirm" id="confirmBtn">Confirm</button>
        </div>
      </div>
    </div>
  `);
}

window.openModal = function(message, onConfirm) {
  document.getElementById("confirmMessage").innerText = message;

  const overlay = document.getElementById("confirmOverlay");
  overlay.classList.remove("hidden");

  const confirmBtn = document.getElementById("confirmBtn");

  confirmBtn.onclick = () => {
    overlay.classList.add("hidden");
    onConfirm();
  };
};

window.closeModal = function() {
  document.getElementById("confirmOverlay").classList.add("hidden");
};
