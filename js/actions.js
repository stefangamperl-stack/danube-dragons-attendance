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
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
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

    if (!firstName || !lastName || !birthday || !unit) {
      alert("Bitte Vorname, Nachname, Geburtstag und Unit ausfüllen.");
      return;
    }

    const username = usernameInput || buildPlayerUsername(firstName, lastName, editPlayer.username || "");

    const { error: playerError } = await supabaseClient
      .from("players")
      .update({
        first_name: firstName,
        last_name: lastName,
        username,
        birthday,
        unit
      })
      .eq("id", editPlayer.id);

    if (playerError) {
      console.error("Fehler beim Aktualisieren des Spielers:", playerError);
      alert("Spielerdaten konnten nicht gespeichert werden:\n" + (playerError.message || JSON.stringify(playerError)));
      return;
    }

    if (editPlayer.profileId) {
      const profilePayload = {
        username,
        display_name: `${firstName} ${lastName}`
      };

      if (email) {
        profilePayload.email = email;
      }

      const { error: profileError } = await supabaseClient
        .from("profiles")
        .update(profilePayload)
        .eq("id", editPlayer.profileId);

      if (profileError) {
        console.error("Fehler beim Aktualisieren des Profils:", profileError);
        alert("Profil konnte nicht vollständig gespeichert werden:\n" + (profileError.message || JSON.stringify(profileError)));
        return;
      }
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
