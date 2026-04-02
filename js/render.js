function renderStatusSummary(counts) {
  return `
    <div class="statusSummary">
      <div class="statusSummaryRow"><span>Zusage</span><strong>${counts.yes}</strong></div>
      <div class="statusSummaryRow"><span>Absage</span><strong>${counts.no}</strong></div>
      <div class="statusSummaryRow"><span>Unsicher</span><strong>${counts.maybe}</strong></div>
      <div class="statusSummaryRow"><span>Limited</span><strong>${counts.limited}</strong></div>
      <div class="statusSummaryRow"><span>Keine Antwort</span><strong>${counts.open}</strong></div>
    </div>
  `;
}

function renderMustChangePasswordNotice() {
  const auth = getCurrentUserAuth();
  if (!auth || !auth.mustChangePassword) return "";
  return `
    <div class="noticeBox">
      Du verwendest noch dein Initialpasswort. Bitte ändere es im Profil auf ein eigenes Passwort.
    </div>
  `;
}

function renderNav() {
  const nav = document.getElementById("nav");
  const role = state.currentUser.role;

  let items = [
    { key: "dashboard", label: "Dashboard" },
    { key: "profile", label: "Mein Profil" }
  ];

  if (role === "player") {
    items.push(
      { key: "trainings", label: "Meine Trainings" },
      { key: "health", label: "Mein Status" }
    );
  }

  if (role === "adminCoach" || role === "headAdmin") {
    items.push(
      { key: "trainings", label: "Trainings bearbeiten" },
      { key: "players", label: "Spielermanagement" },
      { key: "reports", label: "Auswertung" },
      { key: "limitations", label: "Limitations" },
      { key: "playerSearch", label: "Spielersuche" },
      { key: "statistics", label: "Statistik" }
    );
  }

  if (role === "headAdmin") {
    items.push(
      { key: "coaches", label: "Coaches" }
    );
  }

  nav.innerHTML = items.map(item =>
    `<button onclick="setView('${item.key}')">${item.label}</button>`
  ).join("");
}

function renderApp() {
  updateCurrentDateTime();
  players.forEach(refreshPlayerHealthStatus);
  renderNav();
  document.getElementById("roleBadge").textContent = state.currentUser.role;
  if (state.currentUser.role === "player") {
    renderPlayerView();
  } else {
    renderCoachView();
  }
}

function renderOwnProfileView() {
  const content = document.getElementById("content");
  document.getElementById("screenTitle").textContent = "Mein Profil";
  document.getElementById("screenSubtitle").textContent = "Eigene Daten und Passwort";

  if (state.currentUser.role === "player") {
    const player = players.find(p => p.id === state.currentUser.playerId);

    content.innerHTML = `
      ${renderMustChangePasswordNotice()}
      <div class="twoCol">
        <div class="card">
          <h2>${fullName(player)}</h2>
          <p><strong>Loginname:</strong> ${player.username}</p>
          <p><strong>Geburtstag:</strong> ${formatDateDisplay(player.birthday)}</p>
          <p><strong>Unit:</strong> ${player.unit}</p>
          <p><strong>Gruppe:</strong> ${getGroupLabelForUnit(player.unit)}</p>
          <p><strong>Gesundheit:</strong> ${getCurrentPlayerStatusLabel(player)}</p>
        </div>

        <div class="card">
          <h2>Passwort ändern</h2>
          <div class="field">
            <label>Aktuelles Passwort</label>
            <input id="currentPassword" class="input" type="password" placeholder="Aktuelles Passwort" />
          </div>
          <div class="field">
            <label>Neues Passwort</label>
            <input id="newPassword" class="input" type="password" placeholder="Neues Passwort" />
          </div>
          <div class="field">
            <label>Neues Passwort wiederholen</label>
            <input id="confirmPassword" class="input" type="password" placeholder="Neues Passwort wiederholen" />
          </div>
          <button class="button" onclick="changeOwnPassword()">Passwort speichern</button>
          <p class="smallMuted" style="margin-top:12px;">
            Initialpasswort war dein Geburtsjahr.
          </p>
        </div>
      </div>
    `;
    return;
  }

  const coach = coaches.find(c => c.id === state.currentUser.coachId);

  content.innerHTML = `
      ${renderMustChangePasswordNotice()}
      <div class="twoCol">
        <div class="card">
          <h2>${coach.name}</h2>
          <p><strong>Loginname:</strong> ${coach.username}</p>
          <p><strong>Geburtstag:</strong> ${formatDateDisplay(coach.birthday)}</p>
          <p><strong>E-Mail:</strong> ${coach.email || "-"}</p>
          <p><strong>Rolle:</strong> ${coach.role}</p>
        </div>

        <div class="card">
          <h2>Passwort ändern</h2>
          <div class="field">
            <label>Aktuelles Passwort</label>
            <input id="currentPassword" class="input" type="password" placeholder="Aktuelles Passwort" />
          </div>
          <div class="field">
            <label>Neues Passwort</label>
            <input id="newPassword" class="input" type="password" placeholder="Neues Passwort" />
          </div>
          <div class="field">
            <label>Neues Passwort wiederholen</label>
            <input id="confirmPassword" class="input" type="password" placeholder="Neues Passwort wiederholen" />
          </div>
          <button class="button" onclick="changeOwnPassword()">Passwort speichern</button>
          <p class="smallMuted" style="margin-top:12px;">
            Initialpasswort war dein Geburtsjahr.
          </p>
        </div>
      </div>
    `;
}

