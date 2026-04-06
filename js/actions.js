async function loadTrainingsFromSupabase() {
  try {
    if (typeof supabaseClient === "undefined" || !supabaseClient) {
      throw new Error("Supabase-Client ist nicht geladen.");
    }

    if (typeof trainings === "undefined") {
      throw new Error("Die Variable 'trainings' ist nicht definiert.");
    }

    if (typeof responses === "undefined") {
      throw new Error("Die Variable 'responses' ist nicht definiert.");
    }

    const { data, error } = await supabaseClient
      .from("trainings")
      .select("*")
      .order("training_date", { ascending: true })
      .order("training_time", { ascending: true });

    if (error) {
      console.error("Fehler beim Laden der Trainings:", error);
      alert("Trainings konnten nicht geladen werden:\n" + (error.message || JSON.stringify(error)));
      return;
    }

    trainings.length = 0;

    const existingResponseKeys = new Set(Object.keys(responses || {}));

    (data || []).forEach(row => {
      trainings.push({
        id: row.id,
        title: row.title || "",
        date: row.training_date || "",
        time: String(row.training_time || "").slice(0, 5),
        location: row.location || "",
        notes: row.notes || "",
        voteOpensHoursBefore: row.vote_opens_hours_before ?? 72,
        voteClosesHoursBefore: row.vote_closes_hours_before ?? 6
      });

      if (!responses[row.id]) {
        responses[row.id] = {};
      }

      existingResponseKeys.delete(row.id);
    });

    existingResponseKeys.forEach(trainingId => {
      delete responses[trainingId];
    });

    const selectedStillExists =
      state.selectedTrainingId &&
      trainings.some(t => t.id === state.selectedTrainingId);

    const reportsStillExists =
      state.reportsTrainingId &&
      trainings.some(t => t.id === state.reportsTrainingId);

    if (!selectedStillExists) {
      state.selectedTrainingId = trainings[0]?.id || null;
    }

    if (!reportsStillExists) {
      state.reportsTrainingId = trainings[0]?.id || null;
    }
  } catch (err) {
    console.error("Unerwarteter Fehler beim Laden der Trainings:", err);
    alert("Unerwarteter Fehler beim Laden der Trainings:\n" + (err.message || err));
  }
}

async function loadPlayersFromSupabase() {
  try {
    if (typeof supabaseClient === "undefined" || !supabaseClient) {
      throw new Error("Supabase-Client ist nicht geladen.");
    }

    if (typeof players === "undefined") {
      throw new Error("Die Variable 'players' ist nicht definiert.");
    }

    if (typeof rebuildPlayerUsersFromPlayers !== "function") {
      throw new Error("Die Funktion 'rebuildPlayerUsersFromPlayers' fehlt.");
    }

    const { data, error } = await supabaseClient
      .from("players_with_profile")
      .select("*")
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    if (error) {
      console.error("Fehler beim Laden der Spieler:", error);
      alert("Spieler konnten nicht geladen werden:\n" + (error.message || JSON.stringify(error)));
      return;
    }

    players.length = 0;

    (data || []).forEach(row => {
      const player = makePlayer(
        row.id,
        row.username || "",
        row.first_name || "",
        row.last_name || "",
        row.birthday || "",
        row.unit || "",
        []
      );

      player.active = row.active !== false;
      player.profileId = row.profile_id || null;
      player.email = row.email || "";
      player.mustChangePassword = row.must_change_password ?? true;

      players.push(player);
    });

    rebuildPlayerUsersFromPlayers();

    if (state.currentUser?.role === "player" && !state.currentUser.playerId) {
      const ownPlayer = players.find(p => p.profileId === state.currentUser.id);
      if (ownPlayer) {
        state.currentUser.playerId = ownPlayer.id;
        saveSession();
      }
    }
  } catch (err) {
    console.error("Unerwarteter Fehler beim Laden der Spieler:", err);
    alert("Unerwarteter Fehler beim Laden der Spieler:\n" + (err.message || err));
  }
}

