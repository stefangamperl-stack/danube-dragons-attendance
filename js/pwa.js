(function setupPwa() {
  let installPrompt = null;

  const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

  function removeElement(id) {
    document.getElementById(id)?.remove();
  }

  function showInstallInstructions() {
    removeElement("pwaInstallHelp");

    const toast = document.createElement("div");
    toast.id = "pwaInstallHelp";
    toast.className = "pwaToast pwaInstallHelp";
    toast.setAttribute("role", "dialog");
    toast.setAttribute("aria-label", "Installationsanleitung");

    const text = document.createElement("span");
    text.innerHTML = isIos()
      ? "<strong>Auf iPhone oder iPad:</strong> Salix in Safari öffnen, auf „Teilen“ tippen und „Zum Home-Bildschirm“ wählen."
      : "<strong>Installation:</strong> Öffne das Browsermenü und wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“.";

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Verstanden";
    button.addEventListener("click", () => removeElement("pwaInstallHelp"));

    toast.append(text, button);
    document.body.appendChild(toast);

    const hint = document.getElementById("pwaInstallHint");
    if (hint) hint.innerHTML = text.innerHTML;
  }

  async function requestInstall() {
    if (!installPrompt) {
      showInstallInstructions();
      return;
    }

    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    installPrompt = null;

    if (choice?.outcome === "accepted") {
      removeElement("pwaInstallButton");
      document.getElementById("pwaInstallCard")?.classList.add("hidden");
    } else {
      updateInstallUi();
    }
  }

  function updateInstallUi() {
    const card = document.getElementById("pwaInstallCard");
    const action = document.getElementById("pwaInstallAction");

    if (isStandalone()) {
      card?.classList.add("hidden");
      removeElement("pwaInstallButton");
      return;
    }

    card?.classList.remove("hidden");

    if (action) {
      action.textContent = installPrompt ? "App installieren" : "Installationsanleitung anzeigen";
      action.onclick = requestInstall;
    }

    showInstallButton();
  }

  function showInstallButton() {
    if (isStandalone() || document.getElementById("pwaInstallButton")) return;

    const button = document.createElement("button");
    button.id = "pwaInstallButton";
    button.className = "pwaInstallButton";
    button.type = "button";
    button.textContent = "App installieren";
    button.addEventListener("click", requestInstall);
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
    updateInstallUi();
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    removeElement("pwaInstallButton");
    document.getElementById("pwaInstallCard")?.classList.add("hidden");
    removeElement("pwaInstallHelp");
  });

  window.addEventListener("online", updateConnectionStatus);
  window.addEventListener("offline", updateConnectionStatus);
  updateConnectionStatus();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateInstallUi, { once: true });
  } else {
    updateInstallUi();
  }

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
