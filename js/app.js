let state = {
  currentUser: JSON.parse(localStorage.getItem("dd_user") || "null"),
  currentView: "dashboard",
  reportsTrainingId: trainings[0]?.id || null,
  selectedTrainingId: trainings[0]?.id || null,
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
  editingLimitationId: null,
  importSummary: null
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
  const coachDisplayName =
    coach.name ||
    `${coach.first_name || ""} ${coach.last_name || ""}`.trim();

  if (!user) {
    users.push(createCoachUserRecord({
      ...coach,
      name: coachDisplayName
    }));
    return;
  }
  user.username = coach.username;
  user.role = coach.role;
  user.displayName = coachDisplayName;
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
  if (!player) return "open";
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

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeForLogin(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function playerExistsByName(firstName, lastName) {
  const normalizedFirst = normalizeText(firstName);
  const normalizedLast = normalizeText(lastName);

  return players.some(player =>
    normalizeText(player.firstName) === normalizedFirst &&
    normalizeText(player.lastName) === normalizedLast
  );
}

function usernameExists(username) {
  const normalizedUsername = normalizeForLogin(username);
  return users.some(user => normalizeForLogin(user.username) === normalizedUsername);
}

function generateUniqueUsername(firstName, lastName) {
  const first = normalizeForLogin(firstName);
  const last = normalizeForLogin(lastName);

  let base = `${first.charAt(0)}${last}`;
  if (!base) {
    base = `user${Date.now()}`;
  }

  if (!usernameExists(base)) {
    return base;
  }

  let counter = 2;
  while (usernameExists(`${base}${counter}`)) {
    counter++;
  }

  return `${base}${counter}`;
}

function isEditingAnyForm() {
  return Boolean(
    state.editingTrainingId ||
    state.editPlayerId ||
    state.editCoachId ||
    state.editingLimitationId
  );
}

async function hydrateCurrentUserFromSupabase() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error("Fehler beim Lesen der Session:", error);
    state.currentUser = null;
    localStorage.removeItem("dd_user");
    return;
  }

  const session = data?.session;
  if (!session?.user) {
    state.currentUser = null;
    localStorage.removeItem("dd_user");
    return;
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (profileError || !profile) {
    console.error("Fehler beim Laden des Profils:", profileError);
    state.currentUser = null;
    localStorage.removeItem("dd_user");
    return;
  }

  let playerId = null;
  let coachId = null;

  if (profile.role === "player") {
    const { data: playerData, error: playerError } = await supabaseClient
      .from("players")
      .select("id")
      .eq("profile_id", profile.id)
      .single();

    if (!playerError && playerData) {
      playerId = playerData.id;
    }
  }

  if (profile.role === "adminCoach" || profile.role === "headAdmin") {
    const { data: coachData, error: coachError } = await supabaseClient
      .from("coaches")
      .select("id")
      .eq("profile_id", profile.id)
      .single();

    if (!coachError && coachData) {
      coachId = coachData.id;
    }
  }

  state.currentUser = {
    id: profile.id,
    username: profile.username,
    role: profile.role,
    displayName: profile.display_name,
    email: profile.email || "",
    mustChangePassword: profile.must_change_password ?? true,
    playerId,
    coachId
  };

  saveSession();
}

async function loadInitialAppData() {
  try {
    await hydrateCurrentUserFromSupabase();

    if (!state.currentUser) {
      showLanding();
      return;
    }

    await loadTrainingsFromSupabase();
    await loadPlayersFromSupabase();
    await loadCoachesFromSupabase();
    await loadResponsesFromSupabase();

    if (
      (state.currentUser.role === "adminCoach" || state.currentUser.role === "headAdmin") &&
      !state.currentUser.coachId
    ) {
      const ownCoach = coaches.find(c => c.profile_id === state.currentUser.id);
      if (ownCoach) {
        state.currentUser.coachId = ownCoach.id;
        saveSession();
      }
    }

    renderApp();
    showApp();
  } catch (error) {
    console.error("Fehler beim initialen Laden der App-Daten:", error);
    showLanding();
  }
}

Promise.resolve(loadInitialAppData()).catch(error => {
  console.error("Fehler beim initialen Laden:", error);
});

updateCurrentDateTime();
setInterval(updateCurrentDateTime, 30000);

setInterval(() => {
  const appScreen = document.getElementById("appScreen");
  if (!appScreen || appScreen.classList.contains("hidden")) {
    return;
  }

  if (isEditingAnyForm()) {
    updateCurrentDateTime();
    return;
  }

  renderApp();
}, 60000);