async function loadCoachesFromSupabase() {
  try {
    if (typeof supabaseClient === "undefined" || !supabaseClient) {
      throw new Error("Supabase-Client ist nicht geladen.");
    }

    if (typeof coaches === "undefined") {
      throw new Error("Die Variable 'coaches' ist nicht definiert.");
    }

    const { data, error } = await supabaseClient
      .from("coaches")
      .select("*")
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    if (error) {
      console.error("Fehler beim Laden der Coaches:", error);
      alert("Coaches konnten nicht geladen werden:\n" + (error.message || JSON.stringify(error)));
      return;
    }

    coaches.length = 0;

    (data || []).forEach(row => {
      coaches.push({
        id: row.id,
        name: row.name || `${row.first_name || ""} ${row.last_name || ""}`.trim(),
        first_name: row.first_name || "",
        last_name: row.last_name || "",
        username: row.username || "",
        birthday: row.birthday || "",
        email: row.email || "",
        role: row.role || "adminCoach",
        profile_id: row.profile_id || null,
        is_active: row.is_active !== false,
        active: row.active !== false,
        created_at: row.created_at || null,
        updated_at: row.updated_at || null
      });
    });

    if (state.currentUser?.role && state.currentUser.role !== "player" && !state.currentUser.coachId) {
      const ownCoach = coaches.find(c => c.profile_id === state.currentUser.id);
      if (ownCoach) {
        state.currentUser.coachId = ownCoach.id;
        saveSession();
      }
    }
  } catch (err) {
    console.error("Unerwarteter Fehler beim Laden der Coaches:", err);
    alert("Unerwarteter Fehler beim Laden der Coaches:\n" + (err.message || err));
  }
}

async function loadResponsesFromSupabase() {
  try {
    if (typeof supabaseClient === "undefined" || !supabaseClient) {
      throw new Error("Supabase-Client ist nicht geladen.");
    }

    if (typeof responses === "undefined") {
      throw new Error("Die Variable 'responses' ist nicht definiert.");
    }

    const { data, error } = await supabaseClient
      .from("responses")
      .select("*");

    if (error) {
      console.error("Fehler beim Laden der Antworten:", error);
      alert("Antworten konnten nicht geladen werden:\n" + (error.message || JSON.stringify(error)));
      return;
    }

    Object.keys(responses).forEach(trainingId => {
      responses[trainingId] = {};
    });

    (data || []).forEach(row => {
      if (!responses[row.training_id]) {
        responses[row.training_id] = {};
      }

      responses[row.training_id][row.player_id] = {
        status: row.status,
        updatedAt: row.updated_at,
        changedOnEventDay: row.changed_on_event_day
      };
    });
  } catch (err) {
    console.error("Unerwarteter Fehler beim Laden der Antworten:", err);
    alert("Unerwarteter Fehler beim Laden der Antworten:\n" + (err.message || err));
  }
}

async function setPlayerResponse(trainingId, status) {
  const playerId = state.currentUser.playerId;
  const player = players.find(p => p.id === playerId);
  const training = trainings.find(t => t.id === trainingId);

  if (!player) {
    alert("Dein Spielerprofil konnte nicht gefunden werden.");
    return;
  }

  if (!training) {
    alert("Das Training konnte nicht gefunden werden.");
    return;
  }

  if (isPlayerLimitedForTraining(player, training)) {
    alert("Du bist für dieses Training automatisch Limited.");
    return;
  }

  if (isPlayerVoteLocked(training)) {
    alert("Die Frist zur Änderung deiner Antwort ist abgelaufen. Nur Coaches/Admins können jetzt noch ändern.");
    return;
  }

  const payload = {
    training_id: trainingId,
    player_id: playerId,
    status,
    updated_at: new Date().toISOString(),
    changed_on_event_day: getTodayYmd() === training.date
  };

  const { error } = await supabaseClient
    .from("responses")
    .upsert([payload], {
      onConflict: "training_id,player_id"
    });

  if (error) {
    console.error("Fehler beim Speichern der Antwort:", error);
    alert("Deine Antwort konnte nicht gespeichert werden:\n" + (error.message || JSON.stringify(error)));
    return;
  }

  responses[trainingId] = responses[trainingId] || {};
  responses[trainingId][playerId] = {
    status,
    updatedAt: payload.updated_at,
    changedOnEventDay: payload.changed_on_event_day
  };

  renderApp();
}

