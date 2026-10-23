const CACHE_NAME = 'cal-weather-cache-v7';
const APP_SHELL = [
  './',
  './index.html',
  './chart.umd.min.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png'
];

// 1. 설치: 즉시 활성화 준비 및 캐싱
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
});

// 2. 활성화: 이전 버전의 모든 오래된 캐시 즉시 완전 삭제 및 클라이언트 제어
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            return caches.delete(k);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// 3. 알림 클릭 이벤트 처리 (잠금화면/배너 클릭 시 PWA 창 열기)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./index.html');
      }
    })
  );
});

// 4. 요청 처리 (HTML 문서: Network-First로 항상 최신 버전 보장)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 외부 API/CDN 요청: 서비스 워커 가로채기 제외 (브라우저 직접 통신)
  if (url.origin !== self.location.origin) {
    return;
  }

  // HTML 문서 및 메인 페이지: Network-First (네트워크 우선 -> 실패 시 캐시)
  const isHtml = event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/');

  if (isHtml) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            return cached || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // 기타 정적 파일: Cache-First
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
