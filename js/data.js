const orderedGroups = ["Offense", "Defense", "K", "QB", "OL", "RB", "WR", "TE", "DL", "LB", "DB"];
const unitOrder = ["K", "QB", "OL", "RB", "WR", "TE", "DL", "LB", "DB"];
const offenseUnits = ["QB", "OL", "RB", "WR", "TE"];
const defenseUnits = ["DL", "LB", "DB"];

function pad2(value) {
  return String(value).padStart(2, "0");
}

function parseDateOnly(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
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

function calculateLimitationEnd(fromDate, durationDays) {
  const start = parseDateOnly(fromDate);
  if (!start) return "";
  start.setDate(start.getDate() + Number(durationDays || 0) - 1);
  return toYmdLocal(start);
}

function getCurrentLimitationFromArray(limitations) {
  const today = getTodayYmd();
  return (limitations || []).find(l => {
    const until = calculateLimitationEnd(l.from, l.durationDays);
    return l.from <= today && until >= today;
  }) || null;
}

function makePlayer(id, username, firstName, lastName, birthday, unit, limitations = []) {
  const current = getCurrentLimitationFromArray(limitations);
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
    injuries: limitations
  };
}

function fullName(player) {
  return player.firstName + " " + player.lastName;
}

const players = [];

const coaches = [
  {
    id: "c1",
    name: "Coach Hönig",
    username: "mhoenig",
    birthday: "1982-04-22",
    role: "adminCoach",
    active: true,
    email: "mhoenig@example.com"
  },
  {
    id: "c2",
    name: "Hauptadmin",
    username: "hauptadmin",
    birthday: "1995-06-24",
    role: "headAdmin",
    active: true,
    email: "hauptadmin@example.com"
  }
];

const users = [];

function createPlayerUserRecord(player) {
  return {
    id: "auth_" + player.id,
    username: player.username,
    password: initialPasswordFromBirthday(player.birthday),
    role: "player",
    displayName: fullName(player),
    playerId: player.id,
    email: "",
    mustChangePassword: true,
    active: player.active !== false
  };
}

function createCoachUserRecord(coach) {
  return {
    id: "auth_" + coach.id,
    username: coach.username,
    password: initialPasswordFromBirthday(coach.birthday),
    role: coach.role,
    displayName: coach.name,
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

function isPlayerLimitedForTraining(player, training) {
  const trainingDay = training.date;
  return (player.injuries || []).some(l => {
    const end = calculateLimitationEnd(l.from, l.durationDays);
    return trainingDay >= l.from && trainingDay <= end;
  });
}