function buildPlayerUsername(firstName, lastName, fallbackUsername = "") {
  const clean = value =>
    String(value || "")
      .trim()
      .replace(/\s+/g, "")
      .toLowerCase();

  const first = clean(firstName);
  const last = clean(lastName);

  if (first && last) {
    return `${first.charAt(0)}${last}`;
  }

  if (fallbackUsername) {
    return fallbackUsername;
  }

  return "";
}

function normalizePlayerNamePart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function buildPlayerNameKey(firstName, lastName) {
  return `${normalizePlayerNamePart(firstName)}|${normalizePlayerNamePart(lastName)}`;
}

function parseCsvLine(line, delimiter) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result.map(value => value.replace(/^"(.*)"$/, "$1").trim());
}

function detectCsvDelimiter(headerLine) {
  const semicolons = (headerLine.match(/;/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  return semicolons >= commas ? ";" : ",";
}

function mapCsvHeaders(headers) {
  const normalized = headers.map(h =>
    String(h || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
  );

  const findIndex = names => normalized.findIndex(h => names.includes(h));

  return {
    firstName: findIndex(["vorname", "firstname", "first_name"]),
    lastName: findIndex(["nachname", "lastname", "last_name"]),
    birthday: findIndex(["geburtstag", "birthday"]),
    unit: findIndex(["unit", "position"]),
    email: findIndex(["e-mail", "email", "mail"])
  };
}

function clearPlayerForm() {
  const firstNameInput = document.getElementById("playerFirstName");
  const lastNameInput = document.getElementById("playerLastName");
  const usernameInput = document.getElementById("playerUsername");
  const emailInput = document.getElementById("playerEmail");
  const birthdayInput = document.getElementById("playerBirthday");
  const unitSelect = document.getElementById("playerUnit");

  if (firstNameInput) firstNameInput.value = "";
  if (lastNameInput) lastNameInput.value = "";
  if (usernameInput) usernameInput.value = "";
  if (emailInput) emailInput.value = "";
  if (birthdayInput) birthdayInput.value = "";
  if (unitSelect) unitSelect.selectedIndex = 0;
}

function clearCoachForm() {
  const firstNameInput = document.getElementById("coachFirstName");
  const lastNameInput = document.getElementById("coachLastName");
  const usernameInput = document.getElementById("coachUsername");
  const emailInput = document.getElementById("coachEmail");
  const roleSelect = document.getElementById("coachRole");

  if (firstNameInput) firstNameInput.value = "";
  if (lastNameInput) lastNameInput.value = "";
  if (usernameInput) usernameInput.value = "";
  if (emailInput) emailInput.value = "";
  if (roleSelect) roleSelect.value = "adminCoach";
}

async function createPlayer() {
  try {
    const firstName = document.getElementById("playerFirstName")?.value?.trim() || "";
    const lastName = document.getElementById("playerLastName")?.value?.trim() || "";
    const usernameInput = document.getElementById("playerUsername")?.value?.trim() || "";
    const email = document.getElementById("playerEmail")?.value?.trim() || "";
    const birthday = document.getElementById("playerBirthday")?.value || "";
    const unit = document.getElementById("playerUnit")?.value?.trim() || "";

    if (!firstName || !lastName || !birthday) {
      alert("Bitte zumindest Vorname, Nachname und Geburtstag ausfüllen.");
      return;
    }

    const username = usernameInput || buildPlayerUsername(firstName, lastName);

    const response = await fetch("/api/create-player", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        firstName,
        lastName,
        username,
        email,
        birthday,
        unit
      })
    });

    let result = null;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok) {
      console.error("Fehler beim Anlegen des Spielers:", result);
      alert(result?.error || "Spieler konnte nicht angelegt werden.");
      return;
    }

    await loadPlayersFromSupabase();

    state.editPlayerId = null;
    clearPlayerForm();
    renderPlayersView();

    alert(
      `Spieler wurde angelegt.\n` +
      `Loginname: ${result?.username || username || "-"}\n` +
      `Initialpasswort: ${result?.initialPassword || String(birthday).slice(0, 4)}`
    );
  } catch (err) {
    console.error("Unerwarteter Fehler beim Anlegen des Spielers:", err);
    alert("Unerwarteter Fehler beim Anlegen des Spielers:\n" + (err.message || err));
  }
}