function renderPlayerView() {
  const player = players.find(p => p.id === state.currentUser.playerId);
  const content = document.getElementById("content");

  if (state.currentView === "health") {
    document.getElementById("screenTitle").textContent = "Mein Status";
    document.getElementById("screenSubtitle").textContent = "Aktueller Status und bisherige Limitations";

    const pastLimitations = (player.injuries || [])
      .filter(l => !limitationIsCurrent(l))
      .sort((a, b) => b.from.localeCompare(a.from));

    content.innerHTML = `
      ${renderMustChangePasswordNotice()}
      <div class="card">
        <div class="smallMuted">Aktueller Status</div>
        <div class="statusBig">${getCurrentPlayerStatusLabel(player)}</div>
        <p style="margin-top: 12px;"><strong>Art:</strong> ${player.injuryType || "Keine aktive Limitation"}</p>
        <p><strong>Dauer:</strong> ${player.unavailableDuration || "-"}</p>

        <div class="field">
          <label>Status</label>
          <select id="healthStatusSelect" class="select">
            <option value="fit" ${player.healthStatus === "fit" ? "selected" : ""}>Fit</option>
            <option value="injured" ${player.healthStatus === "injured" ? "selected" : ""}>Verletzt/Krank</option>
          </select>
        </div>

        <div class="field">
          <label>Art der Limitation</label>
          <input id="injuryType" class="input" value="${player.injuryType || ""}" placeholder="z. B. Schulter, Knie, Krankheit" />
        </div>

        <div class="field">
          <label>Gültig seit</label>
          <input id="injuryFrom" class="input" type="date" value="${getTodayYmd()}" />
        </div>

        <div class="field">
          <label>Dauer in Tagen</label>
          <input id="injuryDurationDays" class="input" type="number" min="1" value="7" />
        </div>

        <button class="button" onclick="saveHealthStatus()">Speichern</button>
      </div>

      <div class="card" style="margin-top: 24px;">
        <h2>Vergangene Limitations</h2>
        ${pastLimitations.length === 0 ? `<p class="smallMuted">Keine vergangenen Limitations gespeichert.</p>` : pastLimitations.map(l => `
          <div style="border:1px solid #214235; border-radius:12px; padding:12px; margin-bottom:12px;">
            <p><strong>Art:</strong> ${l.type}</p>
            <p><strong>Von:</strong> ${formatDateDisplay(l.from)}</p>
            <p><strong>Dauer:</strong> ${l.durationDays} Tage</p>
            <p><strong>Bis:</strong> ${formatDateDisplay(calculateLimitationEnd(l.from, l.durationDays))}</p>
          </div>
        `).join("")}
      </div>
    `;
    return;
  }

  if (state.currentView === "profile") {
    renderOwnProfileView();
    return;
  }

  if (state.currentView === "trainings") {
    document.getElementById("screenTitle").textContent = "Meine Trainings";
    document.getElementById("screenSubtitle").textContent = "Kompakte chronologische Liste";

    const orderedTrainings = [...trainings].sort((a, b) => getTrainingStartDate(b) - getTrainingStartDate(a));

    content.innerHTML = `
      ${renderMustChangePasswordNotice()}
      <div class="card">
        <div class="compactList">
          ${orderedTrainings.map(training => `
            <div class="compactItem">
              <div class="compactLeft">
                <strong>${formatDateDisplay(training.date)}</strong>
                <span class="smallMuted">${training.time}</span>
              </div>
              <div>${getStatusTag(getPlayerTrainingStatus(player, training.id))}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
    return;
  }

  document.getElementById("screenTitle").textContent = "Spieler Dashboard";
  document.getElementById("screenSubtitle").textContent = "Bis zu 3 kommende Trainings mit direkter Rückmeldung";

  const upcomingTrainings = [...trainings]
    .filter(t => getTrainingStartDate(t) > new Date())
    .sort((a, b) => getTrainingStartDate(a) - getTrainingStartDate(b))
    .slice(0, 3);

  if (!upcomingTrainings.length) {
    content.innerHTML = `${renderMustChangePasswordNotice()}<div class="card"><p>Keine kommenden Trainings gefunden.</p></div>`;
    return;
  }

  const cards = upcomingTrainings.map(training => {
    const status = getPlayerTrainingStatus(player, training.id);
    const limited = status === "limited";
    const locked = isPlayerVoteLocked(training);
    const deadline = getTrainingVoteDeadline(training);

    return `
      <div class="card">
        <h2>${training.title}</h2>
        <p><strong>Datum:</strong> ${formatDateDisplay(training.date)} um ${training.time}</p>
        <p><strong>Ort:</strong> ${training.location}</p>
        <p class="smallMuted">${training.notes}</p>
        <p><strong>Status:</strong> ${getStatusTag(status)}</p>

        <div class="deadlineBox">
          <div><strong>Änderungsfrist:</strong> ${formatDateDisplay(training.date)} ${String(deadline.getHours()).padStart(2, "0")}:${String(deadline.getMinutes()).padStart(2, "0")}</div>
          <div class="smallMuted"><strong>Timer:</strong> ${getCountdownString(deadline)}</div>
        </div>

        ${limited ? `<p class="smallMuted" style="margin-top:12px;">Du bist für dieses Training automatisch Limited.</p>` : ""}
        ${!limited && locked ? `<p class="smallMuted" style="margin-top:12px;">Die Abstimmung ist geschlossen. Nur Coaches/Admins können jetzt noch ändern.</p>` : ""}

        ${!limited && !locked ? `
          <div class="statusButtons">
            <button class="secondaryButton" onclick="setPlayerResponse('${training.id}','yes')">Zusage</button>
            <button class="secondaryButton" onclick="setPlayerResponse('${training.id}','maybe')">Unsicher</button>
            <button class="secondaryButton" onclick="setPlayerResponse('${training.id}','no')">Absage</button>
          </div>
        ` : ""}
      </div>
    `;
  }).join("");

  content.innerHTML = `${renderMustChangePasswordNotice()}${cards}`;
}

function renderCoachView() {
  if (state.currentView === "profile") {
    renderOwnProfileView();
    return;
  }

  if (state.currentView === "players") {
    renderPlayersView();
    return;
  }

  if (state.currentView === "trainings") {
    renderTrainingsView();
    return;
  }

  if (state.currentView === "reports") {
    renderReportsView();
    return;
  }

  if (state.currentView === "limitations") {
    renderLimitationsView();
    return;
  }

  if (state.currentView === "playerSearch") {
    renderPlayerSearchView();
    return;
  }

  if (state.currentView === "statistics") {
    renderStatisticsView();
    return;
  }

  if (state.currentView === "coaches" && state.currentUser.role === "headAdmin") {
    renderCoachesView();
    return;
  }

  renderDashboardView();
}

