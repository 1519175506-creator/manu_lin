// Service Worker - 离线缓存
const CACHE_NAME = 'recipe-app-v30';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js?v=33',
  './js/db.js?v=33',
  './js/init-data.js?v=33',
  './js/dishes.js?v=33',
  './js/add-dish.js?v=33',
  './js/meals.js?v=33',
  './js/plan.js?v=33',
  './js/order.js?v=33',
  './js/settings.js?v=33',
  './data/initial-dishes.json?v=33',
  './data/recipes.json?v=33',
  './data/full-backup.json?v=33',
  './data/收藏夹菜谱1.txt',
  './data/收藏夹菜谱2.txt',
  './data/douyin-video-links.txt',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://unpkg.com/dexie@3.2.7/dist/dexie.min.js'
];

// 安装：缓存资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(err => {
        console.log('部分资源缓存失败:', err);
      });
    })
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// 处理 SKIP_WAITING 消息
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 拦截请求：缓存优先，网络回退
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isAppShell = event.request.mode === 'navigate' ||
    /\.(?:js|css|html)$/.test(url.pathname);

  if (isAppShell) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
