(() => {
  const screen = document.getElementById("globalLoadingScreen");
  const title = document.getElementById("globalLoadingTitle");

  if (!screen || !title) return;

  const SHOW_DELAY_MS = 110;
  const MIN_VISIBLE_MS = 320;
  const FADE_OUT_MS = 170;

  let activeOperations = 0;
  let showTimer = null;
  let hideTimer = null;
  let visibleSince = 0;

  function show(message = "Wird geladen") {
    activeOperations += 1;
    title.textContent = message;
    window.clearTimeout(hideTimer);

    if (screen.classList.contains("isVisible") || showTimer) return;

    showTimer = window.setTimeout(() => {
      showTimer = null;
      if (activeOperations < 1) return;

      screen.hidden = false;
      screen.setAttribute("aria-hidden", "false");
      document.body.setAttribute("aria-busy", "true");
      visibleSince = performance.now();

      window.requestAnimationFrame(() => {
        screen.classList.add("isVisible");
      });
    }, SHOW_DELAY_MS);
  }

  function hide() {
    activeOperations = Math.max(0, activeOperations - 1);
    if (activeOperations > 0) return;

    window.clearTimeout(showTimer);
    showTimer = null;

    if (screen.hidden) return;

    const visibleFor = performance.now() - visibleSince;
    const waitFor = Math.max(0, MIN_VISIBLE_MS - visibleFor);

    hideTimer = window.setTimeout(() => {
      screen.classList.remove("isVisible");
      screen.setAttribute("aria-hidden", "true");
      document.body.removeAttribute("aria-busy");

      hideTimer = window.setTimeout(() => {
        if (activeOperations === 0) screen.hidden = true;
      }, FADE_OUT_MS);
    }, waitFor);
  }

  async function run(message, operation) {
    show(message);
    try {
      return await operation();
    } finally {
      hide();
    }
  }

  const wrappedOperations = {
    login: "Anmeldung wird vorbereitet",
    logout: "Du wirst abgemeldet",
    setView: "Ansicht wird geladen",
    changeOwnPassword: "Passwort wird gespeichert",
    sendTrainingPush: "Benachrichtigungen werden gesendet",
    setOwnCoachResponse: "Antwort wird gespeichert",
    setPlayerResponse: "Antwort wird gespeichert",
    setCoachResponse: "Antwort wird gespeichert",
    createPlayer: "Spieler wird angelegt",
    createCoach: "Coach wird angelegt",
    createTraining: "Training wird angelegt",
    updateTraining: "Training wird gespeichert",
    deleteTraining: "Training wird gelöscht",
    updatePlayer: "Spieler wird gespeichert",
    updateCoach: "Coach wird gespeichert",
    resetPasswordToDefault: "Passwort wird zurückgesetzt",
    activateCoachLogin: "Login wird eingerichtet",
    deletePlayer: "Spieler wird gelöscht",
    deleteCoach: "Coach wird gelöscht",
    importRosterCsv: "Spieler werden importiert",
    saveHealthStatus: "Status wird gespeichert",
    endOwnLimitation: "Status wird aktualisiert",
    createLimitation: "Limitation wird angelegt",
    updateLimitation: "Limitation wird gespeichert",
    deleteLimitation: "Limitation wird gelöscht",
    setPlayerFit: "Spielerstatus wird aktualisiert",
    enablePushNotifications: "Push wird aktiviert",
    disablePushNotifications: "Push wird deaktiviert"
  };

  Object.entries(wrappedOperations).forEach(([functionName, message]) => {
    const original = window[functionName];
    if (typeof original !== "function" || original.__salixLoadingWrapped) return;

    const wrapped = async function (...args) {
      return run(message, () => original.apply(this, args));
    };
    wrapped.__salixLoadingWrapped = true;
    window[functionName] = wrapped;
  });

  window.salixLoading = { show, hide, run };
})();
