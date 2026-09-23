const CACHE_NAME = 'income-wall-simulator-v1'
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      await cache.addAll(APP_SHELL)
      // Vite はビルドごとにハッシュ付きファイル名(assets/index-xxxx.js等)を生成するため、
      // 静的リストではなくビルド済みindex.htmlを読んで実際の参照先を動的にキャッシュする。
      try {
        const res = await fetch('./index.html')
        const html = await res.text()
        const assetPaths = Array.from(html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)).map(
          (m) => m[1],
        )
        if (assetPaths.length > 0) {
          await cache.addAll(assetPaths)
        }
      } catch {
        // オフライン初回インストール等では取得できないことがあるが、
        // その場合も fetch ハンドラのランタイムキャッシュで後から補完される
      }
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      // ページの再読み込み(reload)で発行されるモジュールスクリプト等のリクエストは
      // 内部的に cache: "no-store" 相当になり、Request オブジェクトのまま
      // cache.match() に渡すとキーが存在してもマッチしないことがある（オフライン検証で発見）。
      // URL文字列で照合することでこの問題を回避する。
      const cached = await cache.match(event.request.url, { ignoreVary: true })
      if (cached) return cached
      try {
        const response = await fetch(event.request)
        cache.put(event.request, response.clone())
        return response
      } catch (e) {
        throw e
      }
    })(),
  )
})
