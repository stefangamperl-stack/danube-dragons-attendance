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

const players = [
  makePlayer("p_k_1","kmueller","Karl","Mueller","1996-01-14","K"),
  makePlayer("p_k_2","kschmidt","Kevin","Schmidt","1997-02-10","K"),
  makePlayer("p_k_3","kbecker","Konrad","Becker","1998-03-11","K"),
  makePlayer("p_k_4","kfischer","Klaus","Fischer","1999-04-12","K"),
  makePlayer("p_k_5","kweber","Kai","Weber","2000-05-13","K"),

  makePlayer("p_qb_1","qadler","Quirin","Adler","1996-01-14","QB"),
  makePlayer("p_qb_2","qbrandt","Quentin","Brandt","1997-02-10","QB"),
  makePlayer("p_qb_3","qclaas","Quinn","Claas","1998-03-11","QB"),
  makePlayer("p_qb_4","qdorn","Quirin","Dorn","1999-04-12","QB"),
  makePlayer("p_qb_5","qengel","Quincy","Engel","2000-05-13","QB"),

  makePlayer("p_ol_1","oacker","Oliver","Acker","1996-01-14","OL"),
  makePlayer("p_ol_2","obach","Oskar","Bach","1997-02-10","OL"),
  makePlayer("p_ol_3","ocosta","Otto","Costa","1998-03-11","OL"),
  makePlayer("p_ol_4","odrexler","Oleg","Drexler","1999-04-12","OL"),
  makePlayer("p_ol_5","oegger","Otis","Egger","2000-05-13","OL"),

  makePlayer("p_rb_1","rahrer","Rene","Ahrer","1996-01-14","RB"),
  makePlayer("p_rb_2","rberger","Roman","Berger","1997-02-10","RB"),
  makePlayer("p_rb_3","rcelik","Rico","Celik","1998-03-11","RB"),
  makePlayer("p_rb_4","rdittrich","Ralf","Dittrich","1999-04-12","RB"),
  makePlayer("p_rb_5","reder","Ruben","Eder","2000-05-13","RB"),

  makePlayer("p_wr_1","wahn","Walter","Ahn","1996-01-14","WR", [
    { id: "inj_p_wr_1_old", from: "2026-03-15", durationDays: 14, type: "Testverletzung" }
  ]),
  makePlayer("p_wr_2","wbrandt","Willi","Brandt","1997-02-10","WR"),
  makePlayer("p_wr_3","wcerny","Werner","Cerny","1998-03-11","WR"),
  makePlayer("p_wr_4","wdietz","Wolf","Dietz","1999-04-12","WR"),
  makePlayer("p_wr_5","weckert","Willi","Eckert","2000-05-13","WR"),

  makePlayer("p_te_1","talmer","Thomas","Almer","1996-01-14","TE"),
  makePlayer("p_te_2","tboehm","Tobias","Boehm","1997-02-10","TE"),
  makePlayer("p_te_3","tcramer","Theo","Cramer","1998-03-11","TE"),
  makePlayer("p_te_4","tdanner","Tom","Danner","1999-04-12","TE"),
  makePlayer("p_te_5","teberl","Toni","Eberl","2000-05-13","TE"),

  makePlayer("p_dl_1","lahner","Lukas","Ahner","1996-01-14","DL"),
  makePlayer("p_dl_2","lbruckner","Leon","Bruckner","1997-02-10","DL"),
  makePlayer("p_dl_3","lcarter","Liam","Carter","1998-03-11","DL"),
  makePlayer("p_dl_4","ldobler","Lorenz","Dobler","1999-04-12","DL"),
  makePlayer("p_dl_5","lebner","Leo","Ebner","2000-05-13","DL"),

  makePlayer("p_lb_1","sgamperl","Stefan","Gamperl","1998-03-10","LB", [
    { id: "inj_p_lb_1_old", from: "2026-02-10", durationDays: 10, type: "Schulter" }
  ]),
  makePlayer("p_lb_2","lgruber","Lukas","Gruber","1997-02-10","LB"),
  makePlayer("p_lb_3","lhaas","Leon","Haas","1998-03-11","LB"),
  makePlayer("p_lb_4","lirmler","Lars","Irmler","1999-04-12","LB"),
  makePlayer("p_lb_5","ljager","Luca","Jager","2000-05-13","LB"),

  makePlayer("p_db_1","dacker","Daniel","Acker","1996-01-14","DB"),
  makePlayer("p_db_2","dbrandner","David","Brandner","1997-02-10","DB"),
  makePlayer("p_db_3","dcerwenka","Dario","Cerwenka","1998-03-11","DB"),
  makePlayer("p_db_4","ddorn","Dominik","Dorn","1999-04-12","DB"),
  makePlayer("p_db_5","deigner","Dennis","Eigner","2000-05-13","DB")
];

const coaches = [
  { id: "c1", name: "Coach Weber", username: "coachweber", birthday: "1982-04-22", role: "adminCoach", active: true, email: "coachweber@example.com" },
  { id: "c2", name: "Hauptadmin", username: "hauptadmin", birthday: "1978-09-30", role: "headAdmin", active: true, email: "hauptadmin@example.com" }
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

const trainings = [
  {
    id: "t1",
    title: "Teamtraining Dienstag",
    date: "2026-03-19",
    time: "19:00",
    location: "Sportzentrum Nord",
    notes: "Pads mitbringen",
    voteOpensHoursBefore: 72,
    voteClosesHoursBefore: 6
  },
  {
    id: "t2",
    title: "Teamtraining Donnerstag",
    date: "2026-03-21",
    time: "19:00",
    location: "Sportzentrum Nord",
    notes: "Special Teams Fokus",
    voteOpensHoursBefore: 72,
    voteClosesHoursBefore: 4
  },
  {
    id: "t3",
    title: "Gameday Walkthrough",
    date: "2026-03-25",
    time: "18:30",
    location: "Clubhouse",
    notes: "Ohne Pads",
    voteOpensHoursBefore: 48,
    voteClosesHoursBefore: 3
  },
  {
    id: "t4",
    title: "Teamtraining Sonntag",
    date: "2026-04-05",
    time: "11:00",
    location: "Sportzentrum Süd",
    notes: "Special Teams und Walkthrough",
    voteOpensHoursBefore: 72,
    voteClosesHoursBefore: 2
  },
  {
    id: "t5",
    title: "Teamtraining Dienstag",
    date: "2026-04-07",
    time: "19:30",
    location: "Sportzentrum Nord",
    notes: "Defense Fokus",
    voteOpensHoursBefore: 72,
    voteClosesHoursBefore: 5
  }
];

const responses = {};
trainings.forEach(t => responses[t.id] = {});

function isPlayerLimitedForTraining(player, training) {
  const trainingDay = training.date;
  return (player.injuries || []).some(l => {
    const end = calculateLimitationEnd(l.from, l.durationDays);
    return trainingDay >= l.from && trainingDay <= end;
  });
}

function seedResponses() {
  const statuses = ["yes", "no", "maybe", "open"];
  trainings.forEach((training, tIndex) => {
    players.forEach((player, pIndex) => {
      if (isPlayerLimitedForTraining(player, training)) return;
      const status = statuses[(pIndex + tIndex) % statuses.length];
      if (status === "open") return;
      responses[training.id][player.id] = {
        status,
        updatedAt: `${training.date} ${String((8 + (pIndex % 10))).padStart(2, "0")}:00`,
        changedOnEventDay: pIndex % 7 === 0
      };
    });
  });
}
seedResponses();