async function createCoach() {
  try {
    if (state.currentUser?.role !== "headAdmin") {
      alert("Nur der Hauptadmin darf Coaches anlegen.");
      return;
    }

    const firstName = document.getElementById("coachFirstName")?.value?.trim() || "";
    const lastName = document.getElementById("coachLastName")?.value?.trim() || "";
    const usernameInput = document.getElementById("coachUsername")?.value?.trim() || "";
    const email = document.getElementById("coachEmail")?.value?.trim() || "";
    const role = document.getElementById("coachRole")?.value || "adminCoach";

    if (!firstName || !lastName) {
      alert("Bitte Vorname und Nachname ausfüllen.");
      return;
    }

    const username = usernameInput || buildPlayerUsername(firstName, lastName);

    const response = await fetch("/api/create-coach", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        firstName,
        lastName,
        username,
        email,
        role
      })
    });

    let result = null;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok) {
      console.error("Fehler beim Anlegen des Coaches:", result);
      alert(result?.error || "Coach konnte nicht angelegt werden.");
      return;
    }

    await loadCoachesFromSupabase();

    state.editCoachId = null;
    clearCoachForm();
    renderCoachesView();

    const finalUsername = result?.credentials?.username || username || "-";
    const finalEmail = result?.credentials?.email || email || "-";
    const finalPassword = result?.credentials?.password || "test123";

    alert(
      `Coach wurde angelegt.\n` +
      `Loginname: ${finalUsername}\n` +
      `E-Mail: ${finalEmail}\n` +
      `Initialpasswort: ${finalPassword}`
    );
  } catch (err) {
    console.error("Unerwarteter Fehler beim Anlegen des Coaches:", err);
    alert("Unerwarteter Fehler beim Anlegen des Coaches:\n" + (err.message || err));
  }
}

function clearPlayerListSearch() {
  state.playerListSearch = "";
  state.playerListGroup = "all";

  const input = document.getElementById("playerListSearchInput");
  if (input) {
    input.value = "";
  }

  renderPlayersView();
}

function setPlayerListGroup(group) {
  state.playerListGroup = group || "all";
  state.playerListSearch = "";
  renderPlayersView();
}

function cancelPlayerEdit() {
  state.editPlayerId = null;
  renderPlayersView();
}

function startCoachEdit(coachId) {
  state.editCoachId = coachId;
  renderCoachesView();
}

function cancelCoachEdit() {
  state.editCoachId = null;
  renderCoachesView();
}

