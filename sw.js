const CACHE_NAME = 'cal-weather-cache-v6';
const APP_SHELL = [
  './',
  './index.html',
  './chart.umd.min.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png'
];

// 설치: 앱 셸 파일을 캐시에 저장
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

// 활성화: 이전 버전 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 알림 클릭 이벤트 처리 (잠금화면/배너 클릭 시 PWA 창 열기)
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

// 요청 처리:
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. 외부 날씨/위치 API 요청 (실시간 네트워크 통신, 실패 시 빈 JSON)
  const isApi =
    url.hostname.includes('open-meteo.com') ||
    url.hostname.includes('nominatim.openstreetmap.org') ||
    url.hostname.includes('ipapi.co') ||
    url.hostname.includes('ipwho.is');

  if (isApi) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  // 2. 외부 CDN 스크립트/폰트/Firebase 요청 (서비스 워커에서 가로채지 않고 브라우저 직접 통신)
  if (url.origin !== self.location.origin) {
    return;
  }

  // 3. 동일 출처 앱 셸 (캐시 우선, 네트워크 백업)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && url.origin === self.location.origin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
