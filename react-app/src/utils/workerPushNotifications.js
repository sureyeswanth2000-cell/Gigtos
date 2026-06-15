import app, { functionsInstance } from '../firebase';
import { httpsCallable } from 'firebase/functions';

const VAPID_KEY =
  process.env.REACT_APP_FIREBASE_VAPID_KEY ||
  process.env.REACT_APP_FIREBASE_WEB_PUSH_VAPID_KEY ||
  '';

function getServiceWorkerPath() {
  const base = process.env.PUBLIC_URL || '';
  return `${base}/firebase-messaging-sw.js`;
}

export async function registerWorkerOfferPushToken() {
  if (process.env.NODE_ENV === 'test') {
    return { status: 'unsupported', message: 'Push registration is skipped in tests.' };
  }
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return { status: 'unsupported', message: 'This browser does not support job offer notifications.' };
  }
  if (!VAPID_KEY) {
    return { status: 'missing_vapid_key', message: 'Web push key is not configured yet.' };
  }

  const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
  if (!await isSupported()) {
    return { status: 'unsupported', message: 'Firebase messaging is not supported in this browser.' };
  }

  const permission = window.Notification.permission === 'granted'
    ? 'granted'
    : await window.Notification.requestPermission();
  if (permission !== 'granted') {
    return { status: 'permission_denied', message: 'Notifications are blocked. Smart Queue still works inside the app.' };
  }

  const serviceWorkerRegistration = await navigator.serviceWorker.register(getServiceWorkerPath());
  const token = await getToken(getMessaging(app), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration,
  });

  if (!token) {
    return { status: 'no_token', message: 'Could not create a notification token for this browser.' };
  }

  await httpsCallable(functionsInstance, 'registerWorkerPushToken')({
    token,
    platform: 'web',
    permission: 'granted',
    userAgent: navigator.userAgent || '',
  });

  return { status: 'registered', message: 'Job offer alerts are enabled on this browser.' };
}

export async function listenForWorkerOfferPushMessages(onOfferMessage) {
  if (process.env.NODE_ENV === 'test' || typeof window === 'undefined') return () => {};
  try {
    const { getMessaging, isSupported, onMessage } = await import('firebase/messaging');
    if (!await isSupported()) return () => {};
    return onMessage(getMessaging(app), (payload) => {
      if (payload?.data?.type === 'smart_queue_offer') {
        onOfferMessage?.(payload);
      }
    });
  } catch {
    return () => {};
  }
}
