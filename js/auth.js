function showLanding() {
  document.getElementById("landing").classList.remove("hidden");
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("appScreen").classList.add("hidden");
}

function showLogin() {
  document.getElementById("landing").classList.add("hidden");
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("appScreen").classList.add("hidden");
}

function showApp() {
  document.getElementById("landing").classList.add("hidden");
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("appScreen").classList.remove("hidden");
  updateCurrentDateTime();
  renderApp();
}

function login() {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value.trim();
  const user = users.find(u => u.username === username && u.password === password && u.active !== false);

  if (!user) {
    document.getElementById("loginError").textContent = "Loginname oder Passwort ist falsch.";
    return;
  }

  state.currentUser = {
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.displayName,
    playerId: user.playerId || null,
    coachId: user.coachId || null
  };

  saveSession();
  state.currentView = user.mustChangePassword ? "profile" : "dashboard";
  showApp();
}

function logout() {
  state.currentUser = null;
  localStorage.removeItem("dd_user");
  showLanding();
}

function setView(view) {
  state.currentView = view;
  renderApp();
}

function changeOwnPassword() {
  const auth = getCurrentUserAuth();
  if (!auth) return;

  const currentPassword = document.getElementById("currentPassword").value.trim();
  const newPassword = document.getElementById("newPassword").value.trim();
  const confirmPassword = document.getElementById("confirmPassword").value.trim();

  if (currentPassword !== auth.password) {
    alert("Das aktuelle Passwort stimmt nicht.");
    return;
  }

  if (newPassword.length < 4) {
    alert("Das neue Passwort muss mindestens 4 Zeichen lang sein.");
    return;
  }

  if (newPassword !== confirmPassword) {
    alert("Die neuen Passwörter stimmen nicht überein.");
    return;
  }

  auth.password = newPassword;
  auth.mustChangePassword = false;

  state.currentUser.username = auth.username;
  state.currentUser.role = auth.role;
  state.currentUser.displayName = auth.displayName;
  saveSession();

  alert("Passwort erfolgreich geändert.");
  renderApp();
}
