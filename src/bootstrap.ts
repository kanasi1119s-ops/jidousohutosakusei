import { render } from './main'

render()

// file://で直接開いた場合はService Worker登録が必ず失敗するため、
// http(s)経由で配信されている場合のみ登録する
if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }))
  })
}
