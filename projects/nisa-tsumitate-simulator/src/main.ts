import './style.css'
import { DEFAULT_INPUT, simulate, validateInput, type SimulationResult, type SimulatorInput } from './calc'
import { LIMITS_AS_OF, LIMITS_SOURCE_NOTE, NISA_LIMITS } from './limits'
import { buildResultsCsvBlob, csvDownloadFileName } from './csv'
import { inputToJsonBlob, loadInput, parseInputFromJsonText, saveInput } from './storage'

const app = document.getElementById('app') as HTMLDivElement

// 固定のHTMLのみ（ユーザー入力は含まない）。計算結果の描画はtextContent/DOM APIで行う。
app.innerHTML = `
  <h1>新NISA積立シミュレーター</h1>
  <p class="subtitle">積立額・利回り・期間から、NISAの投資枠上限と課税口座との差まで試算します。</p>
  <div>
    <span class="privacy-badge">登録不要</span>
    <span class="privacy-badge">入力データは外部送信されません</span>
    <span class="privacy-badge">オフラインでも利用可能</span>
  </div>
  <form id="sim-form" novalidate>
    <div class="field"><label for="initialYen">開始時の一括投資額（円）</label>
      <input type="number" id="initialYen" name="initialYen" min="0" step="1" inputmode="numeric" required /></div>
    <div class="field"><label for="monthlyYen">毎月の積立額（円）</label>
      <input type="number" id="monthlyYen" name="monthlyYen" min="0" step="1" inputmode="numeric" required /></div>
    <div class="field"><label for="annualReturnPct">想定年利（%・手数料控除後）</label>
      <input type="number" id="annualReturnPct" name="annualReturnPct" step="0.1" inputmode="decimal" required /></div>
    <div class="field"><label for="years">運用期間（年）</label>
      <input type="number" id="years" name="years" min="1" max="60" step="1" inputmode="numeric" required /></div>
    <div class="field"><label for="inflationPct">想定インフレ率（%/年）</label>
      <input type="number" id="inflationPct" name="inflationPct" step="0.1" inputmode="decimal" required /></div>
    <div class="field"><label for="goalYen">目標金額（円・未設定なら0）</label>
      <input type="number" id="goalYen" name="goalYen" min="0" step="1" inputmode="numeric" required /></div>
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
    <div class="kpis" id="kpis"></div>
    <p class="warn" id="warnings"></p>
    <p id="goal-result"></p>
    <svg id="chart" class="chart" viewBox="0 0 600 260" role="img" aria-label="元本とNISA評価額の推移グラフ"></svg>
    <p class="legend">実線: NISA評価額 / 破線: 元本累計</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>年</th><th>元本累計</th><th>NISA評価額</th><th>運用益</th><th>課税口座手取り</th><th>実質価値</th></tr></thead>
        <tbody id="result-body"></tbody>
      </table>
    </div>
  </div>
  <div class="disclaimer">
    <strong>免責事項:</strong>
    本ツールは一般的な試算を簡易に行うものであり、投資助言・税務上の助言ではありません。将来の運用成果を保証するものではなく、
    実際の利回りは変動し元本割れとなる場合があります。信託報酬・手数料、売却時期、配当・分配金の扱い、
    枠の再利用（売却による枠の復活）は考慮していません。課税口座の手取りは期末に全額売却した場合の目安（税率${(NISA_LIMITS.taxableRate * 100).toFixed(3)}%）です。
    ${LIMITS_SOURCE_NOTE}
    重要な判断の前には金融庁・証券会社の最新情報、またはファイナンシャルプランナー等の専門家にご確認ください。
  </div>
  <footer>入力データはこの端末のブラウザ内にのみ保存されます（サーバーへの送信は行いません）。制度の基準日: ${LIMITS_AS_OF}</footer>
`

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const form = $<HTMLFormElement>('sim-form')
const errorsEl = $<HTMLDivElement>('errors')
const summaryEl = $<HTMLDivElement>('summary')
const kpisEl = $<HTMLDivElement>('kpis')
const warningsEl = $<HTMLParagraphElement>('warnings')
const goalEl = $<HTMLParagraphElement>('goal-result')
const chartEl = document.getElementById('chart') as unknown as SVGSVGElement
const resultBody = $<HTMLTableSectionElement>('result-body')
const importFile = $<HTMLInputElement>('import-file')

const FIELDS: (keyof SimulatorInput)[] = [
  'initialYen',
  'monthlyYen',
  'annualReturnPct',
  'years',
  'inflationPct',
  'goalYen',
]

let lastResult: SimulationResult | null = null

function readFormInput(): SimulatorInput {
  const data = new FormData(form)
  const out = {} as SimulatorInput
  for (const k of FIELDS) {
    // 全角数字・カンマ混じりの貼り付けに備え、文字列として受けてから正規化する
    const raw = String(data.get(k) ?? '')
      .replace(/[０-９．－]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
      .replace(/,/g, '')
      .trim()
    out[k] = raw === '' ? NaN : Number(raw)
  }
  return out
}

function fillForm(input: SimulatorInput): void {
  for (const k of FIELDS) {
    ;(form.elements.namedItem(k) as HTMLInputElement).value = String(input[k])
  }
}

const yen = (v: number) => Math.round(v).toLocaleString('ja-JP') + '円'

function kpi(label: string, value: string): HTMLDivElement {
  const d = document.createElement('div')
  d.className = 'kpi'
  const s = document.createElement('small')
  s.textContent = label
  const b = document.createElement('strong')
  b.textContent = value
  d.append(s, b)
  return d
}

function svg(name: string, attrs: Record<string, string>, text?: string): SVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', name)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  if (text !== undefined) el.textContent = text
  return el
}