async function updatePlayer() {
  try {
    if (!state.editPlayerId) {
      alert("Kein Spieler zum Bearbeiten ausgewählt.");
      return;
    }

    const editPlayer = players.find(p => p.id === state.editPlayerId);
    if (!editPlayer) {
      alert("Der zu bearbeitende Spieler wurde nicht gefunden.");
      return;
    }

    const firstName = document.getElementById("playerFirstName")?.value?.trim() || "";
    const lastName = document.getElementById("playerLastName")?.value?.trim() || "";
    const usernameInput = document.getElementById("playerUsername")?.value?.trim() || "";
    const email = document.getElementById("playerEmail")?.value?.trim() || "";
    const birthday = document.getElementById("playerBirthday")?.value || "";
    const unit = document.getElementById("playerUnit")?.value || "";

    if (!firstName || !lastName || !birthday) {
      alert("Bitte Vorname, Nachname und Geburtstag ausfüllen.");
      return;
    }

    const username = usernameInput || buildPlayerUsername(firstName, lastName, editPlayer.username || "");

    if (!editPlayer.profileId) {
      const response = await fetch("/api/activate-player-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          playerId: editPlayer.id,
          firstName,
          lastName,
          birthday,
          username,
          email,
          unit
        })
      });

      let result = null;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok) {
        console.error("Fehler beim Aktivieren des Spieler-Logins:", result);
        alert(result?.error || "Spieler konnte nicht für Login aktiviert werden.");
        return;
      }

      await loadPlayersFromSupabase();

      state.editPlayerId = null;
      renderPlayersView();

      alert(
        `Spieler wurde gespeichert und für Login aktiviert.\n` +
        `Loginname: ${result?.username || username}\n` +
        `Initialpasswort: ${result?.initialPassword || String(birthday).slice(0, 4)}`
      );
      return;
    }

    const { error: playerError } = await supabaseClient
      .from("players")
      .update({
        first_name: firstName,
        last_name: lastName,
        username,
        birthday,
        unit: unit || ""
      })
      .eq("id", editPlayer.id);

    if (playerError) {
      console.error("Fehler beim Aktualisieren des Spielers:", playerError);
      alert("Spielerdaten konnten nicht gespeichert werden:\n" + (playerError.message || JSON.stringify(playerError)));
      return;
    }

    const profilePayload = {
      username,
      display_name: `${firstName} ${lastName}`,
      email: email || null
    };

    const { error: profileError } = await supabaseClient
      .from("profiles")
      .update(profilePayload)
      .eq("id", editPlayer.profileId);

    if (profileError) {
      console.error("Fehler beim Aktualisieren des Profils:", profileError);
      alert("Profil konnte nicht vollständig gespeichert werden:\n" + (profileError.message || JSON.stringify(profileError)));
      return;
    }

    await loadPlayersFromSupabase();

    state.editPlayerId = null;
    renderPlayersView();
    alert("Spieler wurde gespeichert.");
  } catch (err) {
    console.error("Unerwarteter Fehler beim Speichern des Spielers:", err);
    alert("Unerwarteter Fehler beim Speichern des Spielers:\n" + (err.message || err));
  }
}

async function updateCoach() {
  try {
    if (state.currentUser?.role !== "headAdmin") {
      alert("Nur der Hauptadmin darf Coaches bearbeiten.");
      return;
    }

    if (!state.editCoachId) {
      alert("Kein Coach zum Bearbeiten ausgewählt.");
      return;
    }

    const editCoach = coaches.find(c => c.id === state.editCoachId);
    if (!editCoach) {
      alert("Der zu bearbeitende Coach wurde nicht gefunden.");
      return;
    }

    const firstName = document.getElementById("coachFirstName")?.value?.trim() || "";
    const lastName = document.getElementById("coachLastName")?.value?.trim() || "";
    const usernameInput = document.getElementById("coachUsername")?.value?.trim() || "";
    const email = document.getElementById("coachEmail")?.value?.trim() || "";
    const role = document.getElementById("coachRole")?.value || "adminCoach";

    if (!firstName || !lastName) {
      alert("Bitte Vorname und Nachname ausfüllen.");
      return;
    }

    const username = usernameInput || buildPlayerUsername(firstName, lastName, editCoach.username || "");

    const isUuid = value =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

    let dbCoachId = editCoach.id;
    let dbProfileId = editCoach.profile_id || null;

    if (!isUuid(dbCoachId)) {
      let matchedCoach = null;

      if (dbProfileId && isUuid(dbProfileId)) {
        const { data, error } = await supabaseClient
          .from("coaches")
          .select("id, profile_id, username, email")
          .eq("profile_id", dbProfileId)
          .maybeSingle();

        if (error) {
          console.error("Fehler beim Suchen des Coaches per profile_id:", error);
        } else if (data) {
          matchedCoach = data;
        }
      }

      if (!matchedCoach && editCoach.username) {
        const { data, error } = await supabaseClient
          .from("coaches")
          .select("id, profile_id, username, email")
          .eq("username", editCoach.username)
          .maybeSingle();

        if (error) {
          console.error("Fehler beim Suchen des Coaches per username:", error);
        } else if (data) {
          matchedCoach = data;
        }
      }

      if (!matchedCoach && editCoach.email) {
        const { data, error } = await supabaseClient
          .from("coaches")
          .select("id, profile_id, username, email")
          .eq("email", editCoach.email)
          .maybeSingle();

        if (error) {
          console.error("Fehler beim Suchen des Coaches per email:", error);
        } else if (data) {
          matchedCoach = data;
        }
      }

      if (!matchedCoach || !matchedCoach.id) {
        alert("Dieser Coach stammt offenbar noch aus alten lokalen Demodaten und konnte keinem echten Datenbankeintrag zugeordnet werden.");
        return;
      }

      dbCoachId = matchedCoach.id;
      dbProfileId = matchedCoach.profile_id || dbProfileId || null;
    }

    const { error: coachError } = await supabaseClient
      .from("coaches")
      .update({
        first_name: firstName,
        last_name: lastName,
        name: `${firstName} ${lastName}`.trim(),
        username,
        email: email || null,
        role,
        is_active: true,
        active: true
      })
      .eq("id", dbCoachId);

    if (coachError) {
      console.error("Fehler beim Aktualisieren des Coaches:", coachError);
      alert("Coachdaten konnten nicht gespeichert werden:\n" + (coachError.message || JSON.stringify(coachError)));
      return;
    }

    if (dbProfileId && isUuid(dbProfileId)) {
      const profilePayload = {
        username,
        email: email || null,
        role,
        display_name: `${firstName} ${lastName}`.trim()
      };

      const { error: profileError } = await supabaseClient
        .from("profiles")
        .update(profilePayload)
        .eq("id", dbProfileId);

      if (profileError) {
        console.error("Fehler beim Aktualisieren des Coach-Profils:", profileError);
        alert("Coach wurde gespeichert, aber das Profil konnte nicht vollständig aktualisiert werden:\n" + (profileError.message || JSON.stringify(profileError)));
        await loadCoachesFromSupabase();
        state.editCoachId = null;
        renderCoachesView();
        return;
      }
    }

    await loadCoachesFromSupabase();

    state.editCoachId = null;
    renderCoachesView();
    alert("Coach wurde gespeichert.");
  } catch (err) {
    console.error("Unerwarteter Fehler beim Speichern des Coaches:", err);
    alert("Unerwarteter Fehler beim Speichern des Coaches:\n" + (err.message || err));
  }
}

