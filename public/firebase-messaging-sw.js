// Firebase messaging service worker
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyC5PQErQtSFAIkG779kfK_UhaS5hYflwuY",
  authDomain: "show-tracker-d7a4d.firebaseapp.com",
  projectId: "show-tracker-d7a4d",
  storageBucket: "show-tracker-d7a4d.firebasestorage.app",
  messagingSenderId: "580565525718",
  appId: "1:580565525718:web:b9a2aa57320a007dad1577"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);

  const { title, body, icon } = payload.notification || {};

  self.registration.showNotification(title || 'MySetlists', {
    body: body || 'You have a new notification',
    icon: icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'mysetlists-notification',
    data: payload.data
  });
});
