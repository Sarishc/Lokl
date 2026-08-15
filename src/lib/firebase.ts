const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseVapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

function hasFirebaseConfig() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId && firebaseVapidKey);
}

async function registerFirebaseMessagingWorker() {
  if (!('serviceWorker' in navigator)) return undefined;
  const params = new URLSearchParams(Object.entries(firebaseConfig).filter(([, value]) => Boolean(value)) as [string, string][]);
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params.toString()}`, {
    scope: '/firebase-cloud-messaging-push-scope',
  });
}

export async function initPushNotifications(onForegroundMessage?: (payload: { notification?: { title?: string; body?: string }; data?: Record<string, string> }) => void) {
  if (!hasFirebaseConfig()) return null;
  const [{ initializeApp, getApps }, { getMessaging, getToken, isSupported, onMessage }] = await Promise.all([
    import('firebase/app'),
    import('firebase/messaging'),
  ]);
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;

  const app = getApps()[0] || initializeApp(firebaseConfig);
  const messaging = getMessaging(app);
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;
  const serviceWorkerRegistration = await registerFirebaseMessagingWorker();
  if (onForegroundMessage) onMessage(messaging, onForegroundMessage);

  return getToken(messaging, {
    vapidKey: firebaseVapidKey,
    serviceWorkerRegistration,
  }).catch(() => null);
}
