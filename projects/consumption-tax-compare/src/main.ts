import './style.css'
import { compute, emptyInput, parseYen, validateInput, type TaxInput, type TaxResult } from './calc'
import { AS_OF, BUSINESS_TYPES, SOURCE_NOTE, SUPPORTED_YEARS, TRANSITIONAL_RATES, type SupportedYear } from './rules'
import { inputToJsonBlob, loadInput, parseInputFromJsonText, saveInput } from './storage'
import { buildResultsCsvBlob, csvDownloadFileName } from './csv'

const DEFAULT_INPUT: TaxInput = {
  ...emptyInput(2027),
  sales10: [0, 0, 0, 0, 5_500_000, 0],
  purchases10: 1_100_000,
}

const app = document.getElementById('app')
if (!app) {
  throw new Error('#app 要素が見つかりません')
}

const yearOptions = SUPPORTED_YEARS.map((y) => `<option value="${y}">${y}年分（令和${y - 2018}年分）</option>`).join('')
const salesRows = BUSINESS_TYPES.map(
  (b, i) => `<div class="sales-row">
      <div class="sales-label">${b.label}<small>（みなし仕入率 ${Math.round(b.deemedRate * 100)}%）</small></div>
      <label class="sub" for="sales10-${i}">10%</label>
      <input type="text" inputmode="numeric" id="sales10-${i}" aria-label="${b.label} 標準税率10%の売上（税込）" />
      <label class="sub" for="sales8-${i}">8%</label>
      <input type="text" inputmode="numeric" id="sales8-${i}" aria-label="${b.label} 軽減税率8%の売上（税込）" />
    </div>`,
).join('')

app.innerHTML = `
  <h1>消費税 納税額比較シミュレーター</h1>
  <p class="subtitle">個人事業者向け。本則課税・簡易課税・2割特例・3割特例の納税額を並べて比較します。</p>
  <div>
    <span class="privacy-badge">登録不要</span>
    <span class="privacy-badge">入力データは外部送信されません</span>
    <span class="privacy-badge">オフラインでも利用可能</span>
  </div>
  <form id="sim-form" novalidate>
    <div class="field">
      <label for="year">対象の年分（暦年・個人事業者）</label>
      <select id="year">${yearOptions}</select>
    </div>
    <div class="field check">
      <input type="checkbox" id="converted" />
      <label for="converted">インボイス発行事業者の登録を機に、免税事業者から課税事業者になった</label>
    </div>
    <div class="field">
      <label for="baseYearSales">基準期間（2年前）の課税売上高（税抜・円）</label>
      <input type="text" inputmode="numeric" id="baseYearSales" />
      <span class="hint">2割・3割特例は1,000万円以下、簡易課税は5,000万円以下が要件です。</span>
    </div>
    <fieldset>
      <legend>課税売上高（税込・円）</legend>
      <div class="sales-grid">${salesRows}</div>
      <span class="hint">事業区分が1つなら該当する行だけ入力してください。本則課税の計算では区分は使いません。</span>
    </fieldset>
    <fieldset>
      <legend>課税仕入れ（税込・円、本則課税の計算に使用）</legend>
      <div class="field">
        <label for="purchases10">適格請求書発行事業者からの仕入・経費（標準税率10%）</label>
        <input type="text" inputmode="numeric" id="purchases10" />
      </div>
      <div class="field">
        <label for="purchases8">同（軽減税率8%）</label>
        <input type="text" inputmode="numeric" id="purchases8" />
      </div>
      <div class="field">
        <label for="exemptFirst" id="exemptFirstLabel">免税事業者等からの仕入（1/1〜9/30）</label>
        <input type="text" inputmode="numeric" id="exemptFirst" />
      </div>
      <div class="field">
        <label for="exemptSecond" id="exemptSecondLabel">免税事業者等からの仕入（10/1〜12/31）</label>
        <input type="text" inputmode="numeric" id="exemptSecond" />
        <span class="hint">インボイスのない仕入は経過措置の割合でのみ控除できます。10%として計算します。</span>
      </div>
    </fieldset>
    <div class="errors" id="errors" role="alert"></div>
    <div class="actions">
      <button type="submit">比較する</button>
      <button type="button" class="secondary" id="export-json">設定をエクスポート(JSON)</button>
      <button type="button" class="secondary" id="import-json">設定をインポート(JSON)</button>
      <input type="file" id="import-file" accept="application/json" class="hidden" />
      <button type="button" class="secondary" id="export-csv">結果をCSVでダウンロード</button>
    </div>
  </form>
  <div class="summary hidden" id="summary">
    <h2>比較結果（国税＋地方消費税）</h2>
    <p class="recommend" id="recommend"></p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>方式</th><th>納付税額 合計</th><th>国税</th><th>地方消費税</th><th>選択可否</th></tr>
        </thead>
        <tbody id="result-body"></tbody>
      </table>
    </div>
    <p class="hint">負の値は還付の見込みです。各方式の備考は下の一覧をご覧ください。</p>
    <ul id="notes"></ul>
    <div class="deadline" id="deadline"></div>
  </div>
  <div class="disclaimer">
    <strong>免責事項:</strong>
    本ツールは一般的な試算を簡易に行うものであり、税務申告書の作成や、税理士による税務相談に代わるものではありません。
    実際の納税額は、課税売上・仕入の範囲、端数処理、他の特例、課税期間の短縮等により異なります。
    法人・課税期間が暦年でない場合・課税売上高が5億円を超える場合・1億円を超える免税事業者等からの仕入などは対象外です。
    ${SOURCE_NOTE}
    重要な判断の前には、国税庁・財務省の最新の公表情報、または税理士にご確認ください。
  </div>
  <footer>入力データはこの端末のブラウザ内にのみ保存されます（サーバーへの送信は行いません）。基準日: ${AS_OF}</footer>
`

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T
const form = $<HTMLFormElement>('sim-form')
const errorsEl = $<HTMLDivElement>('errors')
const summaryEl = $<HTMLDivElement>('summary')
const recommendEl = $<HTMLParagraphElement>('recommend')
const resultBody = $<HTMLTableSectionElement>('result-body')
const notesEl = $<HTMLUListElement>('notes')
const deadlineEl = $<HTMLDivElement>('deadline')
const importFile = $<HTMLInputElement>('import-file')