function drawChart(result: SimulationResult): void {
  chartEl.replaceChildren()
  const W = 600
  const H = 260
  const padL = 70
  const padR = 12
  const padT = 12
  const padB = 28
  const rows = result.rows
  const maxY = Math.max(1, ...rows.map((r) => Math.max(r.nisaValueYen, r.principalYen)))
  const x = (i: number) => padL + ((W - padL - padR) * (rows.length === 1 ? 1 : i / (rows.length - 1)))
  const y = (v: number) => padT + (H - padT - padB) * (1 - Math.max(0, v) / maxY)
  chartEl.append(svg('line', { class: 'axis', x1: String(padL), y1: String(H - padB), x2: String(W - padR), y2: String(H - padB) }))
  chartEl.append(svg('line', { class: 'axis', x1: String(padL), y1: String(padT), x2: String(padL), y2: String(H - padB) }))
  chartEl.append(svg('text', { x: String(padL - 6), y: String(padT + 8), 'text-anchor': 'end' }, `${Math.round(maxY / 10000).toLocaleString('ja-JP')}万円`))
  chartEl.append(svg('text', { x: String(padL - 6), y: String(H - padB), 'text-anchor': 'end' }, '0'))
  chartEl.append(svg('text', { x: String(W - padR), y: String(H - 8), 'text-anchor': 'end' }, `${rows.length}年`))
  const pts = (f: (r: SimulationResult['rows'][number]) => number) =>
    rows.map((r, i) => `${x(i).toFixed(1)},${y(f(r)).toFixed(1)}`).join(' ')
  chartEl.append(svg('polyline', { class: 'line-principal', points: pts((r) => r.principalYen) }))
  chartEl.append(svg('polyline', { class: 'line-nisa', points: pts((r) => r.nisaValueYen) }))
  // 1年のみの場合は線が引けないため、終点に点を描く
  const last = rows.length - 1
  chartEl.append(svg('circle', { cx: x(last).toFixed(1), cy: y(rows[last].nisaValueYen).toFixed(1), r: '4', fill: '#1f6f5c' }))
}

function renderResult(input: SimulatorInput): void {
  const errors = validateInput(input)
  errorsEl.textContent = errors.join(' ')
  if (errors.length > 0) {
    summaryEl.classList.add('hidden')
    lastResult = null
    return
  }
  const result = simulate(input)
  lastResult = result
  const f = result.final

  kpisEl.replaceChildren(
    kpi('元本合計', yen(f.principalYen)),
    kpi('NISA評価額', yen(f.nisaValueYen)),
    kpi('運用益（非課税）', yen(f.gainYen)),
    kpi('課税口座との差（目安）', yen(f.taxSavedYen)),
    kpi('実質価値（インフレ調整後）', yen(f.realValueYen)),
  )

  const warns: string[] = []
  if (result.annualLimitHit) warns.push(`年間投資枠（${yen(NISA_LIMITS.annualYen)}）を超える分はNISAで投資できないため、試算から除外しています。`)
  if (result.lifetimeLimitHit) warns.push(`生涯投資枠（${yen(NISA_LIMITS.lifetimeYen)}）に達したため、以降の積立は試算から除外しています。`)
  if (result.overflowYen > 0) warns.push(`枠超過で投資できなかった額: ${yen(result.overflowYen)}`)
  warningsEl.textContent = warns.join(' ')

  if (input.goalYen > 0) {
    goalEl.textContent =
      result.requiredMonthlyYen === null
        ? `目標金額 ${yen(input.goalYen)} は、年間投資枠の範囲内では期間内に届きません。`
        : `目標金額 ${yen(input.goalYen)}（名目）に届く毎月の積立額の目安: ${yen(result.requiredMonthlyYen)}`
  } else {
    goalEl.textContent = ''
  }

  drawChart(result)
  resultBody.replaceChildren(
    ...result.rows.map((r) => {
      const tr = document.createElement('tr')
      for (const v of [`${r.year}年`, yen(r.principalYen), yen(r.nisaValueYen), yen(r.gainYen), yen(r.taxableNetYen), yen(r.realValueYen)]) {
        const td = document.createElement('td')
        td.textContent = v
        tr.append(td)
      }
      return tr
    }),
  )
  summaryEl.classList.remove('hidden')
  saveInput(input)
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

form.addEventListener('submit', (e) => {
  e.preventDefault()
  renderResult(readFormInput())
})

$('export-json').addEventListener('click', () => {
  download(inputToJsonBlob(readFormInput()), 'nisa-simulator-settings.json')
})
$('import-json').addEventListener('click', () => importFile.click())
importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0]
  if (!file) return
  try {
    const input = parseInputFromJsonText(await file.text())
    fillForm(input)
    renderResult(input)
  } catch (err) {
    errorsEl.textContent = err instanceof Error ? err.message : 'インポートに失敗しました。'
  } finally {
    importFile.value = ''
  }
})
$('export-csv').addEventListener('click', () => {
  if (!lastResult) {
    errorsEl.textContent = '先に「試算する」を押して結果を表示してください。'
    return
  }
  download(buildResultsCsvBlob(lastResult), csvDownloadFileName())
})

const saved = loadInput() ?? DEFAULT_INPUT
fillForm(saved)
renderResult(saved)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
