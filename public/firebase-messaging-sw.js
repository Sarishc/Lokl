/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js');

const firebaseParams = new URL(self.location.href).searchParams;

firebase.initializeApp({
  apiKey: firebaseParams.get('apiKey'),
  authDomain: firebaseParams.get('authDomain'),
  projectId: firebaseParams.get('projectId'),
  storageBucket: firebaseParams.get('storageBucket'),
  messagingSenderId: firebaseParams.get('messagingSenderId'),
  appId: firebaseParams.get('appId'),
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification?.title || 'Lokl', {
    body: payload.notification?.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: payload.data || {},
  });
});
