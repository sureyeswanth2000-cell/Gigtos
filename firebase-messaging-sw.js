/* global firebase */
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDMJvNKvgwfEvymuLaXhGQwJr-Id4yExYU',
  authDomain: 'gigto-c0c83.firebaseapp.com',
  projectId: 'gigto-c0c83',
  storageBucket: 'gigtos-user-uploads-gigto-c0c83',
  messagingSenderId: '190454381677',
  appId: '1:190454381677:web:458b1638c984ababcdd364',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const title = payload.notification?.title || data.title || 'New Gigtos job offer';
  const body = payload.notification?.body || data.body || 'Open Gigtos to accept or skip this Smart Queue offer.';
  const offerUrl = data.offerUrl || '/Gigtos/#/worker/dashboard';

  self.registration.showNotification(title, {
    body,
    tag: data.offerId ? `smart-queue-offer-${data.offerId}` : 'smart-queue-offer',
    data: { offerUrl },
    requireInteraction: true,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.offerUrl || '/Gigtos/#/worker/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find(client => client.url.includes('/Gigtos'));
      if (existing) {
        existing.focus();
        return existing.navigate(targetUrl);
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