async function deletePlayer(playerId) {
  try {
    if (state.currentUser?.role !== "headAdmin") {
      alert("Nur der Hauptadmin darf Spieler löschen.");
      return;
    }

    const player = players.find(p => p.id === playerId);
    if (!player) {
      alert("Der Spieler wurde nicht gefunden.");
      return;
    }

    const confirmed = window.confirm(`Bist du sicher, dass Spieler ${fullName(player)} gelöscht werden soll?`);
    if (!confirmed) {
      return;
    }

    const { error: responsesError } = await supabaseClient
      .from("responses")
      .delete()
      .eq("player_id", player.id);

    if (responsesError) {
      console.error("Fehler beim Löschen der Antworten:", responsesError);
      alert("Antworten des Spielers konnten nicht gelöscht werden:\n" + (responsesError.message || JSON.stringify(responsesError)));
      return;
    }

    const { error: playerError } = await supabaseClient
      .from("players")
      .delete()
      .eq("id", player.id);

    if (playerError) {
      console.error("Fehler beim Löschen des Spielers:", playerError);
      alert("Spieler konnte nicht gelöscht werden:\n" + (playerError.message || JSON.stringify(playerError)));
      return;
    }

    if (player.profileId) {
      const { error: profileError } = await supabaseClient
        .from("profiles")
        .delete()
        .eq("id", player.profileId);

      if (profileError) {
        console.error("Fehler beim Löschen des Profils:", profileError);
        alert("Spieler wurde gelöscht, aber das Profil konnte nicht gelöscht werden:\n" + (profileError.message || JSON.stringify(profileError)));
        await loadPlayersFromSupabase();
        await loadResponsesFromSupabase();
        if (state.editPlayerId === player.id) {
          state.editPlayerId = null;
        }
        renderPlayersView();
        return;
      }
    }

    await loadPlayersFromSupabase();
    await loadResponsesFromSupabase();

    if (state.editPlayerId === player.id) {
      state.editPlayerId = null;
    }

    renderPlayersView();
    alert(`Spieler ${fullName(player)} wurde gelöscht.`);
  } catch (err) {
    console.error("Unerwarteter Fehler beim Löschen des Spielers:", err);
    alert("Unerwarteter Fehler beim Löschen des Spielers:\n" + (err.message || err));
  }
}