function renderDashboardView() {
  const content = document.getElementById("content");
  document.getElementById("screenTitle").textContent = "Coach Dashboard";
  document.getElementById("screenSubtitle").textContent = "Nur nächstes kommendes Training";

  const selectedTraining = getUpcomingTraining();
  if (!selectedTraining) {
    content.innerHTML = `${renderMustChangePasswordNotice()}<div class="card"><p>Kein kommendes Training gefunden.</p></div>`;
    return;
  }

  let filteredPlayers = players.filter(p => filterPlayerByGroup(p, state.filterGroup));
  if (state.dashboardResponseFilter !== "all") {
    filteredPlayers = filteredPlayers.filter(p => getPlayerTrainingStatus(p, selectedTraining.id) === state.dashboardResponseFilter);
  }

  const counts = getStatusCounts(selectedTraining.id, filteredPlayers);
  const summaryCards = renderDashboardUnitSummary(selectedTraining.id);

  content.innerHTML = `
    ${renderMustChangePasswordNotice()}
    <div class="grid unitSummary">
      ${summaryCards}
    </div>

    <div class="twoCol">
      <div class="card">
        <h2>Kommendes Training</h2>
        <p><strong>${selectedTraining.title}</strong></p>
        <p>${formatDateDisplay(selectedTraining.date)} um ${selectedTraining.time}</p>
        <p>${selectedTraining.location}</p>
        <p class="smallMuted">${selectedTraining.notes}</p>
        <p class="smallMuted">Abstimmung: ${selectedTraining.voteOpensHoursBefore}h bis ${selectedTraining.voteClosesHoursBefore}h vor Beginn</p>
      </div>

      <div class="card">
        <h2>Filter</h2>
        <div class="field">
          <label>Gruppe / Unit</label>
          <select class="select" onchange="changeGroupFilter(this.value)">
            <option value="all">Alle</option>
            ${getOrderedFilterOptions().map(g => `<option value="${g}" ${g === state.filterGroup ? "selected" : ""}>${g}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Antwortstatus</label>
          <select class="select" onchange="changeDashboardResponseFilter(this.value)">
            <option value="all" ${state.dashboardResponseFilter === "all" ? "selected" : ""}>Alle</option>
            <option value="yes" ${state.dashboardResponseFilter === "yes" ? "selected" : ""}>Zusage</option>
            <option value="no" ${state.dashboardResponseFilter === "no" ? "selected" : ""}>Absage</option>
            <option value="maybe" ${state.dashboardResponseFilter === "maybe" ? "selected" : ""}>Unsicher</option>
            <option value="limited" ${state.dashboardResponseFilter === "limited" ? "selected" : ""}>Limited</option>
            <option value="open" ${state.dashboardResponseFilter === "open" ? "selected" : ""}>Keine Antwort</option>
          </select>
        </div>
        ${renderStatusSummary(counts)}
      </div>
    </div>

    ${state.filterGroup !== "all" ? `
      <div class="card">
        <h2>${state.filterGroup} · Detailübersicht</h2>
        <div class="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Spieler</th>
                <th>Status</th>
                <th>Gesundheit</th>
              </tr>
            </thead>
            <tbody>
              ${sortPlayersByLastName(filteredPlayers).map(player => `
                <tr>
                  <td>${fullName(player)}</td>
                  <td>${getStatusTag(getPlayerTrainingStatus(player, selectedTraining.id))}</td>
                  <td>${getCurrentPlayerStatusLabel(player)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    ` : ""}
  `;
}

function renderPlayersView() {
  const content = document.getElementById("content");
  document.getElementById("screenTitle").textContent = "Spielermanagement";
  document.getElementById("screenSubtitle").textContent = "Suche nach Spieler oder klicke auf eine Gruppe / Unit";

  const editPlayer = state.editPlayerId ? players.find(p => p.id === state.editPlayerId) : null;

  let filtered = [...players];
  if (state.playerListSearch.trim()) {
    const search = state.playerListSearch.trim().toLowerCase();
    filtered = filtered.filter(p => fullName(p).toLowerCase().includes(search));
  } else if (state.playerListGroup !== "all") {
    filtered = filtered.filter(p => filterPlayerByGroup(p, state.playerListGroup));
  }

  filtered = sortPlayersByLastName(filtered);

  content.innerHTML = `
    ${renderMustChangePasswordNotice()}
    <div class="twoCol">
      <div>
        <div class="card">
          <h2>${editPlayer ? "Spieler bearbeiten" : "Spieler anlegen"}</h2>
          <div class="field"><label>Vorname</label><input id="playerFirstName" class="input" value="${editPlayer ? escapeHtml(editPlayer.firstName) : ""}" placeholder="Vorname" /></div>
          <div class="field"><label>Nachname</label><input id="playerLastName" class="input" value="${editPlayer ? escapeHtml(editPlayer.lastName) : ""}" placeholder="Nachname" /></div>
          <div class="field"><label>Loginname</label><input id="playerUsername" class="input" value="${editPlayer ? escapeHtml(editPlayer.username || "") : ""}" placeholder="z. B. sgamperl" /></div>
          <div class="field"><label>E-Mail</label><input id="playerEmail" class="input" type="email" value="${editPlayer ? escapeHtml(editPlayer.email || "") : ""}" placeholder="spieler@example.com" /></div>
          <div class="field"><label>Geburtstag</label><input id="playerBirthday" class="input" type="date" value="${editPlayer ? editPlayer.birthday : ""}" /></div>
          <div class="field">
            <label>Unit</label>
            <select id="playerUnit" class="select">
              ${unitOrder.map(u => `<option value="${u}" ${editPlayer && editPlayer.unit === u ? "selected" : ""}>${u}</option>`).join("")}
            </select>
          </div>
          <div class="rowActions">
            <button class="button" onclick="${editPlayer ? "updatePlayer()" : "createPlayer()"}">${editPlayer ? "Spieler speichern" : "Spieler anlegen"}</button>
            ${editPlayer ? `<button class="secondaryButton" onclick="cancelPlayerEdit()">Abbrechen</button>` : ""}
          </div>
          <p class="smallMuted" style="margin-top:12px;">
            Initialpasswort für neue Spieler ist automatisch das Geburtsjahr.
          </p>
        </div>

        <div class="card" style="margin-top:16px;">
          <h2>Kader importieren</h2>
          <p class="smallMuted">
            Erwartete Spalten: Vorname | Nachname | Geburtstag | Unit | E-Mail
          </p>

          <div class="field">
            <label>CSV-Datei auswählen</label>
            <input id="rosterImportFile" class="input" type="file" accept=".csv" />
          </div>

          <div class="rowActions">
            <button class="button" onclick="importRosterCsv()">Import starten</button>
          </div>

          ${state.importSummary ? `
            <div class="deadlineBox" style="margin-top:12px;">
              <div><strong>Import-Ergebnis</strong></div>
              <div class="smallMuted" style="margin-top:8px;">${escapeHtml(state.importSummary)}</div>
            </div>
          ` : ""}
        </div>
      </div>

      <div class="card">
        <h2>Spieler finden</h2>
        <div class="field">
          <label>Suche nach Name</label>
          <input id="playerListSearchInput" class="input" value="${escapeHtml(state.playerListSearch)}" placeholder="z. B. Stefan" />
        </div>
        <div class="rowActions">
          <button class="button" onclick="searchPlayerList()">Suchen</button>
          <button class="secondaryButton" onclick="clearPlayerListSearch()">Zurücksetzen</button>
        </div>

        <div style="margin-top: 16px;">
          <div class="smallMuted" style="margin-bottom: 10px;">Oder nach Gruppe / Unit filtern</div>
          <div class="unitPills">
            <button class="unitPill ${state.playerListGroup === "all" ? "active" : ""}" onclick="setPlayerListGroup('all')">Alle</button>
            ${getOrderedFilterOptions().map(g => `<button class="unitPill ${state.playerListGroup === g ? "active" : ""}" onclick="setPlayerListGroup('${g}')">${g}</button>`).join("")}
          </div>
        </div>

        <div class="tableWrap" style="margin-top: 16px;">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Gruppe</th>
                <th>Unit</th>
                <th>Geburtstag</th>
                <th>Gesundheit</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(p => `
                <tr>
                  <td>${fullName(p)}</td>
                  <td>${getGroupLabelForUnit(p.unit)}</td>
                  <td>${p.unit}</td>
                  <td>${formatDateDisplay(p.birthday)}</td>
                  <td>${getCurrentPlayerStatusLabel(p)}</td>
                  <td>
                    <div class="rowActions">
                      <button class="secondaryButton" onclick="startPlayerEdit('${p.id}')">Bearbeiten</button>
                      <button class="warnButton" onclick="openLimitationEdit('${p.id}')">Limitation</button>
                      ${state.currentUser.role === "headAdmin" ? `<button class="secondaryButton" onclick="sendResetLink('player','${p.id}')">Reset</button>` : ""}
                      ${state.currentUser.role === "headAdmin" ? `<button class="dangerButton" onclick="deletePlayer('${p.id}')">Löschen</button>` : ""}
                    </div>
                  </td>
                </tr>
              `).join("")}
              ${filtered.length === 0 ? `<tr><td colspan="6">Keine Spieler gefunden.</td></tr>` : ""}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderTrainingsView() {
  const content = document.getElementById("content");
  document.getElementById("screenTitle").textContent = "Trainings bearbeiten";
  document.getElementById("screenSubtitle").textContent = "Training auswählen, dann bearbeiten oder löschen";

  const orderedTrainings = [...trainings].sort((a, b) => getTrainingStartDate(a) - getTrainingStartDate(b));
  const selectedTraining = orderedTrainings.find(t => t.id === state.selectedTrainingId) || orderedTrainings[0];
  if (selectedTraining) {
    state.selectedTrainingId = selectedTraining.id;
  }

  content.innerHTML = `
    ${renderMustChangePasswordNotice()}
    <div class="twoCol">
      <div class="card">
        <h2>Training auswählen</h2>
        <div class="field">
          <label>Trainingsliste</label>
          <select id="trainingSelectDropdown" class="select" onchange="changeTrainingSelection(this.value)">
            ${orderedTrainings.map(t => `<option value="${t.id}" ${selectedTraining && t.id === selectedTraining.id ? "selected" : ""}>${formatDateDisplay(t.date)} · ${t.title}</option>`).join("")}
          </select>
        </div>

        ${selectedTraining ? `
          <div class="rowActions">
            <button class="secondaryButton" onclick="startTrainingEdit('${selectedTraining.id}')">Bearbeiten</button>
            ${state.currentUser.role === "headAdmin" ? `<button class="dangerButton" onclick="deleteTraining('${selectedTraining.id}')">Löschen</button>` : ""}
          </div>
        ` : ""}
      </div>

      <div class="card">
        <h2>${state.editingTrainingId ? "Training bearbeiten" : "Training erstellen"}</h2>

        <div class="field">
          <label>Titel</label>
          <input id="trainingTitle" class="input" placeholder="z. B. Teamtraining Dienstag" value="${state.editingTrainingId && selectedTraining ? escapeHtml(selectedTraining.title) : ""}" />
        </div>

        <div class="field">
          <label>Datum</label>
          <input id="trainingDate" class="input" type="date" value="${state.editingTrainingId && selectedTraining ? selectedTraining.date : ""}" />
        </div>

        <div class="field">
          <label>Uhrzeit</label>
          <input id="trainingTime" class="input" type="time" value="${state.editingTrainingId && selectedTraining ? selectedTraining.time : ""}" />
        </div>

        <div class="field">
          <label>Ort</label>
          <input id="trainingLocation" class="input" placeholder="Sportzentrum Nord" value="${state.editingTrainingId && selectedTraining ? escapeHtml(selectedTraining.location) : ""}" />
        </div>

        <div class="field">
          <label>Notizen</label>
          <textarea id="trainingNotes" class="textarea" placeholder="Pads mitbringen">${state.editingTrainingId && selectedTraining ? escapeHtml(selectedTraining.notes) : ""}</textarea>
        </div>

        <div class="field">
          <label>Abstimmung startet X Stunden vor Beginn</label>
          <input id="voteOpensHoursBefore" class="input" type="number" min="0" value="${state.editingTrainingId && selectedTraining ? selectedTraining.voteOpensHoursBefore : 72}" />
        </div>

        <div class="field">
          <label>Abstimmung endet X Stunden vor Beginn</label>
          <input id="voteClosesHoursBefore" class="input" type="number" min="0" value="${state.editingTrainingId && selectedTraining ? selectedTraining.voteClosesHoursBefore : 6}" />
        </div>

        <div class="rowActions">
          <button class="button" onclick="${state.editingTrainingId ? "updateTraining()" : "createTraining()"}">${state.editingTrainingId ? "Training speichern" : "Training erstellen"}</button>
          ${state.editingTrainingId ? `<button class="secondaryButton" onclick="cancelTrainingEdit()">Abbrechen</button>` : ""}
        </div>
      </div>
    </div>
  `;
}

function renderReportsView() {
  const content = document.getElementById("content");
  document.getElementById("screenTitle").textContent = "Auswertung";
  document.getElementById("screenSubtitle").textContent = "Kommende, vergangene und zukünftige Trainings mit bearbeitbaren Antworten";

  const orderedTrainings = [...trainings].sort((a, b) => getTrainingStartDate(a) - getTrainingStartDate(b));
  const selectedTraining = orderedTrainings.find(t => t.id === state.reportsTrainingId) || orderedTrainings[0];

  let filteredPlayers = players.filter(p => filterPlayerByGroup(p, state.filterGroup));
  if (state.filterResponse !== "all") {
    filteredPlayers = filteredPlayers.filter(p => getPlayerTrainingStatus(p, selectedTraining.id) === state.filterResponse);
  }
  filteredPlayers = getSortedPlayers(filteredPlayers, state.reportsSort);

  const counts = getStatusCounts(selectedTraining.id, filteredPlayers);

  content.innerHTML = `
    ${renderMustChangePasswordNotice()}
    <div class="card" style="margin-bottom: 24px;">
      <h2>Trainingsdatum auswählen</h2>
      <div class="field">
        <label>Datum</label>
        <select class="select" onchange="changeReportsTraining(this.value)">
          ${orderedTrainings.map(t => `<option value="${t.id}" ${t.id === selectedTraining.id ? "selected" : ""}>${formatDateDisplay(t.date)} · ${t.title}</option>`).join("")}
        </select>
      </div>
      <p><strong>${selectedTraining.title}</strong></p>
      <p>${formatDateDisplay(selectedTraining.date)} um ${selectedTraining.time}</p>
      <p>${selectedTraining.location}</p>
      <p class="smallMuted">${selectedTraining.notes}</p>
      <p class="smallMuted">Abstimmung: ${selectedTraining.voteOpensHoursBefore}h bis ${selectedTraining.voteClosesHoursBefore}h vor Beginn</p>
    </div>

    <div class="grid unitSummary">
      ${renderDashboardUnitSummary(selectedTraining.id)}
    </div>

    <div class="twoCol">
      <div class="card">
        <h2>Filter</h2>
        <div class="field">
          <label>Gruppe / Unit</label>
          <select class="select" onchange="changeGroupFilter(this.value)">
            <option value="all">Alle</option>
            ${getOrderedFilterOptions().map(g => `<option value="${g}" ${g === state.filterGroup ? "selected" : ""}>${g}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Antwortstatus</label>
          <select class="select" onchange="changeResponseFilter(this.value)">
            <option value="all" ${state.filterResponse === "all" ? "selected" : ""}>Alle</option>
            <option value="yes" ${state.filterResponse === "yes" ? "selected" : ""}>Zusage</option>
            <option value="no" ${state.filterResponse === "no" ? "selected" : ""}>Absage</option>
            <option value="limited" ${state.filterResponse === "limited" ? "selected" : ""}>Limited</option>
            <option value="maybe" ${state.filterResponse === "maybe" ? "selected" : ""}>Unsicher</option>
            <option value="open" ${state.filterResponse === "open" ? "selected" : ""}>Keine Antwort</option>
          </select>
        </div>
      </div>

      <div class="card">
        <h2>Statusübersicht</h2>
        ${renderStatusSummary(counts)}
      </div>
    </div>

    <div class="card">
      <h2>Antworten</h2>
      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th class="sortable" onclick="setReportsSort('name')">Spieler</th>
              <th class="sortable" onclick="setReportsSort('group')">Gruppe</th>
              <th class="sortable" onclick="setReportsSort('unit')">Unit</th>
              <th class="sortable" onclick="setReportsSort('status')">Status</th>
              <th class="sortable" onclick="setReportsSort('updatedAt')">Letzte Änderung</th>
              <th>Eventtag</th>
              <th>Gesundheit</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${filteredPlayers.map(player => {
              const response = (responses[selectedTraining.id] || {})[player.id];
              const changed = response?.changedOnEventDay;
              const status = getPlayerTrainingStatus(player, selectedTraining.id);

              return `
                <tr class="${changed ? "highlightRow" : ""}">
                  <td>${fullName(player)}</td>
                  <td>${getGroupLabelForUnit(player.unit)}</td>
                  <td>${player.unit}</td>
                  <td>${getStatusTag(status)}</td>
                  <td>${response ? `${formatDateDisplay(response.updatedAt.slice(0,10))} ${response.updatedAt.slice(11,16)}` : (status === "limited" ? "automatisch" : "offen")}</td>
                  <td>${changed ? "Ja" : ""}</td>
                  <td>${getCurrentPlayerStatusLabel(player)}</td>
                  <td>
                    <div class="rowActions">
                      ${status === "limited" ? `
                        <button class="warnButton" onclick="openLimitationEdit('${player.id}')">Limitation bearbeiten</button>
                        <button class="secondaryButton" onclick="setPlayerFit('${player.id}')">Auf Fit setzen</button>
                      ` : `
                        <button class="button" onclick="setCoachResponse('${selectedTraining.id}','${player.id}','yes')">Zusage</button>
                        <button class="secondaryButton" onclick="setCoachResponse('${selectedTraining.id}','${player.id}','maybe')">Unsicher</button>
                        <button class="secondaryButton" onclick="setCoachResponse('${selectedTraining.id}','${player.id}','no')">Absage</button>
                        <button class="warnButton" onclick="openLimitationEdit('${player.id}')">Limitation</button>
                      `}
                    </div>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderLimitationsView() {
  const content = document.getElementById("content");
  document.getElementById("screenTitle").textContent = "Limitations";
  document.getElementById("screenSubtitle").textContent = "Aktuell Limited und vergangene Limitations bearbeiten";

  const player = state.editingLimitationPlayerId ? players.find(p => p.id === state.editingLimitationPlayerId) : null;
  const currentLimitations = [];
  const pastLimitations = [];

  players.forEach(p => {
    (p.injuries || []).forEach(lim => {
      const item = { player: p, limitation: lim };
      if (limitationIsCurrent(lim)) currentLimitations.push(item);
      else pastLimitations.push(item);
    });
  });

  currentLimitations.sort((a, b) => a.player.lastName.localeCompare(b.player.lastName) || a.player.firstName.localeCompare(b.player.firstName));
  pastLimitations.sort((a, b) => a.player.lastName.localeCompare(b.player.lastName) || a.player.firstName.localeCompare(b.player.firstName));

  const dropdownPlayers = sortPlayersByLastName(players);

  content.innerHTML = `
    ${renderMustChangePasswordNotice()}
    <div class="twoCol">
      <div class="card">
        <h2>${player ? `Limitation für ${fullName(player)}` : "Limitation erfassen"}</h2>

        <div class="field">
          <label>Spieler</label>
          <select id="limitationPlayer" class="select">
            ${dropdownPlayers.map(p => `
              <option value="${p.id}" ${player && p.id === player.id ? "selected" : ""}>${fullName(p)} · ${p.unit}</option>
            `).join("")}
          </select>
        </div>

        <div class="field">
          <label>Art</label>
          <input id="limitationType" class="input" value="${state.editingLimitationId && player ? escapeHtml(findLimitation(player, state.editingLimitationId)?.type || "") : ""}" placeholder="z. B. Knöchel, Schulter, Krankheit" />
        </div>

        <div class="field">
          <label>Gültig seit</label>
          <input id="limitationFrom" class="input" type="date" value="${state.editingLimitationId && player ? (findLimitation(player, state.editingLimitationId)?.from || "") : getTodayYmd()}" />
        </div>

        <div class="field">
          <label>Dauer in Tagen</label>
          <input id="limitationDurationDays" class="input" type="number" min="1" value="${state.editingLimitationId && player ? (findLimitation(player, state.editingLimitationId)?.durationDays || 7) : 7}" />
        </div>

        <div class="rowActions">
          <button class="button" onclick="${state.editingLimitationId ? "updateLimitation()" : "createLimitation()"}">${state.editingLimitationId ? "Limitation speichern" : "Limitation anlegen"}</button>
          ${state.editingLimitationId ? `<button class="secondaryButton" onclick="cancelLimitationEdit()">Abbrechen</button>` : ""}
        </div>
      </div>

      <div class="card">
        <h2>Aktuell Limited</h2>
        ${currentLimitations.length === 0 ? `<p>Keine aktuellen Limitations.</p>` : currentLimitations.map(item => `
          <div style="border:1px solid #214235; border-radius:12px; padding:12px; margin-bottom:12px;">
            <strong>${fullName(item.player)}</strong>
            <p style="margin:8px 0 0 0;">Gruppe: ${getGroupLabelForUnit(item.player.unit)} · Unit: ${item.player.unit}</p>
            <p style="margin:8px 0 0 0;">Art: ${item.limitation.type}</p>
            <p style="margin:8px 0 0 0;">Von: ${formatDateDisplay(item.limitation.from)}</p>
            <p style="margin:8px 0 0 0;">Dauer: ${item.limitation.durationDays} Tage</p>
            <p style="margin:8px 0 0 0;">Bis: ${formatDateDisplay(calculateLimitationEnd(item.limitation.from, item.limitation.durationDays))}</p>
            <div class="rowActions" style="margin-top:10px;">
              <button class="secondaryButton" onclick="startLimitationEdit('${item.player.id}','${item.limitation.id}')">Bearbeiten</button>
              <button class="dangerButton" onclick="deleteLimitation('${item.player.id}','${item.limitation.id}')">Löschen</button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="card">
      <h2>Vergangen</h2>
      ${pastLimitations.length === 0 ? `<p>Keine vergangenen Limitations.</p>` : pastLimitations.map(item => `
        <div style="border:1px solid #214235; border-radius:12px; padding:12px; margin-bottom:12px;">
          <strong>${fullName(item.player)}</strong>
          <p style="margin:8px 0 0 0;">Gruppe: ${getGroupLabelForUnit(item.player.unit)} · Unit: ${item.player.unit}</p>
          <p style="margin:8px 0 0 0;">Art: ${item.limitation.type}</p>
          <p style="margin:8px 0 0 0;">Von: ${formatDateDisplay(item.limitation.from)}</p>
          <p style="margin:8px 0 0 0;">Dauer: ${item.limitation.durationDays} Tage</p>
          <p style="margin:8px 0 0 0;">Bis: ${formatDateDisplay(calculateLimitationEnd(item.limitation.from, item.limitation.durationDays))}</p>
          <div class="rowActions" style="margin-top:10px;">
            <button class="secondaryButton" onclick="startLimitationEdit('${item.player.id}','${item.limitation.id}')">Bearbeiten</button>
            <button class="dangerButton" onclick="deleteLimitation('${item.player.id}','${item.limitation.id}')">Löschen</button>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderPlayerSearchView() {
  const content = document.getElementById("content");
  document.getElementById("screenTitle").textContent = "Spielersuche";
  document.getElementById("screenSubtitle").textContent = "Passende Spieler finden und ausklappen";

  const search = state.playerSearchValue.trim().toLowerCase();
  const matches = search
    ? sortPlayersByLastName(players.filter(p => fullName(p).toLowerCase().includes(search)))
    : [];

  content.innerHTML = `
    ${renderMustChangePasswordNotice()}
    <div class="card">
      <h2>Spieler suchen</h2>
      <div class="field">
        <label>Name</label>
        <input id="playerSearchInput" class="input" value="${escapeHtml(state.playerSearchValue)}" placeholder="z. B. Stefan oder Frank" />
      </div>
      <button class="button" onclick="searchPlayers()">Suchen</button>
    </div>

    ${search ? `
      <div class="card" style="margin-top: 24px;">
        <h2>Treffer</h2>
        ${matches.length === 0 ? `<p>Keine Spieler gefunden.</p>` : matches.map(player => {
          const expanded = state.expandedPlayerSearchId === player.id;
          const stats = getPlayerStats(player.id);
          return `
            <div style="border:1px solid #214235; border-radius:14px; padding:14px; margin-bottom:12px;">
              <div class="accordionHeader" onclick="togglePlayerSearchDetails('${player.id}')">
                <div>
                  <strong>${fullName(player)}</strong>
                  <div class="inlineInfo smallMuted">
                    <span>Gruppe: ${getGroupLabelForUnit(player.unit)}</span>
                    <span>Unit: ${player.unit}</span>
                    <span>Geburtstag: ${formatDateDisplay(player.birthday)}</span>
                    <span>Loginname: ${player.username}</span>
                  </div>
                </div>
                <div class="secondaryButton">${expanded ? "Zuklappen" : "Ausklappen"}</div>
              </div>

              ${expanded ? `
                <div class="accordionBody">
                  <div class="grid kpis">
                    <div class="card">
                      <div class="smallMuted">Zusage</div>
                      <div class="kpi">${stats.yes}</div>
                    </div>
                    <div class="card">
                      <div class="smallMuted">Absage</div>
                      <div class="kpi">${stats.no}</div>
                    </div>
                    <div class="card">
                      <div class="smallMuted">Unsicher</div>
                      <div class="kpi">${stats.maybe}</div>
                    </div>
                    <div class="card">
                      <div class="smallMuted">Limited</div>
                      <div class="kpi">${stats.limited}</div>
                    </div>
                    <div class="card">
                      <div class="smallMuted">Keine Antwort</div>
                      <div class="kpi">${stats.open}</div>
                    </div>
                  </div>

                  <div class="twoCol">
                    <div class="card">
                      <h3>Verletzungen</h3>
                      ${player.injuries && player.injuries.length > 0 ? player.injuries.map(injury => `
                        <div style="border:1px solid #214235; border-radius:12px; padding:12px; margin-bottom:12px;">
                          <p><strong>Art:</strong> ${injury.type}</p>
                          <p><strong>Von:</strong> ${formatDateDisplay(injury.from)}</p>
                          <p><strong>Dauer:</strong> ${injury.durationDays} Tage</p>
                          <p><strong>Bis:</strong> ${formatDateDisplay(calculateLimitationEnd(injury.from, injury.durationDays))}</p>
                        </div>
                      `).join("") : `<p class="smallMuted">Keine gespeicherten Verletzungszeiträume.</p>`}
                    </div>

                    <div class="card">
                      <h3>Verwaltung</h3>
                      <div class="rowActions">
                        <button class="secondaryButton" onclick="startPlayerEdit('${player.id}'); setView('players');">Bearbeiten</button>
                        <button class="warnButton" onclick="openLimitationEdit('${player.id}')">Limitation</button>
                        ${state.currentUser.role === "headAdmin" ? `<button class="secondaryButton" onclick="sendResetLink('player','${player.id}')">Reset</button>` : ""}
                      </div>
                    </div>
                  </div>

                  <div class="card">
                    <h3>Zeitleiste vergangener Trainings</h3>
                    <div class="timeline">
                      ${stats.timeline.map(item => `
                        <div class="timelineItem">
                          <strong>${item.training.title}</strong>
                          <p style="margin:8px 0 0 0;">${formatDateDisplay(item.training.date)} um ${item.training.time}</p>
                          <p style="margin:8px 0 0 0;">Status: ${getStatusTag(item.status)}</p>
                          <p class="smallMuted" style="margin:8px 0 0 0;">Letzte Änderung: ${item.response ? `${formatDateDisplay(item.response.updatedAt.slice(0,10))} ${item.response.updatedAt.slice(11,16)}` : (item.status === "limited" ? "automatisch" : "offen")}</p>
                        </div>
                      `).join("")}
                    </div>
                  </div>
                </div>
              ` : ""}
            </div>
          `;
        }).join("")}
      </div>
    ` : ""}
  `;
}

function renderStatisticsView() {
  const content = document.getElementById("content");
  document.getElementById("screenTitle").textContent = "Statistik";
  document.getElementById("screenSubtitle").textContent = "Vergangene Trainings als Zahlen, Prozent und Diagramm";

  const now = new Date();
  const pastTrainings = [...trainings]
    .filter(t => getTrainingStartDate(t) < now)
    .sort((a, b) => getTrainingStartDate(a) - getTrainingStartDate(b));

  const rows = pastTrainings.map(training => {
    const total = players.length;
    const yes = players.filter(p => getPlayerTrainingStatus(p, training.id) === "yes").length;
    const no = players.filter(p => getPlayerTrainingStatus(p, training.id) === "no").length;
    const maybe = players.filter(p => getPlayerTrainingStatus(p, training.id) === "maybe").length;
    const limited = players.filter(p => getPlayerTrainingStatus(p, training.id) === "limited").length;
    const open = players.filter(p => getPlayerTrainingStatus(p, training.id) === "open").length;

    const eligibleTotal = Math.max(total - limited, 1);
    return {
      training,
      total,
      yes,
      no,
      maybe,
      limited,
      open,
      yesPct: Math.round((yes / eligibleTotal) * 100),
      noPct: Math.round((no / eligibleTotal) * 100),
      maybePct: Math.round((maybe / eligibleTotal) * 100),
      limitedPct: Math.round((limited / total) * 100),
      openPct: Math.round((open / eligibleTotal) * 100)
    };
  });

  const overallEligible = rows.reduce((sum, r) => sum + Math.max(r.total - r.limited, 0), 0) || 1;
  const overallYes = rows.reduce((sum, r) => sum + r.yes, 0);
  const overallNo = rows.reduce((sum, r) => sum + r.no, 0);
  const overallMaybe = rows.reduce((sum, r) => sum + r.maybe, 0);
  const overallLimited = rows.reduce((sum, r) => sum + r.limited, 0);
  const overallOpen = rows.reduce((sum, r) => sum + r.open, 0);

  content.innerHTML = `
    ${renderMustChangePasswordNotice()}
    <div class="grid kpis">
      <div class="card"><div class="smallMuted">Gesamt Zusagen</div><div class="kpi">${overallYes}</div></div>
      <div class="card"><div class="smallMuted">Gesamt Absagen</div><div class="kpi">${overallNo}</div></div>
      <div class="card"><div class="smallMuted">Gesamt Unsicher</div><div class="kpi">${overallMaybe}</div></div>
      <div class="card"><div class="smallMuted">Gesamt Limited</div><div class="kpi">${overallLimited}</div></div>
      <div class="card"><div class="smallMuted">Gesamt Keine Antwort</div><div class="kpi">${overallOpen}</div></div>
      <div class="card"><div class="smallMuted">Zusagequote</div><div class="kpi">${Math.round((overallYes / overallEligible) * 100)}%</div></div>
    </div>

    <div class="card">
      <h2>Verlauf als Diagramm</h2>
      <div class="chartWrap">
        ${buildStatisticsChart(rows)}
      </div>
      <div class="legend">
        <div class="legendItem"><span class="legendSwatch" style="background:#22c55e;"></span> Zusage %</div>
        <div class="legendItem"><span class="legendSwatch" style="background:#ef4444;"></span> Absage %</div>
        <div class="legendItem"><span class="legendSwatch" style="background:#94a3b8;"></span> Unsicher %</div>
        <div class="legendItem"><span class="legendSwatch" style="background:#14b8a6;"></span> Limited %</div>
        <div class="legendItem"><span class="legendSwatch" style="background:#f59e0b;"></span> Keine Antwort %</div>
      </div>
    </div>

    <div class="card" style="margin-top:24px;">
      <h2>Vergangene Trainings</h2>
      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Training</th>
              <th>Datum</th>
              <th>Zusage</th>
              <th>Absage</th>
              <th>Unsicher</th>
              <th>Limited</th>
              <th>Keine Antwort</th>
              <th>Zusage %</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${r.training.title}</td>
                <td>${formatDateDisplay(r.training.date)}</td>
                <td>${r.yes}</td>
                <td>${r.no}</td>
                <td>${r.maybe}</td>
                <td>${r.limited}</td>
                <td>${r.open}</td>
                <td>${r.yesPct}%</td>
              </tr>
            `).join("")}
            ${rows.length === 0 ? `<tr><td colspan="8">Noch keine vergangenen Trainings vorhanden.</td></tr>` : ""}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function buildStatisticsChart(rows) {
  if (!rows.length) {
    return `<div class="smallMuted">Keine Daten vorhanden.</div>`;
  }

  const width = 900;
  const height = 260;
  const paddingX = 50;
  const paddingY = 30;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;
  const stepX = rows.length > 1 ? innerWidth / (rows.length - 1) : 0;

  function pointY(value) {
    return paddingY + innerHeight - (value / 100) * innerHeight;
  }

  function buildPath(key) {
    return rows.map((row, index) => {
      const x = paddingX + index * stepX;
      const y = pointY(row[key]);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    }).join(" ");
  }

  const labels = rows.map((row, index) => {
    const x = paddingX + index * stepX;
    return `<text x="${x}" y="${height - 6}" fill="#d1fae5" font-size="12" text-anchor="middle">${formatDateDisplay(row.training.date).slice(0,5)}</text>`;
  }).join("");

  const horizontalLines = [0,25,50,75,100].map(v => {
    const y = pointY(v);
    return `
      <line x1="${paddingX}" y1="${y}" x2="${width - paddingX}" y2="${y}" stroke="#214235" />
      <text x="10" y="${y + 4}" fill="#d1fae5" font-size="12">${v}%</text>
    `;
  }).join("");

  return `
    <svg class="chartSvg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      ${horizontalLines}
      <path d="${buildPath("yesPct")}" fill="none" stroke="#22c55e" stroke-width="3" />
      <path d="${buildPath("noPct")}" fill="none" stroke="#ef4444" stroke-width="3" />
      <path d="${buildPath("maybePct")}" fill="none" stroke="#94a3b8" stroke-width="3" />
      <path d="${buildPath("limitedPct")}" fill="none" stroke="#14b8a6" stroke-width="3" />
      <path d="${buildPath("openPct")}" fill="none" stroke="#f59e0b" stroke-width="3" />
      ${labels}
    </svg>
  `;
}

function renderCoachesView() {
  const content = document.getElementById("content");
  document.getElementById("screenTitle").textContent = "Coaches";
  document.getElementById("screenSubtitle").textContent = "Nur Hauptadmin darf Coaches anlegen, bearbeiten, löschen und zurücksetzen";

  const editCoach = state.editCoachId ? coaches.find(c => c.id === state.editCoachId) : null;

  content.innerHTML = `
    ${renderMustChangePasswordNotice()}
    <div class="twoCol">
      <div class="card">
        <h2>${editCoach ? "Coach bearbeiten" : "Coach anlegen"}</h2>
        <div class="field"><label>Name</label><input id="coachName" class="input" value="${editCoach ? escapeHtml(editCoach.name) : ""}" placeholder="Coach Name" /></div>
        <div class="field"><label>Loginname</label><input id="coachUsername" class="input" value="${editCoach ? escapeHtml(editCoach.username) : ""}" placeholder="coachlogin" /></div>
        <div class="field"><label>Geburtstag</label><input id="coachBirthday" class="input" type="date" value="${editCoach ? (editCoach.birthday || "") : ""}" /></div>
        <div class="field"><label>E-Mail</label><input id="coachEmail" class="input" value="${editCoach ? escapeHtml(editCoach.email || "") : ""}" placeholder="coach@example.com" /></div>
        <div class="field">
          <label>Rolle</label>
          <select id="coachRole" class="select">
            <option value="adminCoach" ${editCoach && editCoach.role === "adminCoach" ? "selected" : ""}>adminCoach</option>
            <option value="headAdmin" ${editCoach && editCoach.role === "headAdmin" ? "selected" : ""}>headAdmin</option>
          </select>
        </div>
        <div class="rowActions">
          <button class="button" onclick="${editCoach ? "updateCoach()" : "createCoach()"}">${editCoach ? "Coach speichern" : "Coach anlegen"}</button>
          ${editCoach ? `<button class="secondaryButton" onclick="cancelCoachEdit()">Abbrechen</button>` : ""}
        </div>
        <p class="smallMuted" style="margin-top:12px;">
          Initialpasswort für neue Coaches ist automatisch das Geburtsjahr.
        </p>
      </div>

      <div class="card">
        <h2>Bestehende Coaches</h2>
        <div class="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Loginname</th>
                <th>Geburtstag</th>
                <th>Rolle</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              ${coaches.map(c => `
                <tr>
                  <td>${c.name}</td>
                  <td>${c.username}</td>
                  <td>${formatDateDisplay(c.birthday)}</td>
                  <td>${c.role}</td>
                  <td>
                    <div class="rowActions">
                      <button class="secondaryButton" onclick="startCoachEdit('${c.id}')">Bearbeiten</button>
                      <button class="secondaryButton" onclick="sendResetLink('coach','${c.id}')">Reset</button>
                      <button class="dangerButton" onclick="deleteCoach('${c.id}')">Löschen</button>
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderDashboardUnitSummary(trainingId) {
  const cards = [];

  orderedGroups.forEach(group => {
    const groupPlayers = getPlayersForGroup(group);
    if (!groupPlayers.length) return;

    const groupYes = groupPlayers.filter(p => getPlayerTrainingStatus(p, trainingId) === "yes").length;
    cards.push(`
      <div class="card">
        <div class="smallMuted">${group}</div>
        <div class="kpi">${groupYes}/${groupPlayers.length}</div>
      </div>
    `);
  });

  return cards.join("");
}
