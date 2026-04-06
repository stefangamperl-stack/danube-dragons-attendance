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
  const loginName = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  document.getElementById("loginError").textContent = "";

  if (!loginName || !password) {
    document.getElementById("loginError").textContent = "Bitte Loginname und Passwort eingeben.";
    return;
  }

  const { data: profileLookup, error: profileLookupError } = await supabaseClient
    .from("profiles")
    .select("id, username, email, role, display_name, must_change_password")
    .eq("username", loginName)
    .single();

  if (profileLookupError || !profileLookup) {
    document.getElementById("loginError").textContent = "Loginname oder Passwort ist falsch.";
    return;
  }

  if (!profileLookup.email) {
    document.getElementById("loginError").textContent = "Für diesen Benutzer ist keine E-Mail hinterlegt.";
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: profileLookup.email,
    password
  });

  if (error || !data?.user) {
    document.getElementById("loginError").textContent = "Loginname oder Passwort ist falsch.";
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

  let playerId = null;
  let coachId = null;

  if (profileData.role === "player") {
    const { data: playerData, error: playerError } = await supabaseClient
      .from("players")
      .select("id")
      .eq("profile_id", profileData.id)
      .single();

    if (playerError || !playerData) {
      await supabaseClient.auth.signOut();
      document.getElementById("loginError").textContent = "Spielerprofil konnte nicht geladen werden.";
      return;
    }

    playerId = playerData.id;
  }

  if (profileData.role === "adminCoach" || profileData.role === "headAdmin") {
    const { data: coachData, error: coachError } = await supabaseClient
      .from("coaches")
      .select("id")
      .eq("profile_id", profileData.id)
      .single();

    if (!coachError && coachData) {
      coachId = coachData.id;
    }
  }

  state.currentUser = {
    id: profileData.id,
    username: profileData.username,
    role: profileData.role,
    displayName: profileData.display_name,
    email: profileData.email || "",
    mustChangePassword: profileData.must_change_password ?? true,
    playerId,
    coachId
  };

  saveSession();
  state.currentView = state.currentUser.mustChangePassword ? "profile" : "dashboard";
  showApp();
}

async function logout() {
  await supabaseClient.auth.signOut();
  state.currentUser = null;
  localStorage.removeItem("dd_user");
  showLanding();
}

function setView(view) {
  state.currentView = view;
  renderApp();
}

async function changeOwnPassword() {
  const newPassword = document.getElementById("newPassword").value.trim();
  const confirmPassword = document.getElementById("confirmPassword").value.trim();

  if (newPassword.length < 6) {
    alert("Das neue Passwort muss mindestens 6 Zeichen lang sein.");
    return;
  }

  if (newPassword !== confirmPassword) {
    alert("Die neuen Passwörter stimmen nicht überein.");
    return;
  }

  const { error } = await supabaseClient.auth.updateUser({
    password: newPassword
  });

  if (error) {
    alert("Passwort konnte nicht geändert werden: " + error.message);
    return;
  }

  const { error: profileError } = await supabaseClient
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", state.currentUser.id);

  if (profileError) {
    alert("Passwort wurde geändert, aber das Profil konnte nicht aktualisiert werden: " + profileError.message);
    return;
  }

  state.currentUser.mustChangePassword = false;
  saveSession();

  alert("Passwort erfolgreich geändert.");
  renderApp();
}
