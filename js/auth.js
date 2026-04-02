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

async function login() {
  const email = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  document.getElementById("loginError").textContent = "";

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error || !data?.user) {
    document.getElementById("loginError").textContent = "E-Mail oder Passwort ist falsch.";
    return;
  }

  const { data: profileData, error: profileError } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profileData) {
    await supabaseClient.auth.signOut();
    document.getElementById("loginError").textContent = "Profil konnte nicht geladen werden.";
    return;
  }

  state.currentUser = {
    id: profileData.id,
    username: profileData.username,
    role: profileData.role,
    displayName: profileData.display_name,
    email: profileData.email || ""
  };

  saveSession();
  state.currentView = profileData.must_change_password ? "profile" : "dashboard";
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
