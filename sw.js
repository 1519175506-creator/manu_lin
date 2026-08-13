// Service Worker - 离线缓存
const CACHE_NAME = 'recipe-app-v11';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js?v=8',
  './js/db.js?v=8',
  './js/init-data.js?v=8',
  './js/dishes.js?v=8',
  './js/add-dish.js?v=8',
  './js/meals.js?v=8',
  './js/plan.js?v=8',
  './js/settings.js?v=8',
  './data/initial-dishes.json?v=8',
  './data/recipes.json?v=8',
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
  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // 缓存新资源（同源）
        if (response.ok && event.request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // 离线回退
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
