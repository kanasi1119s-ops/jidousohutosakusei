import './style.css'
import { simulate, validateInput, parseNumberLoose, type SimulatorInput, type SimulationResult } from './calc'
import { SOURCE_NOTE, AS_OF, TAXABLE_ACCOUNT_TAX_RATE } from './limits'
import { loadInput, saveInput, inputToJsonBlob, parseInputFromJsonText } from './storage'
import { buildResultsCsvBlob, csvDownloadFileName } from './csv'

const DEFAULT_INPUT: SimulatorInput = { initialYen: 0, tsumitateMonthlyYen: 30000, growthMonthlyYen: 0, annualReturnPercent: 3, years: 20 }

const FIELDS: { key: keyof SimulatorInput; label: string; inputmode: string }[] = [
  { key: 'initialYen', label: '初期投資額（円・成長投資枠に初年度一括）', inputmode: 'numeric' },
  { key: 'tsumitateMonthlyYen', label: 'つみたて投資枠 毎月の積立額（円・上限10万円）', inputmode: 'numeric' },
  { key: 'growthMonthlyYen', label: '成長投資枠 毎月の積立額（円）', inputmode: 'numeric' },
  { key: 'annualReturnPercent', label: '想定年利（%・将来の成果を保証するものではありません）', inputmode: 'decimal' },
  { key: 'years', label: '運用年数（1〜60年）', inputmode: 'numeric' },
]

const app = document.getElementById('app')
if (!app) throw new Error('#app 要素が見つかりません')

const yen = (n: number): string => n.toLocaleString('ja-JP') + '円'

app.innerHTML = `
  <h1>新NISA積立シミュレーター</h1>
  <p class="subtitle">積立額・想定年利・運用年数から、新NISAの将来評価額と課税口座との税額差を試算します。</p>
  <div>
    <span class="privacy-badge">登録不要</span>
    <span class="privacy-badge">入力データは外部送信されません</span>
    <span class="privacy-badge">オフラインでも利用可能</span>
  </div>
  <form id="sim-form" novalidate>
    ${FIELDS.map(
      (f) => `<div class="field"><label for="${f.key}">${f.label}</label>
      <input type="text" inputmode="${f.inputmode}" id="${f.key}" name="${f.key}" autocomplete="off" /></div>`,
    ).join('')}
    <div class="errors" id="errors" role="alert"></div>
    <div class="actions">
      <button type="submit">試算する</button>
      <button type="button" class="secondary" id="export-json">設定をエクスポート(JSON)</button>
      <button type="button" class="secondary" id="import-json">設定をインポート(JSON)</button>
      <input type="file" id="import-file" accept="application/json" class="hidden" />
      <button type="button" class="secondary" id="export-csv">結果をCSVでダウンロード</button>
    </div>
  </form>
  <section class="hidden" id="summary">
    <h2>試算結果</h2>
    <div class="cards" id="cards"></div>
    <div class="notice hidden" id="cap-notice"></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>経過年数</th><th>累計元本</th><th>評価額</th><th>運用益</th></tr></thead>
        <tbody id="result-body"></tbody>
      </table>
    </div>
  </section>
  <section class="disclaimer">
    <p><strong>ご注意:</strong> 本ツールは一般的な試算であり、投資勧誘・運用成果の保証・税務上の助言ではありません。実際の運用成果は市場環境により変動し、元本割れの可能性があります。手数料・信託報酬・為替・インフレ・将来の制度変更は考慮していません。年利は毎月複利換算（月初に投資・月末に運用成果を反映）の単純モデルです。課税口座との比較は、売却時の譲渡益に一律${(TAXABLE_ACCOUNT_TAX_RATE * 100).toFixed(3)}%を課す仮定で、配当課税・損益通算は考慮していません。</p>
    <p>${SOURCE_NOTE}（基準日: ${AS_OF}）最新の制度は <a href="https://www.fsa.go.jp/policy/nisa2/" rel="noopener noreferrer" target="_blank">金融庁 NISA特設ウェブサイト</a> でご確認ください。</p>
    <p>入力内容はお使いのブラウザ内（localStorage）にのみ保存され、外部には送信されません。</p>
  </section>
`

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T
const form = $<HTMLFormElement>('sim-form')
let lastResult: SimulationResult | null = null

function readInput(): SimulatorInput {
  const o: Record<string, number> = {}
  for (const f of FIELDS) o[f.key] = parseNumberLoose($<HTMLInputElement>(f.key).value)
  return o as unknown as SimulatorInput
}

function writeInput(i: SimulatorInput): void {
  for (const f of FIELDS) $<HTMLInputElement>(f.key).value = String(i[f.key])
}

function render(r: SimulationResult): void {
  $('summary').classList.remove('hidden')
  $('cards').innerHTML = [
    ['累計元本', yen(r.principalYen)],
    ['最終評価額', yen(r.valueYen)],
    ['運用益（非課税）', yen(r.gainYen)],
    ['課税口座との税額差の目安', yen(r.nisaSavingYen)],
  ]
    .map(([k, v]) => `<div class="card"><div>${k}</div><div class="v">${v}</div></div>`)
    .join('')
  const notice = $('cap-notice')
  notice.classList.toggle('hidden', !r.capped)
  notice.textContent = r.capped ? '非課税保有限度額（生涯1,800万円／うち成長投資枠1,200万円）に達したため、それ以降の積立は試算に含めていません。' : ''
  $('result-body').innerHTML = r.rows
    .map((x) => `<tr><td>${x.year}年目</td><td>${yen(x.principalYen)}</td><td>${yen(x.valueYen)}</td><td>${yen(x.gainYen)}</td></tr>`)
    .join('')
}

function run(): void {
  const input = readInput()
  const errs = validateInput(input)
  $('errors').textContent = errs.join('\n')
  if (errs.length) {
    lastResult = null
    $('summary').classList.add('hidden')
    return
  }
  saveInput(input)
  lastResult = simulate(input)
  render(lastResult)
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

form.addEventListener('submit', (e) => {
  e.preventDefault()
  run()
})

$('export-json').addEventListener('click', () => {
  const input = readInput()
  const errs = validateInput(input)
  if (errs.length) {
    $('errors').textContent = errs.join('\n')
    return
  }
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  download(inputToJsonBlob(input), `nisa-settings-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`)
})

$('export-csv').addEventListener('click', () => {
  if (!lastResult) run()
  if (lastResult) download(buildResultsCsvBlob(lastResult), csvDownloadFileName())
})

const fileInput = $<HTMLInputElement>('import-file')
$('import-json').addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const input = parseInputFromJsonText(text)
    writeInput(input)
    run()
  } catch (e) {
    $('errors').textContent = e instanceof Error ? e.message : '読み込みに失敗しました。'
  } finally {
    fileInput.value = ''
  }
})

writeInput(loadInput() ?? DEFAULT_INPUT)
run()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => undefined)
}
