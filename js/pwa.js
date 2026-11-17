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

  function urlBase64ToUint8Array(value) {
    const padding = "=".repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
    const raw = window.atob(base64);
    return Uint8Array.from([...raw].map(character => character.charCodeAt(0)));
  }

  function setPushUi({ message, active = false, disabled = false }) {
    const status = document.getElementById("pushNotificationStatus");
    const action = document.getElementById("pushNotificationAction");
    if (!status || !action) return;

    status.textContent = message;
    action.disabled = disabled;
    action.textContent = active
      ? "Auf diesem Gerät deaktivieren"
      : "Auf diesem Gerät aktivieren";
    action.onclick = active
      ? () => window.disablePushNotifications()
      : () => window.enablePushNotifications();
  }

  function pushCapabilityError() {
    if (isIos() && !isStandalone()) {
      return "Auf iPhone und iPad muss Salix zuerst zum Home-Bildschirm hinzugefügt und von dort geöffnet werden.";
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      return "Push-Benachrichtigungen werden von diesem Browser nicht unterstützt.";
    }
    if (Notification.permission === "denied") {
      return "Benachrichtigungen sind für Salix im Browser oder in den Geräteeinstellungen blockiert.";
    }
    return "";
  }

  async function getPushRegistration() {
    return (await navigator.serviceWorker.getRegistration("/")) ||
      navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
  }

  async function readJsonResponse(response) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  async function refreshPushNotificationUi() {
    if (!document.getElementById("pushNotificationAction")) return;

    const capabilityError = pushCapabilityError();
    if (capabilityError) {
      setPushUi({ message: capabilityError, disabled: true });
      return;
    }

    try {
      const registration = await getPushRegistration();
      const subscription = await registration.pushManager.getSubscription();
      setPushUi({
        active: Boolean(subscription),
        message: subscription
          ? "Push-Benachrichtigungen sind auf diesem Gerät aktiviert."
          : "Push-Benachrichtigungen sind auf diesem Gerät noch nicht aktiviert."
      });
    } catch (error) {
      console.warn("Push-Status konnte nicht gelesen werden:", error);
      setPushUi({ message: "Der Push-Status konnte gerade nicht geprüft werden." });
    }
  }

  async function enablePushNotifications() {
    const capabilityError = pushCapabilityError();
    if (capabilityError) {
      setPushUi({ message: capabilityError, disabled: true });
      return;
    }

    setPushUi({ message: "Push-Benachrichtigungen werden aktiviert …", disabled: true });

    try {
      const permission = Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();

      if (permission !== "granted") {
        throw new Error("Benachrichtigungen wurden nicht erlaubt.");
      }

      const [registration, keyResponse] = await Promise.all([
        getPushRegistration(),
        fetch("/api/push-public-key", { cache: "no-store" })
      ]);
      const keyResult = await readJsonResponse(keyResponse);
      if (!keyResponse.ok || !keyResult?.publicKey) {
        throw new Error(keyResult?.error || "Push ist noch nicht vollständig eingerichtet.");
      }

      let subscription = await registration.pushManager.getSubscription();
      let createdSubscription = false;
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyResult.publicKey)
        });
        createdSubscription = true;
      }

      const response = await fetch("/api/push-subscription", {
        method: "POST",
        headers: await buildApiAuthHeaders(),
        body: JSON.stringify({ subscription: subscription.toJSON() })
      });
      const result = await readJsonResponse(response);

      if (!response.ok || !result?.success) {
        if (createdSubscription) await subscription.unsubscribe();
        throw new Error(result?.error || "Push-Einstellung konnte nicht gespeichert werden.");
      }

      setPushUi({
        active: true,
        message: "Push-Benachrichtigungen sind auf diesem Gerät aktiviert."
      });
    } catch (error) {
      console.error("Push konnte nicht aktiviert werden:", error);
      setPushUi({ message: error.message || "Push konnte nicht aktiviert werden." });
    }
  }

  async function removePushSubscription({ silent = false } = {}) {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;

    try {
      const response = await fetch("/api/push-subscription", {
        method: "DELETE",
        headers: await buildApiAuthHeaders(),
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });
      const result = await readJsonResponse(response);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Push-Einstellung konnte nicht entfernt werden.");
      }
    } catch (error) {
      if (!silent) throw error;
      console.warn("Push-Zuordnung konnte beim Abmelden nicht entfernt werden:", error);
    } finally {
      await subscription.unsubscribe();
    }
  }

  async function disablePushNotifications() {
    setPushUi({ message: "Push-Benachrichtigungen werden deaktiviert …", disabled: true });

    try {
      await removePushSubscription();
      setPushUi({
        message: "Push-Benachrichtigungen sind auf diesem Gerät deaktiviert."
      });
    } catch (error) {
      console.error("Push konnte nicht deaktiviert werden:", error);
      setPushUi({
        active: true,
        message: error.message || "Push konnte nicht deaktiviert werden."
      });
    }
  }

  window.refreshPushNotificationUi = refreshPushNotificationUi;
  window.enablePushNotifications = enablePushNotifications;
  window.disablePushNotifications = disablePushNotifications;
  window.unregisterPushForLogout = () => removePushSubscription({ silent: true });

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
      refreshPushNotificationUi();
    } catch (error) {
      console.warn("Service Worker konnte nicht registriert werden:", error);
    }
  });
})();
