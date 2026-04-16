// ClimatePulse — minimal service worker for Newsroom push notifications.
//
// Scope is intentionally limited to push handling. Offline caching, sync,
// and other PWA features are out of scope here so this file can coexist
// with any future caching service worker without conflict.
//
// Payload contract (must stay in sync with src/lib/newsroom/types.ts):
//   { v: 1, kind: 'newsroom_urgency5', item_id, raw_article_id, title,
//     teaser, source, domain, url, published_at }

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { kind: "unknown", title: "Climate Pulse", teaser: event.data.text() };
  }

  if (payload.kind !== "newsroom_urgency5") return;

  const title = payload.source
    ? `${payload.source} · Breaking`
    : "Climate Pulse · Breaking";
  const body = payload.title
    ? `${payload.title}${payload.teaser ? "\n" + payload.teaser : ""}`
    : payload.teaser ?? "Significant story published.";

  const options = {
    body,
    badge: "/icon-192.png",
    icon: "/icon-192.png",
    tag: payload.item_id || "newsroom",
    renotify: false,
    requireInteraction: false,
    data: {
      url: payload.url || "/dashboard?tab=newsroom",
      item_id: payload.item_id,
      raw_article_id: payload.raw_article_id,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard?tab=newsroom";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});