async function deleteCoach(coachId) {
  try {
    if (state.currentUser?.role !== "headAdmin") {
      alert("Nur der Hauptadmin darf Coaches löschen.");
      return;
    }

    const coach = coaches.find(c => c.id === coachId);
    if (!coach) {
      alert("Der Coach wurde nicht gefunden.");
      return;
    }

    const coachName = `${coach.first_name || ""} ${coach.last_name || ""}`.trim() || coach.name || "dieser Coach";
    const confirmed = window.confirm(`Bist du sicher, dass Coach ${coachName} gelöscht werden soll?`);
    if (!confirmed) {
      return;
    }

    let dbCoachId = coach.id;
    let dbProfileId = coach.profile_id || null;

    const isUuid = value =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

    if (!isUuid(dbCoachId)) {
      let matchedCoach = null;

      if (dbProfileId && isUuid(dbProfileId)) {
        const { data, error } = await supabaseClient
          .from("coaches")
          .select("id, profile_id, username, email")
          .eq("profile_id", dbProfileId)
          .maybeSingle();

        if (error) {
          console.error("Fehler beim Suchen des Coaches per profile_id:", error);
        } else if (data) {
          matchedCoach = data;
        }
      }

      if (!matchedCoach && coach.username) {
        const { data, error } = await supabaseClient
          .from("coaches")
          .select("id, profile_id, username, email")
          .eq("username", coach.username)
          .maybeSingle();

        if (error) {
          console.error("Fehler beim Suchen des Coaches per username:", error);
        } else if (data) {
          matchedCoach = data;
        }
      }

      if (!matchedCoach && coach.email) {
        const { data, error } = await supabaseClient
          .from("coaches")
          .select("id, profile_id, username, email")
          .eq("email", coach.email)
          .maybeSingle();

        if (error) {
          console.error("Fehler beim Suchen des Coaches per email:", error);
        } else if (data) {
          matchedCoach = data;
        }
      }

      if (!matchedCoach || !matchedCoach.id) {
        alert("Dieser Coach stammt offenbar noch aus alten lokalen Demodaten und konnte keinem echten Datenbankeintrag zugeordnet werden.");
        return;
      }

      dbCoachId = matchedCoach.id;
      dbProfileId = matchedCoach.profile_id || dbProfileId || null;
    }

    const { error: coachError } = await supabaseClient
      .from("coaches")
      .delete()
      .eq("id", dbCoachId);

    if (coachError) {
      console.error("Fehler beim Löschen des Coaches:", coachError);
      alert("Coach konnte nicht gelöscht werden:\n" + (coachError.message || JSON.stringify(coachError)));
      return;
    }

    if (dbProfileId && isUuid(dbProfileId)) {
      const { error: profileError } = await supabaseClient
        .from("profiles")
        .delete()
        .eq("id", dbProfileId);

      if (profileError) {
        console.error("Fehler beim Löschen des Coach-Profils:", profileError);
        alert("Coach wurde gelöscht, aber das Profil konnte nicht gelöscht werden:\n" + (profileError.message || JSON.stringify(profileError)));
        await loadCoachesFromSupabase();
        if (state.editCoachId === coach.id) {
          state.editCoachId = null;
        }
        renderCoachesView();
        return;
      }
    }

    await loadCoachesFromSupabase();

    if (state.editCoachId === coach.id) {
      state.editCoachId = null;
    }

    renderCoachesView();
    alert(`Coach ${coachName} wurde gelöscht.`);
  } catch (err) {
    console.error("Unerwarteter Fehler beim Löschen des Coaches:", err);
    alert("Unerwarteter Fehler beim Löschen des Coaches:\n" + (err.message || err));
  }
}

