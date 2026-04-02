let state = {
  currentUser: JSON.parse(localStorage.getItem("dd_user") || "null"),
  currentView: "dashboard",
  reportsTrainingId: trainings[0].id,
  selectedTrainingId: trainings[0].id,
  filterGroup: "all",
  filterResponse: "all",
  dashboardResponseFilter: "all",
  editingTrainingId: null,
  playerSearchValue: "",
  expandedPlayerSearchId: null,
  reportsSort: { key: "name", dir: "asc" },
  editPlayerId: null,
  editCoachId: null,
  playerListSearch: "",
  playerListGroup: "all",
  editingLimitationPlayerId: null,
  editingLimitationId: null
};

function saveSession() {
  localStorage.setItem("dd_user", JSON.stringify(state.currentUser));
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

function formatDateTimeDisplay(dateObj) {
  const dd = String(dateObj.getDate()).padStart(2, "0");
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const yyyy = dateObj.getFullYear();
  const hh = String(dateObj.getHours()).padStart(2, "0");
  const mi = String(dateObj.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
}

function getTrainingStartDate(training) {
  return new Date(`${training.date}T${training.time}:00`);
}

function getTrainingVoteDeadline(training) {
  const start = getTrainingStartDate(training);
  return new Date(start.getTime() - training.voteClosesHoursBefore * 60 * 60 * 1000);
}

function isTrainingPast(training) {
  return new Date() > getTrainingStartDate(training);
}

function isPlayerVoteLocked(training) {
  return new Date() > getTrainingVoteDeadline(training);
}

function refreshPlayerHealthStatus(player) {
  const current = getCurrentLimitationFromArray(player.injuries || []);
  if (current) {
    player.healthStatus = "injured";
    player.injuryType = current.type;
    player.unavailableDuration = `${current.durationDays} Tage`;
  } else {
    player.healthStatus = "fit";
    player.injuryType = "";
    player.unavailableDuration = "";
  }
}

function getCurrentPlayerStatusLabel(player) {
  return player.healthStatus === "injured" ? "Limited / Verletzt" : "Fit";
}

function updateCurrentDateTime() {
  const el = document.getElementById("currentDateTime");
  if (el) {
    el.textContent = formatDateTimeDisplay(new Date());
  }
}

function sortPlayersByLastName(list) {
  return [...list].sort((a, b) => {
    const last = a.lastName.localeCompare(b.lastName);
    if (last !== 0) return last;
    return a.firstName.localeCompare(b.firstName);
  });
}

function getGroupLabelForUnit(unit) {
  if (offenseUnits.includes(unit)) return "Offense";
  if (defenseUnits.includes(unit)) return "Defense";
  return unit;
}

function getOrderedFilterOptions() {
  return orderedGroups;
}

function getPlayersForGroup(group) {
  if (group === "Offense") return players.filter(p => offenseUnits.includes(p.unit));
  if (group === "Defense") return players.filter(p => defenseUnits.includes(p.unit));
  return players.filter(p => p.unit === group);
}

function getCurrentUserAuth() {
  if (!state.currentUser) return null;
  return users.find(u => u.id === state.currentUser.id) || null;
}

function getPlayerUserAuth(playerId) {
  return users.find(u => u.playerId === playerId) || null;
}

function getCoachUserAuth(coachId) {
  return users.find(u => u.coachId === coachId) || null;
}

function syncPlayerUser(player) {
  const user = getPlayerUserAuth(player.id);
  if (!user) {
    users.push(createPlayerUserRecord(player));
    return;
  }
  user.username = player.username;
  user.displayName = fullName(player);
  user.active = player.active !== false;
}

function syncCoachUser(coach) {
  const user = getCoachUserAuth(coach.id);
  if (!user) {
    users.push(createCoachUserRecord(coach));
    return;
  }
  user.username = coach.username;
  user.role = coach.role;
  user.displayName = coach.name;
  user.email = coach.email || "";
  user.active = coach.active !== false;
}

function removePlayerUser(playerId) {
  const index = users.findIndex(u => u.playerId === playerId);
  if (index >= 0) users.splice(index, 1);
}

function removeCoachUser(coachId) {
  const index = users.findIndex(u => u.coachId === coachId);
  if (index >= 0) users.splice(index, 1);
}

function limitationIsCurrent(limitation) {
  const today = getTodayYmd();
  const until = calculateLimitationEnd(limitation.from, limitation.durationDays);
  return limitation.from <= today && until >= today;
}

function getPlayerTrainingStatus(player, trainingId) {
  const training = trainings.find(t => t.id === trainingId);
  const response = (responses[trainingId] || {})[player.id];
  if (training && isPlayerLimitedForTraining(player, training)) return "limited";
  return response ? response.status : "open";
}

function getStatusTag(status) {
  if (status === "yes") return '<span class="tag tagYes">Zusage</span>';
  if (status === "no") return '<span class="tag tagNo">Absage</span>';
  if (status === "maybe") return '<span class="tag tagMaybe">Unsicher</span>';
  if (status === "limited") return '<span class="tag tagLimited">Limited</span>';
  return '<span class="tag tagOpen">Keine Antwort</span>';
}

function getStatusCounts(trainingId, filteredPlayers) {
  return {
    yes: filteredPlayers.filter(p => getPlayerTrainingStatus(p, trainingId) === "yes").length,
    no: filteredPlayers.filter(p => getPlayerTrainingStatus(p, trainingId) === "no").length,
    maybe: filteredPlayers.filter(p => getPlayerTrainingStatus(p, trainingId) === "maybe").length,
    limited: filteredPlayers.filter(p => getPlayerTrainingStatus(p, trainingId) === "limited").length,
    open: filteredPlayers.filter(p => getPlayerTrainingStatus(p, trainingId) === "open").length
  };
}

function getUpcomingTraining() {
  const now = new Date();
  const futureTrainings = [...trainings]
    .filter(t => getTrainingStartDate(t) > now)
    .sort((a, b) => getTrainingStartDate(a) - getTrainingStartDate(b));
  return futureTrainings[0] || null;
}

function filterPlayerByGroup(player, group) {
  if (group === "all") return true;
  if (group === "Offense") return offenseUnits.includes(player.unit);
  if (group === "Defense") return defenseUnits.includes(player.unit);
  return player.unit === group;
}

function getSortedPlayers(list, sortState) {
  const copy = [...list];
  copy.sort((a, b) => {
    let av = "";
    let bv = "";

    if (sortState.key === "name") {
      av = fullName(a).toLowerCase();
      bv = fullName(b).toLowerCase();
    } else if (sortState.key === "group") {
      av = getGroupLabelForUnit(a.unit);
      bv = getGroupLabelForUnit(b.unit);
    } else if (sortState.key === "unit") {
      av = a.unit;
      bv = b.unit;
    } else if (sortState.key === "status") {
      av = getPlayerTrainingStatus(a, state.reportsTrainingId);
      bv = getPlayerTrainingStatus(b, state.reportsTrainingId);
    } else if (sortState.key === "updatedAt") {
      av = ((responses[state.reportsTrainingId] || {})[a.id]?.updatedAt) || "";
      bv = ((responses[state.reportsTrainingId] || {})[b.id]?.updatedAt) || "";
    }

    const result = String(av).localeCompare(String(bv));
    return sortState.dir === "asc" ? result : -result;
  });
  return copy;
}

function createPlayerIdDateTime(training) {
  return `${training.date} 12:00`;
}

function getCountdownString(targetDate) {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();
  if (diff <= 0) return "geschlossen";
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days > 0) parts.push(`${days}T`);
  if (hours > 0 || days > 0) parts.push(`${hours}Std`);
  parts.push(`${minutes}Min`);
  return parts.join(" ");
}

function findLimitation(player, limitationId) {
  return (player.injuries || []).find(l => l.id === limitationId);
}

function getPlayerStats(playerId) {
  let yes = 0;
  let no = 0;
  let maybe = 0;
  let limited = 0;
  let open = 0;

  const orderedTrainings = [...trainings].sort((a, b) => getTrainingStartDate(a) - getTrainingStartDate(b));
  const timeline = orderedTrainings.map(training => {
    const response = (responses[training.id] || {})[playerId];
    const player = players.find(p => p.id === playerId);
    const status = getPlayerTrainingStatus(player, training.id);

    if (status === "yes") yes++;
    else if (status === "no") no++;
    else if (status === "maybe") maybe++;
    else if (status === "limited") limited++;
    else open++;

    return {
      training,
      response,
      status
    };
  });

  return { yes, no, maybe, limited, open, timeline };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function createTraining() {
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

  const newId = "t" + Date.now();

  trainings.push({
    id: newId,
    title,
    date,
    time,
    location,
    notes,
    voteOpensHoursBefore,
    voteClosesHoursBefore
  });

  responses[newId] = {};
  state.editingTrainingId = null;
  state.selectedTrainingId = newId;
  state.reportsTrainingId = newId;
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

function updateTraining() {
  const training = trainings.find(t => t.id === state.editingTrainingId);
  if (!training) return;

  training.title = document.getElementById("trainingTitle").value.trim();
  training.date = document.getElementById("trainingDate").value;
  training.time = document.getElementById("trainingTime").value;
  training.location = document.getElementById("trainingLocation").value.trim();
  training.notes = document.getElementById("trainingNotes").value.trim();
  training.voteOpensHoursBefore = Number(document.getElementById("voteOpensHoursBefore").value || 0);
  training.voteClosesHoursBefore = Number(document.getElementById("voteClosesHoursBefore").value || 0);

  state.editingTrainingId = null;
  renderTrainingsView();
}

function deleteTraining(trainingId) {
  if (state.currentUser.role !== "headAdmin") return;
  const training = trainings.find(t => t.id === trainingId);
  if (!training) return;
  if (!confirm("Training wirklich löschen: " + training.title + "?")) return;

  const index = trainings.findIndex(t => t.id === trainingId);
  trainings.splice(index, 1);
  delete responses[trainingId];
  if (state.editingTrainingId === trainingId) state.editingTrainingId = null;
  if (state.reportsTrainingId === trainingId) state.reportsTrainingId = trainings[0]?.id || null;
  if (state.selectedTrainingId === trainingId) state.selectedTrainingId = trainings[0]?.id || null;
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

if (state.currentUser) {
  showApp();
} else {
  showLanding();
}

updateCurrentDateTime();
setInterval(updateCurrentDateTime, 30000);
setInterval(() => {
  if (!document.getElementById("appScreen").classList.contains("hidden")) {
    renderApp();
  }
}, 60000);
