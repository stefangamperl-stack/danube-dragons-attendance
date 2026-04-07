const orderedGroups = ["Offense", "Defense", "K", "QB", "OL", "RB", "WR", "TE", "DL", "LB", "DB"];
const unitOrder = ["K", "QB", "OL", "RB", "WR", "TE", "DL", "LB", "DB"];
const offenseUnits = ["QB", "OL", "RB", "WR", "TE"];
const defenseUnits = ["DL", "LB", "DB"];

function pad2(value) {
  return String(value).padStart(2, "0");
}

function parseDateOnly(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toYmdLocal(dateObj) {
  return `${dateObj.getFullYear()}-${pad2(dateObj.getMonth() + 1)}-${pad2(dateObj.getDate())}`;
}

function getTodayYmd() {
  return toYmdLocal(new Date());
}

function daysBetweenInclusive(fromDateStr, toDateStr) {
  const start = parseDateOnly(fromDateStr);
  const end = parseDateOnly(toDateStr);
  if (!start || !end) return 0;
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

function initialPasswordFromBirthday(birthday) {
  return String(birthday || "").slice(0, 4);
}

function normalizeLimitationRecord(limitation) {
  if (!limitation || typeof limitation !== "object") return null;

  const id = String(limitation.id || "");
  const type = String(limitation.type || limitation.injury_type || "").trim();
  const from = String(limitation.from || limitation.valid_from || "").trim();
  const durationDays = Number(
    limitation.durationDays ??
    limitation.duration_days ??
    0
  );

  if (!type || !from || !Number.isFinite(durationDays) || durationDays < 1) {
    return null;
  }

  return {
    id: id || `lim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    from,
    durationDays
  };
}

function normalizeLimitationsArray(limitations) {
  if (!Array.isArray(limitations)) return [];
  return limitations
    .map(normalizeLimitationRecord)
    .filter(Boolean)
    .sort((a, b) => String(b.from).localeCompare(String(a.from)));
}

function calculateLimitationEnd(fromDate, durationDays) {
  const start = parseDateOnly(fromDate);
  if (!start) return "";
  start.setDate(start.getDate() + Number(durationDays || 0) - 1);
  return toYmdLocal(start);
}

function getCurrentLimitationFromArray(limitations) {
  const today = getTodayYmd();
  return normalizeLimitationsArray(limitations).find(l => {
    const until = calculateLimitationEnd(l.from, l.durationDays);
    return l.from <= today && until >= today;
  }) || null;
}

function makePlayer(id, username, firstName, lastName, birthday, unit, limitations = []) {
  const normalizedLimitations = normalizeLimitationsArray(limitations);
  const current = getCurrentLimitationFromArray(normalizedLimitations);

  return {
    id,
    username,
    firstName,
    lastName,
    birthday,
    unit,
    active: true,
    healthStatus: current ? "injured" : "fit",
    injuryType: current ? current.type : "",
    unavailableDuration: current ? `${current.durationDays} Tage` : "",
    injuries: normalizedLimitations
  };
}

function fullName(player) {
  return `${player.firstName} ${player.lastName}`;
}

const players = [];

const coaches = [];

const users = [];

function createPlayerUserRecord(player) {
  return {
    id: "auth_" + player.id,
    username: player.username,
    password: initialPasswordFromBirthday(player.birthday),
    role: "player",
    displayName: fullName(player),
    playerId: player.id,
    email: player.email || "",
    mustChangePassword: true,
    active: player.active !== false
  };
}

function createCoachUserRecord(coach) {
  return {
    id: "auth_" + coach.id,
    username: coach.username,
    password: "test123",
    role: coach.role,
    displayName: coach.name || `${coach.first_name || ""} ${coach.last_name || ""}`.trim(),
    coachId: coach.id,
    email: coach.email || "",
    mustChangePassword: true,
    active: coach.active !== false
  };
}

players.forEach(player => users.push(createPlayerUserRecord(player)));
coaches.forEach(coach => users.push(createCoachUserRecord(coach)));

const trainings = [];

const responses = {};
trainings.forEach(t => {
  responses[t.id] = {};
});

function rebuildPlayerUsersFromPlayers() {
  for (let i = users.length - 1; i >= 0; i--) {
    if (users[i].role === "player") {
      users.splice(i, 1);
    }
  }

  players.forEach(player => {
    users.push(createPlayerUserRecord(player));
  });
}

function rebuildCoachUsersFromCoaches() {
  for (let i = users.length - 1; i >= 0; i--) {
    if (users[i].role === "adminCoach" || users[i].role === "headAdmin") {
      users.splice(i, 1);
    }
  }

  coaches.forEach(coach => {
    users.push(createCoachUserRecord(coach));
  });
}

function isPlayerLimitedForTraining(player, training) {
  if (!player || !training?.date) return false;

  const trainingDay = training.date;
  const limitations = normalizeLimitationsArray(player.injuries || []);

  return limitations.some(l => {
    const end = calculateLimitationEnd(l.from, l.durationDays);
    return trainingDay >= l.from && trainingDay <= end;
  });
}