let last: { input: TaxInput; result: TaxResult } | null = null

const yen = (v: number): string => Math.round(v).toLocaleString('ja-JP') + '円'
const text = (id: string): string => $<HTMLInputElement>(id).value

function readForm(): TaxInput {
  return {
    year: Number($<HTMLSelectElement>('year').value) as SupportedYear,
    convertedFromExempt: $<HTMLInputElement>('converted').checked,
    baseYearSalesYen: parseYen(text('baseYearSales')),
    sales10: BUSINESS_TYPES.map((_, i) => parseYen(text(`sales10-${i}`))),
    sales8: BUSINESS_TYPES.map((_, i) => parseYen(text(`sales8-${i}`))),
    purchases10: parseYen(text('purchases10')),
    purchases8: parseYen(text('purchases8')),
    exemptPurchasesFirst: parseYen(text('exemptFirst')),
    exemptPurchasesSecond: parseYen(text('exemptSecond')),
  }
}

function fillForm(input: TaxInput): void {
  const set = (id: string, v: number) => {
    $<HTMLInputElement>(id).value = v === 0 ? '' : String(v)
  }
  $<HTMLSelectElement>('year').value = String(input.year)
  $<HTMLInputElement>('converted').checked = input.convertedFromExempt
  set('baseYearSales', input.baseYearSalesYen)
  BUSINESS_TYPES.forEach((_, i) => {
    set(`sales10-${i}`, input.sales10[i])
    set(`sales8-${i}`, input.sales8[i])
  })
  set('purchases10', input.purchases10)
  set('purchases8', input.purchases8)
  set('exemptFirst', input.exemptPurchasesFirst)
  set('exemptSecond', input.exemptPurchasesSecond)
  updateExemptLabels()
}

function updateExemptLabels(): void {
  const year = Number($<HTMLSelectElement>('year').value) as SupportedYear
  const [a, b] = TRANSITIONAL_RATES[year]
  $('exemptFirstLabel').textContent = `免税事業者等からの仕入（1/1〜9/30、控除${Math.round(a * 100)}%）`
  $('exemptSecondLabel').textContent = `免税事業者等からの仕入（10/1〜12/31、控除${Math.round(b * 100)}%）`
}

function render(input: TaxInput): void {
  const errors = validateInput(input)
  errorsEl.textContent = errors.join(' ')
  if (errors.length > 0) {
    summaryEl.style.display = 'none'
    last = null
    return
  }
  const result = compute(input)
  last = { input, result }

  const rec = result.methods.find((m) => m.id === result.recommendedId)
  recommendEl.textContent = rec
    ? `要件上選べる方式のうち、納付額が最も少ないのは「${rec.label}」（${yen(rec.totalYen)}）です。`
    : '選べる方式がありません。'

  resultBody.innerHTML = result.methods
    .map((m) => {
      const mark = result.recommendedId === m.id ? ' ★' : ''
      const cls = m.available ? '' : 'na'
      return `<tr class="${cls}">
        <td>${m.label}${mark}</td>
        <td class="num">${yen(m.totalYen)}</td>
        <td class="num">${yen(m.nationalTaxYen)}</td>
        <td class="num">${yen(m.localTaxYen)}</td>
        <td>${m.available ? '可' : '不可'}</td>
      </tr>`
    })
    .join('')

  notesEl.replaceChildren(
    ...result.methods.map((m) => {
      const li = document.createElement('li')
      li.textContent = `${m.label}: ${m.notes.join(' ')}`
      return li
    }),
  )

  deadlineEl.textContent =
    `簡易課税を適用するには、適用したい年の前年12月31日までに届出が必要です。` +
    `${input.year}年分に適用するなら ${input.year - 1}年12月31日までです。` +
    `（3割特例を受けた翌年分の簡易課税への円滑な移行措置が別途設けられています。詳細は国税庁等で確認してください。）`

  summaryEl.style.display = 'block'
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
  render(readForm())
})
$<HTMLSelectElement>('year').addEventListener('change', updateExemptLabels)

$('export-json').addEventListener('click', () => {
  download(inputToJsonBlob(readForm()), 'consumption-tax-compare-settings.json')
})
$('import-json').addEventListener('click', () => importFile.click())
importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0]
  if (!file) return
  try {
    const input = parseInputFromJsonText(await file.text())
    fillForm(input)
    render(input)
  } catch (err) {
    errorsEl.textContent = err instanceof Error ? err.message : 'インポートに失敗しました。'
  } finally {
    importFile.value = ''
  }
})
$('export-csv').addEventListener('click', () => {
  if (!last) {
    errorsEl.textContent = '先に「比較する」を押して結果を表示してください。'
    return
  }
  download(buildResultsCsvBlob(last.input, last.result), csvDownloadFileName())
})

const initial = loadInput() ?? DEFAULT_INPUT
fillForm(initial)
render(initial)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // オフライン対応の登録に失敗しても、通常利用は継続できる
    })
  })
}
