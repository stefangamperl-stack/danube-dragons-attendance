(function setupPwa() {
  let installPrompt = null;

  function removeElement(id) {
    document.getElementById(id)?.remove();
  }

  function showInstallButton() {
    if (document.getElementById("pwaInstallButton")) return;

    const button = document.createElement("button");
    button.id = "pwaInstallButton";
    button.className = "pwaInstallButton";
    button.type = "button";
    button.textContent = "App installieren";
    button.addEventListener("click", async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      removeElement("pwaInstallButton");
    });
    document.body.appendChild(button);
  }

  function showUpdate(registration) {
    if (document.getElementById("pwaUpdateToast")) return;

    const toast = document.createElement("div");
    toast.id = "pwaUpdateToast";
    toast.className = "pwaToast";
    toast.setAttribute("role", "status");
    toast.innerHTML = "<span>Eine neue App-Version ist verfügbar.</span>";

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Aktualisieren";
    button.addEventListener("click", () => registration.waiting?.postMessage({ type: "SKIP_WAITING" }));
    toast.appendChild(button);
    document.body.appendChild(toast);
  }

  function updateConnectionStatus() {
    removeElement("connectionBadge");
    if (navigator.onLine) return;

    const badge = document.createElement("div");
    badge.id = "connectionBadge";
    badge.className = "connectionBadge";
    badge.setAttribute("role", "status");
    badge.textContent = "Offline: Änderungen benötigen eine Verbindung";
    document.body.appendChild(badge);
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    showInstallButton();
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    removeElement("pwaInstallButton");
  });

  window.addEventListener("online", updateConnectionStatus);
  window.addEventListener("offline", updateConnectionStatus);
  updateConnectionStatus();

  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });

      if (registration.waiting) showUpdate(registration);

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdate(registration);
        });
      });

      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    } catch (error) {
      console.warn("Service Worker konnte nicht registriert werden:", error);
    }
  });
})();
