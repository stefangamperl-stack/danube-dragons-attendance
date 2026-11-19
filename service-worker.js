const CACHE_NAME = "salix-v20";
const APP_SHELL = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/manifest-v2.webmanifest",
  "/manifest-v3.webmanifest",
  "/manifest-v4.webmanifest",
  "/css/styles.css",
  "/js/data.js",
  "/js/supabaseClient.js",
  "/js/loginName.js",
  "/js/auth.js",
  "/js/render.js",
  "/js/actions.js",
  "/js/documents.js",
  "/js/app.js",
  "/js/pwa.js",
  "/js/loading.js",
  "/icons/salix-icon-192-v4.png",
  "/icons/salix-icon-512-v4.png",
  "/icons/salix-maskable-512-v4.png",
  "/icons/salix-apple-touch-icon-v4.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("push", event => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = { body: event.data?.text() || "Du hast eine neue Trainingserinnerung." };
  }

  event.waitUntil(self.registration.showNotification(
    payload.title || "Salix Trainingserinnerung",
    {
      body: payload.body || "Bitte gib deine Zu- oder Absage ab.",
      icon: payload.icon || "/icons/salix-icon-192-v4.png",
      badge: payload.badge || "/icons/salix-icon-192-v4.png",
      tag: payload.tag || "salix-training-reminder",
      data: payload.data || { url: "/" }
    }
  ));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  const requestedUrl = new URL(event.notification.data?.url || "/", self.location.origin);
  const targetUrl = requestedUrl.origin === self.location.origin
    ? requestedUrl.href
    : self.location.origin;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(async windowClients => {
        const existingClient = windowClients.find(client =>
          new URL(client.url).origin === self.location.origin
        );

        if (existingClient) {
          if ("navigate" in existingClient) await existingClient.navigate(targetUrl);
          return existingClient.focus();
        }

        return self.clients.openWindow(targetUrl);
      })
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.hostname === "cdn.jsdelivr.net" && url.pathname.includes("@supabase/supabase-js")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;
        const response = await fetch(request);
        cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put("/index.html", copy));
          }
          return response;
        })
        .catch(async () => (await caches.match("/index.html")) || caches.match("/offline.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
