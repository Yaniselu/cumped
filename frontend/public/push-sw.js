/*
 * Service worker pentru alertele Cumped pe site (Web Push).
 * Primește mesajul criptat de la serviciul de push al browserului (browserul îl decriptează),
 * afișează notificarea și, la apăsare, deschide pagina potrivită din Cumped.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
  const url = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/notifications';
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // aplicația e deschisă și vizibilă: îi spunem s-o arate în interior (fără notificare de sistem în plus)
    const visible = wins.find((c) => c.visibilityState === 'visible');
    wins.forEach((c) => c.postMessage({ kind: 'cumped-push', payload: { ...data, url } }));
    if (visible && data.type !== 'PUSH_TEST' && !String(data.type || '').startsWith('SECURITY_')) return;
    await self.registration.showNotification(data.title || 'Cumped', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.tag || data.type || 'cumped',
      renotify: true,
      data: { url },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/notifications', self.location.origin);
  if (url.origin !== self.location.origin) return; // doar pagini Cumped
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of wins) {
      if (new URL(c.url).origin === self.location.origin) {
        await c.focus();
        c.postMessage({ kind: 'cumped-open', url: url.pathname + url.search });
        return;
      }
    }
    await self.clients.openWindow(url.href);
  })());
});

// browserul a reînnoit abonamentul: îl trimitem din nou la server când aplicația se deschide
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then((wins) => wins.forEach((c) => c.postMessage({ kind: 'cumped-resubscribe' }))));
});
