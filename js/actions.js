async function loadTrainingsFromSupabase() {
  const { data, error } = await supabase
    .from("trainings")
    .select("*")
    .order("training_date", { ascending: true })
    .order("training_time", { ascending: true });

  if (error) {
    console.error("Fehler beim Laden der Trainings:", error);
    return;
  }

  trainings.length = 0;

  const existingResponseKeys = new Set(Object.keys(responses));

  (data || []).forEach(row => {
    trainings.push({
      id: row.id,
      title: row.title,
      date: row.training_date,
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

  const selectedStillExists = state.selectedTrainingId && trainings.some(t => t.id === state.selectedTrainingId);
  const reportsStillExists = state.reportsTrainingId && trainings.some(t => t.id === state.reportsTrainingId);

  if (!selectedStillExists) {
    state.selectedTrainingId = trainings[0]?.id || null;
  }

  if (!reportsStillExists) {
    state.reportsTrainingId = trainings[0]?.id || null;
  }

  renderApp();
}

function setReportsSort(key) {
  if (state.reportsSort.key === key) {
    state.reportsSort.dir = state.reportsSort.dir === "asc" ? "desc" : "asc";
  } else {
    state.reportsSort = { key, dir: "asc" };
  }
  renderReportsView();
}

function changeGroupFilter(group) {
  state.filterGroup = group;
  renderApp();
}

function changeResponseFilter(value) {
  state.filterResponse = value;
  renderReportsView();
}

function changeDashboardResponseFilter(value) {
  state.dashboardResponseFilter = value;
  renderDashboardView();
}

function changeReportsTraining(trainingId) {
  state.reportsTrainingId = trainingId;
  renderReportsView();
}

function changeTrainingSelection(trainingId) {
  state.selectedTrainingId = trainingId;
  state.editingTrainingId = null;
  renderTrainingsView();
}

function importRosterCsv() {
  const fileInput = document.getElementById("rosterImportFile");

  if (!fileInput || !fileInput.files || !fileInput.files.length) {
    alert("Bitte zuerst eine CSV-Datei auswählen.");
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = function(event) {
    try {
      const csvText = String(event.target.result || "");
      const result = processRosterCsv(csvText);

      state.importSummary =
        `Importiert: ${result.imported} | Übersprungen: ${result.skipped} | Fehler: ${result.errors.length}`;

      if (result.errors.length > 0) {
        state.importSummary += ` | Details: ${result.errors.join(" / ")}`;
      }

      fileInput.value = "";
      renderPlayersView();
    } catch (error) {
      state.importSummary = "Import fehlgeschlagen. Bitte CSV-Datei prüfen.";
      renderPlayersView();
    }
  };

  reader.onerror = function() {
    state.importSummary = "Datei konnte nicht gelesen werden.";
    renderPlayersView();
  };

  reader.readAsText(file, "utf-8");
}

function processRosterCsv(csvText) {
  const rows = parseCsvRows(csvText);

  if (!rows.length) {
    throw new Error("Leere Datei");
  }

  const headers = rows[0].map(value => normalizeHeader(value));
  const expectedHeaders = ["vorname", "nachname", "geburtstag", "unit", "e-mail"];

  const headerOk = expectedHeaders.every((header, index) => headers[index] === header);
  if (!headerOk) {
    throw new Error("Ungültige Kopfzeile");
  }

  let imported = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    if (row.length === 1 && !String(row[0] || "").trim()) {
      continue;
    }

    const firstName = String(row[0] || "").trim();
    const lastName = String(row[1] || "").trim();
    const birthday = String(row[2] || "").trim();
    const unit = String(row[3] || "").trim().toUpperCase();
    const email = String(row[4] || "").trim();

    if (!firstName || !lastName || !birthday || !unit) {
      errors.push(`Zeile ${i + 1}: Pflichtfeld fehlt`);
      continue;
    }

    if (!unitOrder.includes(unit)) {
      errors.push(`Zeile ${i + 1}: Ungültige Unit ${unit}`);
      continue;
    }

    if (!isValidDateString(birthday)) {
      errors.push(`Zeile ${i + 1}: Ungültiges Geburtstag-Format`);
      continue;
    }

    if (playerExistsByName(firstName, lastName)) {
      skipped++;
      continue;
    }

    const username = generateUniqueUsername(firstName, lastName);
    const newPlayer = makePlayer(
      "p" + Date.now() + "_" + i,
      username,
      firstName,
      lastName,
      birthday,
      unit,
      []
    );

    players.push(newPlayer);

    const userRecord = createPlayerUserRecord(newPlayer);
    userRecord.email = email;
    users.push(userRecord);

    imported++;
  }

  return { imported, skipped, errors };
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isValidDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseCsvRows(csvText) {
  const text = csvText.replace(/^\uFEFF/, "");
  const lines = text
    .split(/\r?\n/)
    .filter(line => line !== "");

  return lines.map(parseCsvLine);
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result.map(value => String(value || "").trim());
}

function setPlayerResponse(trainingId, status) {
  const playerId = state.currentUser.playerId;
  const player = players.find(p => p.id === playerId);
  const training = trainings.find(t => t.id === trainingId);

  if (isPlayerLimitedForTraining(player, training)) {
    alert("Du bist für dieses Training automatisch Limited.");
    return;
  }

  if (isPlayerVoteLocked(training)) {
    alert("Die Frist zur Änderung deiner Antwort ist abgelaufen. Nur Coaches/Admins können jetzt noch ändern.");
    return;
  }

  responses[trainingId] = responses[trainingId] || {};
  responses[trainingId][playerId] = {
    status,
    updatedAt: createPlayerIdDateTime(training),
    changedOnEventDay: true
  };

  renderApp();
}

function setCoachResponse(trainingId, playerId, status) {
  const player = players.find(p => p.id === playerId);
  const training = trainings.find(t => t.id === trainingId);
  if (isPlayerLimitedForTraining(player, training)) {
    alert("Spieler ist für dieses Training aktuell Limited. Bearbeite zuerst die Limitation, falls nötig.");
    return;
  }

  responses[trainingId] = responses[trainingId] || {};
  responses[trainingId][playerId] = {
    status,
    updatedAt: createPlayerIdDateTime(training),
    changedOnEventDay: true
  };

  renderReportsView();
}

function closeCurrentLimitations(player) {
  const today = getTodayYmd();
  const yesterdayDate = parseDateOnly(today);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = toYmdLocal(yesterdayDate);

  player.injuries = (player.injuries || []).filter(lim => {
    if (!limitationIsCurrent(lim)) return true;

    if (lim.from >= today) {
      return false;
    }

    lim.durationDays = daysBetweenInclusive(lim.from, yesterday);
    return lim.durationDays >= 1;
  });

  refreshPlayerHealthStatus(player);
}

function setPlayerFit(playerId) {
  const player = players.find(p => p.id === playerId);
  closeCurrentLimitations(player);
  renderApp();
}

function saveHealthStatus() {
  const player = players.find(p => p.id === state.currentUser.playerId);
  const selectedStatus = document.getElementById("healthStatusSelect").value;
  const injuryType = document.getElementById("injuryType").value.trim();
  const injuryFrom = document.getElementById("injuryFrom").value;
  const injuryDurationDays = Number(document.getElementById("injuryDurationDays").value || 0);

  if (selectedStatus === "fit") {
    closeCurrentLimitations(player);
    renderApp();
    return;
  }

  if (!injuryType || !injuryFrom || injuryDurationDays < 1) {
    alert("Bitte Art, Startdatum und Dauer in Tagen ausfüllen.");
    return;
  }

  player.injuries = player.injuries || [];
  player.injuries.push({
    id: "inj" + Date.now(),
    from: injuryFrom,
    durationDays: injuryDurationDays,
    type: injuryType
  });

  refreshPlayerHealthStatus(player);
  renderApp();
}

function openLimitationEdit(playerId) {
  state.editingLimitationPlayerId = playerId;
  state.editingLimitationId = null;
  state.currentView = "limitations";
  renderLimitationsView();
}

function createLimitation() {
  const playerId = document.getElementById("limitationPlayer").value;
  const type = document.getElementById("limitationType").value.trim();
  const from = document.getElementById("limitationFrom").value;
  const durationDays = Number(document.getElementById("limitationDurationDays").value || 0);

  if (!playerId || !type || !from || durationDays < 1) {
    alert("Bitte Spieler, Art, Start und Dauer in Tagen ausfüllen.");
    return;
  }

  const player = players.find(p => p.id === playerId);
  if (!player.injuries) player.injuries = [];
  player.injuries.push({
    id: "inj" + Date.now(),
    type,
    from,
    durationDays
  });

  refreshPlayerHealthStatus(player);

  state.editingLimitationPlayerId = null;
  state.editingLimitationId = null;
  renderLimitationsView();
}

function startLimitationEdit(playerId, limitationId) {
  state.editingLimitationPlayerId = playerId;
  state.editingLimitationId = limitationId;
  renderLimitationsView();
}

function cancelLimitationEdit() {
  state.editingLimitationPlayerId = null;
  state.editingLimitationId = null;
  renderLimitationsView();
}

function updateLimitation() {
  const player = players.find(p => p.id === state.editingLimitationPlayerId);
  if (!player) return;
  const limitation = findLimitation(player, state.editingLimitationId);
  if (!limitation) return;

  limitation.type = document.getElementById("limitationType").value.trim();
  limitation.from = document.getElementById("limitationFrom").value;
  limitation.durationDays = Number(document.getElementById("limitationDurationDays").value || 0);

  refreshPlayerHealthStatus(player);

  state.editingLimitationPlayerId = null;
  state.editingLimitationId = null;
  renderLimitationsView();
}

function deleteLimitation(playerId, limitationId) {
  const player = players.find(p => p.id === playerId);
  if (!player) return;
  if (!confirm("Limitation wirklich löschen?")) return;

  player.injuries = (player.injuries || []).filter(l => l.id !== limitationId);
  refreshPlayerHealthStatus(player);

  renderLimitationsView();
}

async function createTraining() {
  const title = document.getElementById("trainingTitle").value.trim();
  const date = document.getElementById("trainingDate").value;
  const time = document.getElementById("trainingTime").value;
  const location = document.getElementById("trainingLocation").value.trim();
  const notes = document.getElementById("trainingNotes").value.trim();
  const voteOpensHoursBefore = Number(document.getElementById("voteOpensHoursBefore").value || 0);
  const voteClosesHoursBefore = Number(document.getElementById("voteClosesHoursBefore").value || 0);

  if (!title || !date || !time) {
    alert("Bitte mindestens Titel, Datum und Uhrzeit ausfüllen.");
    return;
  }

  const { data, error } = await supabase
    .from("trainings")
    .insert([
      {
        title,
        training_date: date,
        training_time: time,
        location,
        notes,
        vote_opens_hours_before: voteOpensHoursBefore,
        vote_closes_hours_before: voteClosesHoursBefore
      }
    ])
    .select()
    .single();

  if (error) {
    console.error("Fehler beim Erstellen des Trainings:", error);
    alert("Training konnte nicht gespeichert werden.");
    return;
  }

  state.editingTrainingId = null;
  state.selectedTrainingId = data.id;
  state.reportsTrainingId = data.id;

  await loadTrainingsFromSupabase();
  renderTrainingsView();
}

function startTrainingEdit(trainingId) {
  state.selectedTrainingId = trainingId;
  state.editingTrainingId = trainingId;
  renderTrainingsView();
}

function cancelTrainingEdit() {
  state.editingTrainingId = null;
  renderTrainingsView();
}

async function updateTraining() {
  const trainingId = state.editingTrainingId;
  if (!trainingId) return;

  const title = document.getElementById("trainingTitle").value.trim();
  const date = document.getElementById("trainingDate").value;
  const time = document.getElementById("trainingTime").value;
  const location = document.getElementById("trainingLocation").value.trim();
  const notes = document.getElementById("trainingNotes").value.trim();
  const voteOpensHoursBefore = Number(document.getElementById("voteOpensHoursBefore").value || 0);
  const voteClosesHoursBefore = Number(document.getElementById("voteClosesHoursBefore").value || 0);

  if (!title || !date || !time) {
    alert("Bitte mindestens Titel, Datum und Uhrzeit ausfüllen.");
    return;
  }

  const { error } = await supabase
    .from("trainings")
    .update({
      title,
      training_date: date,
      training_time: time,
      location,
      notes,
      vote_opens_hours_before: voteOpensHoursBefore,
      vote_closes_hours_before: voteClosesHoursBefore
    })
    .eq("id", trainingId);

  if (error) {
    console.error("Fehler beim Aktualisieren des Trainings:", error);
    alert("Training konnte nicht aktualisiert werden.");
    return;
  }

  state.editingTrainingId = null;

  await loadTrainingsFromSupabase();
  renderTrainingsView();
}

async function deleteTraining(trainingId) {
  if (state.currentUser.role !== "headAdmin") return;

  const training = trainings.find(t => t.id === trainingId);
  if (!training) return;
  if (!confirm("Training wirklich löschen: " + training.title + "?")) return;

  const { error } = await supabase
    .from("trainings")
    .delete()
    .eq("id", trainingId);

  if (error) {
    console.error("Fehler beim Löschen des Trainings:", error);
    alert("Training konnte nicht gelöscht werden.");
    return;
  }

  delete responses[trainingId];

  if (state.editingTrainingId === trainingId) state.editingTrainingId = null;
  if (state.reportsTrainingId === trainingId) state.reportsTrainingId = null;
  if (state.selectedTrainingId === trainingId) state.selectedTrainingId = null;

  await loadTrainingsFromSupabase();

  if (!state.selectedTrainingId && trainings[0]) {
    state.selectedTrainingId = trainings[0].id;
  }
  if (!state.reportsTrainingId && trainings[0]) {
    state.reportsTrainingId = trainings[0].id;
  }

  renderTrainingsView();
}

function createPlayer() {
  const firstName = document.getElementById("playerFirstName").value.trim();
  const lastName = document.getElementById("playerLastName").value.trim();
  const username = document.getElementById("playerUsername").value.trim();
  const birthday = document.getElementById("playerBirthday").value;
  const unit = document.getElementById("playerUnit").value;

  if (!firstName || !lastName || !username || !birthday || !unit) {
    alert("Bitte alle Felder ausfüllen.");
    return;
  }

  const newPlayer = makePlayer(
    "p" + Date.now(),
    username,
    firstName,
    lastName,
    birthday,
    unit,
    []
  );

  players.push(newPlayer);
  users.push(createPlayerUserRecord(newPlayer));
  renderPlayersView();
}

function startPlayerEdit(playerId) {
  state.editPlayerId = playerId;
  renderPlayersView();
}

function cancelPlayerEdit() {
  state.editPlayerId = null;
  renderPlayersView();
}

function updatePlayer() {
  const player = players.find(p => p.id === state.editPlayerId);
  if (!player) return;

  player.firstName = document.getElementById("playerFirstName").value.trim();
  player.lastName = document.getElementById("playerLastName").value.trim();
  player.username = document.getElementById("playerUsername").value.trim();
  player.birthday = document.getElementById("playerBirthday").value;
  player.unit = document.getElementById("playerUnit").value;

  syncPlayerUser(player);

  state.editPlayerId = null;
  renderPlayersView();
}

function deletePlayer(playerId) {
  if (state.currentUser.role !== "headAdmin") return;
  const player = players.find(p => p.id === playerId);
  if (!player) return;
  if (!confirm("Spieler wirklich löschen: " + fullName(player) + "?")) return;

  const index = players.findIndex(p => p.id === playerId);
  players.splice(index, 1);
  removePlayerUser(playerId);

  Object.keys(responses).forEach(trainingId => {
    if (responses[trainingId][playerId]) delete responses[trainingId][playerId];
  });

  renderPlayersView();
}

function createCoach() {
  const name = document.getElementById("coachName").value.trim();
  const username = document.getElementById("coachUsername").value.trim();
  const birthday = document.getElementById("coachBirthday").value;
  const email = document.getElementById("coachEmail").value.trim();
  const role = document.getElementById("coachRole").value;

  if (!name || !username || !birthday || !role) {
    alert("Bitte alle Pflichtfelder ausfüllen.");
    return;
  }

  const newCoach = {
    id: "c" + Date.now(),
    name,
    username,
    birthday,
    role,
    active: true,
    email
  };

  coaches.push(newCoach);
  users.push(createCoachUserRecord(newCoach));
  renderCoachesView();
}

function startCoachEdit(coachId) {
  state.editCoachId = coachId;
  renderCoachesView();
}

function cancelCoachEdit() {
  state.editCoachId = null;
  renderCoachesView();
}

function updateCoach() {
  const coach = coaches.find(c => c.id === state.editCoachId);
  if (!coach) return;

  coach.name = document.getElementById("coachName").value.trim();
  coach.username = document.getElementById("coachUsername").value.trim();
  coach.birthday = document.getElementById("coachBirthday").value;
  coach.email = document.getElementById("coachEmail").value.trim();
  coach.role = document.getElementById("coachRole").value;

  syncCoachUser(coach);

  state.editCoachId = null;
  renderCoachesView();
}

function deleteCoach(coachId) {
  if (state.currentUser.role !== "headAdmin") return;
  const coach = coaches.find(c => c.id === coachId);
  if (!coach) return;
  if (!confirm("Coach wirklich löschen: " + coach.name + "?")) return;

  const index = coaches.findIndex(c => c.id === coachId);
  coaches.splice(index, 1);
  removeCoachUser(coachId);
  renderCoachesView();
}

function sendResetLink(type, id) {
  if (state.currentUser.role !== "headAdmin") return;

  if (type === "player") {
    const player = players.find(p => p.id === id);
    const user = getPlayerUserAuth(id);
    if (!player || !user) return;
    user.password = initialPasswordFromBirthday(player.birthday);
    user.mustChangePassword = true;
    alert("Passwort wurde auf das Geburtsjahr zurückgesetzt für: " + fullName(player));
  } else {
    const coach = coaches.find(c => c.id === id);
    const user = getCoachUserAuth(id);
    if (!coach || !user) return;
    user.password = initialPasswordFromBirthday(coach.birthday);
    user.mustChangePassword = true;
    alert("Passwort wurde auf das Geburtsjahr zurückgesetzt für: " + coach.name);
  }
}

function searchPlayers() {
  state.playerSearchValue = document.getElementById("playerSearchInput").value.trim();
  state.expandedPlayerSearchId = null;
  renderPlayerSearchView();
}

function togglePlayerSearchDetails(playerId) {
  state.expandedPlayerSearchId = state.expandedPlayerSearchId === playerId ? null : playerId;
  renderPlayerSearchView();
}

function searchPlayerList() {
  state.playerListSearch = document.getElementById("playerListSearchInput").value.trim();
  state.playerListGroup = "all";
  renderPlayersView();
}

function clearPlayerListSearch() {
  state.playerListSearch = "";
  state.playerListGroup = "all";
  renderPlayersView();
}

function setPlayerListGroup(group) {
  state.playerListGroup = group;
  state.playerListSearch = "";
  renderPlayersView();
}