async function importRosterCsv() {
  try {
    if (state.currentUser?.role !== "headAdmin") {
      alert("Nur der Hauptadmin darf einen Kader importieren.");
      return;
    }

    const fileInput = document.getElementById("rosterImportFile");
    const file = fileInput?.files?.[0];

    if (!file) {
      alert("Bitte wähle zuerst eine CSV-Datei aus.");
      return;
    }

    const rawText = await file.text();
    const text = rawText.replace(/^\uFEFF/, "").trim();

    if (!text) {
      alert("Die CSV-Datei ist leer.");
      return;
    }

    const lines = text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      alert("Die CSV-Datei enthält keine Datensätze.");
      return;
    }

    const delimiter = detectCsvDelimiter(lines[0]);
    const headers = parseCsvLine(lines[0], delimiter);
    const headerMap = mapCsvHeaders(headers);

    const missingHeaders = [];
    if (headerMap.firstName === -1) missingHeaders.push("Vorname");
    if (headerMap.lastName === -1) missingHeaders.push("Nachname");
    if (headerMap.birthday === -1) missingHeaders.push("Geburtstag");
    if (headerMap.unit === -1) missingHeaders.push("Unit");
    if (headerMap.email === -1) missingHeaders.push("E-Mail");

    if (missingHeaders.length) {
      alert(`Diese Spalten fehlen in der CSV:\n${missingHeaders.join(", ")}`);
      return;
    }

    const existingNameKeys = new Set(
      players.map(player => buildPlayerNameKey(player.firstName, player.lastName))
    );

    const seenImportNameKeys = new Set();

    let created = 0;
    let skippedDuplicates = 0;
    let skippedInvalid = 0;
    let failed = 0;
    const details = [];

    for (let i = 1; i < lines.length; i += 1) {
      const values = parseCsvLine(lines[i], delimiter);

      if (!values.some(v => String(v || "").trim())) {
        continue;
      }

      const firstName = values[headerMap.firstName]?.trim() || "";
      const lastName = values[headerMap.lastName]?.trim() || "";
      const birthday = values[headerMap.birthday]?.trim() || "";
      const unit = values[headerMap.unit]?.trim() || "";
      const email = values[headerMap.email]?.trim() || "";

      if (!firstName || !lastName || !birthday || !unit || !email) {
        skippedInvalid += 1;
        details.push(`Zeile ${i + 1}: unvollständig übersprungen`);
        continue;
      }

      const nameKey = buildPlayerNameKey(firstName, lastName);

      if (existingNameKeys.has(nameKey) || seenImportNameKeys.has(nameKey)) {
        skippedDuplicates += 1;
        details.push(`Zeile ${i + 1}: ${firstName} ${lastName} bereits vorhanden`);
        continue;
      }

      const username = buildPlayerUsername(firstName, lastName);

      const response = await fetch("/api/create-player", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          firstName,
          lastName,
          username,
          email,
          birthday,
          unit
        })
      });

      let result = null;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok) {
        failed += 1;
        details.push(`Zeile ${i + 1}: ${firstName} ${lastName} konnte nicht angelegt werden`);
        console.error("Fehler beim Import eines Spielers:", result || response.statusText);
        continue;
      }

      created += 1;
      existingNameKeys.add(nameKey);
      seenImportNameKeys.add(nameKey);
    }

    await loadPlayersFromSupabase();

    state.importSummary = [
      `Angelegt: ${created}`,
      `Übersprungen (bereits vorhanden): ${skippedDuplicates}`,
      `Übersprungen (unvollständig): ${skippedInvalid}`,
      `Fehlgeschlagen: ${failed}`,
      details.length ? `Details: ${details.join(" | ")}` : ""
    ].filter(Boolean).join(" · ");

    renderPlayersView();

    alert(`Import abgeschlossen.\nAngelegt: ${created}\nÜbersprungen: ${skippedDuplicates + skippedInvalid}\nFehlgeschlagen: ${failed}`);
  } catch (err) {
    console.error("Unerwarteter Fehler beim CSV-Import:", err);
    state.importSummary = "";
    alert("Unerwarteter Fehler beim CSV-Import:\n" + (err.message || err));
  }
}
