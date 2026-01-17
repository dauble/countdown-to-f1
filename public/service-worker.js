// Minimal service worker to prevent 404 errors
// This service worker does nothing but satisfies browser requests

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  return self.clients.claim();
});

// No fetch event handler - no caching or offline functionality
