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
  const loginInput = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  document.getElementById("loginError").textContent = "";

  if (!loginInput || !password) {
    document.getElementById("loginError").textContent = "Bitte Loginname oder E-Mail und Passwort eingeben.";
    return;
  }

  let email = loginInput;

  if (!loginInput.includes("@")) {
    let lookupResult = null;

    try {
      const lookupResponse = await fetch("/api/login-lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: loginInput
        })
      });

      try {
        lookupResult = await lookupResponse.json();
      } catch {
        lookupResult = null;
      }

      if (!lookupResponse.ok || !lookupResult?.email) {
        document.getElementById("loginError").textContent = "Loginname/E-Mail oder Passwort ist falsch.";
        return;
      }

      email = lookupResult.email;
    } catch (err) {
      console.error("Fehler beim Username-Lookup:", err);
      document.getElementById("loginError").textContent = "Login aktuell nicht möglich.";
      return;
    }
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error || !data?.user) {
    document.getElementById("loginError").textContent = "Loginname/E-Mail oder Passwort ist falsch.";
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
  state.currentView = "dashboard";

  try {
    await loadTrainingsFromSupabase();
    await loadPlayersFromSupabase();
    await loadResponsesFromSupabase();
  } catch (loadErr) {
    console.error("Fehler beim Laden der App-Daten nach Login:", loadErr);
  }

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
