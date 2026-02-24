onAuthStateChanged(auth, async (user) => {

  const profile = document.getElementById("headerProfile");

  if (!user) {
    profile.innerText = "Login";
    profile.classList.remove("hidden");
    profile.onclick = () => {
      window.location.href = "auth.html";
    };
    return;
  }

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  let name = user.phoneNumber;
  if (snap.exists() && snap.data().name) {
    name = snap.data().name;
  }

  profile.innerText = "👤 " + name;
  profile.onclick = () => window.location.href = "profile.html";
});
