import './style.css'
import { simulate, validateInput, parseNumber, type NisaInput, type NisaResult } from './calc'
import { loadInput, saveInput, inputToJsonBlob, parseInput } from './storage'
import { buildResultsCsvBlob, csvDownloadFileName } from './csv'

const DEFAULT_INPUT: NisaInput = {
  initialPrincipalYen: 0,
  monthlyTsumitateYen: 50000,
  annualGrowthYen: 0,
  annualReturnPct: 3,
  feePct: 0.2,
  years: 20,
}
const IDS: (keyof NisaInput)[] = ['initialPrincipalYen', 'monthlyTsumitateYen', 'annualGrowthYen', 'annualReturnPct', 'feePct', 'years']

const app = document.getElementById('app')
if (!app) throw new Error('#app 要素が見つかりません')

app.innerHTML = `
  <h1>新NISA積立シミュレーター</h1>
  <p class="subtitle">毎月の積立額と想定利回りから、将来の評価額と非課税メリットの目安を試算します。</p>
  <div>
    <span class="privacy-badge">登録不要</span>
    <span class="privacy-badge">入力データは外部送信されません</span>
    <span class="privacy-badge">オフラインでも利用可能</span>
  </div>
  <form id="sim-form" novalidate>
    <div class="field"><label for="initialPrincipalYen">既にNISAで投資済みの元本（円）</label><input type="text" inputmode="decimal" id="initialPrincipalYen" /></div>
    <div class="field"><label for="monthlyTsumitateYen">毎月のつみたて投資枠（円・月10万円まで）</label><input type="text" inputmode="decimal" id="monthlyTsumitateYen" /></div>
    <div class="field"><label for="annualGrowthYen">成長投資枠への年間投資額（円・240万円まで、各年の初月に投資）</label><input type="text" inputmode="decimal" id="annualGrowthYen" /></div>
    <div class="field"><label for="annualReturnPct">想定年利回り（%）</label><input type="text" inputmode="decimal" id="annualReturnPct" /></div>
    <div class="field"><label for="feePct">年間コスト（信託報酬など・%）</label><input type="text" inputmode="decimal" id="feePct" /></div>
    <div class="field"><label for="years">運用年数（1〜60）</label><input type="text" inputmode="numeric" id="years" /></div>
    <div class="errors" id="errors" role="alert"></div>
    <div class="actions">
      <button type="submit">試算する</button>
      <button type="button" class="secondary" id="export-json">設定をエクスポート(JSON)</button>
      <button type="button" class="secondary" id="import-json">設定をインポート(JSON)</button>
      <input type="file" id="import-file" accept="application/json" class="hidden" />
      <button type="button" class="secondary" id="export-csv">結果をCSVでダウンロード</button>
    </div>
  </form>
  <div class="summary hidden" id="summary">
    <h2>試算結果</h2>
    <p id="final-value"></p>
    <p id="tax-note"></p>
    <table>
      <thead><tr><th>経過年</th><th>元本</th><th>評価額</th><th>運用益</th></tr></thead>
      <tbody id="result-body"></tbody>
    </table>
  </div>
  <p class="disclaimer">
    本試算は想定利回りが毎年一定という仮定に基づく一般的な目安であり、将来の運用成果を保証するものではありません。
    元本割れの可能性があります。制度上限（年360万円・生涯1,800万円・うち成長投資枠1,200万円）は金融庁の公表（基準日: 2026年10月）に基づき、
    未成年向け枠など制度改正は反映していません。個別の投資判断は金融機関・専門家にご相談ください。税率は一律20.315%で計算しています。
    データはこのブラウザ内にのみ保存されます。
  </p>
`

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const yen = (n: number) => n.toLocaleString('ja-JP') + '円'
let last: NisaResult | null = null

function readInput(): NisaInput {
  const o = {} as NisaInput
  for (const k of IDS) o[k] = parseNumber(el<HTMLInputElement>(k).value)
  return o
}
function writeInput(i: NisaInput) {
  for (const k of IDS) el<HTMLInputElement>(k).value = String(i[k])
}

function render(r: NisaResult) {
  last = r
  el('summary').classList.remove('hidden')
  el('final-value').textContent = `${r.rows.length}年後の評価額の目安: ${yen(r.final.valueYen)}（元本 ${yen(r.final.principalYen)}、運用益 ${yen(r.final.gainYen)}）`
  el('tax-note').textContent = `非課税メリットの目安: 約${yen(r.final.taxSavedYen)}（課税口座なら税引後評価額は約${yen(r.taxableValueYen)}）` +
    (r.final.limitReached ? ' ※生涯投資枠1,800万円に到達し、以降は新規投資を停止した前提です。' : '')
  el('result-body').innerHTML = ''
  for (const x of r.rows) {
    const tr = document.createElement('tr')
    for (const t of [`${x.year}年`, yen(x.principalYen), yen(x.valueYen), yen(x.gainYen)]) {
      const td = document.createElement('td')
      td.textContent = t
      tr.appendChild(td)
    }
    el('result-body').appendChild(tr)
  }
}

function run() {
  const i = readInput()
  const errs = validateInput(i)
  el('errors').textContent = errs.join(' ')
  if (errs.length) return
  saveInput(i)
  render(simulate(i))
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

el('sim-form').addEventListener('submit', (e) => { e.preventDefault(); run() })
el('export-json').addEventListener('click', () => {
  const i = readInput()
  if (validateInput(i).length) return run()
  download(inputToJsonBlob(i), 'nisa-settings.json')
})
el('export-csv').addEventListener('click', () => {
  if (!last) run()
  if (last) download(buildResultsCsvBlob(last), csvDownloadFileName())
})
el('import-json').addEventListener('click', () => el<HTMLInputElement>('import-file').click())
el<HTMLInputElement>('import-file').addEventListener('change', async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  try {
    writeInput(parseInput(await f.text()))
    run()
  } catch (err) {
    el('errors').textContent = err instanceof Error ? err.message : '読み込みに失敗しました。'
  }
  ;(e.target as HTMLInputElement).value = ''
})

writeInput(loadInput() ?? DEFAULT_INPUT)
run()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // 登録に失敗しても通常利用は継続できる
    })
  })
}
