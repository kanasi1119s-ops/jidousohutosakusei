import './style.css'
import {
  calcAll,
  normalizeAmount,
  normalizeDate,
  validatePurchase,
  type Purchase,
  type Rounding,
} from './calc'
import { AS_OF, CREDIT_PERIODS, SOURCE_NOTE } from './schedule'
import { EMPTY_STATE, loadState, parseState, saveState, stateToJsonBlob, type AppState } from './storage'
import {
  buildResultsCsv,
  buildTemplateCsv,
  csvBlob,
  csvDownloadFileName,
  parsePurchasesCsv,
  ymd,
} from './csv'

const app = document.getElementById('app')
if (!app) throw new Error('#app 要素が見つかりません')

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

const periodRows = CREDIT_PERIODS.map(
  (p) => `<tr><td>${p.label}</td><td class="num">${Math.round(p.ratio * 100)}%</td></tr>`,
).join('')

app.innerHTML = `
  <h1>インボイス経過措置 仕入税額控除計算機</h1>
  <p class="subtitle">免税事業者等からの仕入れについて、仕入日ごとの控除割合（2026年10月から70%）で控除できる消費税額を一括試算します。</p>
  <div>
    <span class="privacy-badge">登録不要</span>
    <span class="privacy-badge">入力データは外部送信されません</span>
    <span class="privacy-badge">オフラインでも利用可能</span>
  </div>
  <div class="notice">原則課税で申告する事業者の「課税仕入れ」を想定した簡易試算です。簡易課税・2割特例を選択している場合は仕入税額控除の計算自体が不要なため対象外です。</div>

  <form id="add-form" class="panel" novalidate>
    <div class="row-fields">
      <div class="field"><label for="f-date">課税仕入れの日</label><input type="date" id="f-date" required /></div>
      <div class="field"><label for="f-supplier">取引先（任意）</label><input type="text" id="f-supplier" maxlength="100" autocomplete="off" /></div>
      <div class="field"><label for="f-amount">税込金額（円）</label><input type="text" inputmode="numeric" id="f-amount" required autocomplete="off" /></div>
      <div class="field"><label for="f-rate">税率</label><select id="f-rate"><option value="10">10%</option><option value="8">8%（軽減）</option></select></div>
      <div class="field"><label for="f-type">取引先区分</label><select id="f-type"><option value="unqualified">免税事業者等（適格請求書なし）</option><option value="qualified">適格請求書発行事業者</option></select></div>
    </div>
    <div class="errors" id="errors" role="alert"></div>
    <div class="actions"><button type="submit" id="add-btn">明細を追加</button></div>
  </form>

  <div class="panel">
    <div class="actions no-top">
      <label for="rounding" class="inline-label">消費税額の端数処理</label>
      <select id="rounding" class="auto-width"><option value="floor">切り捨て</option><option value="round">四捨五入</option><option value="ceil">切り上げ</option></select>
      <button type="button" class="secondary" id="import-csv">CSVをインポート</button>
      <input type="file" id="import-csv-file" accept=".csv,text/csv" class="hidden" />
      <button type="button" class="secondary" id="export-template">CSVひな形</button>
      <button type="button" class="secondary" id="export-json">バックアップ(JSON)</button>
      <button type="button" class="secondary" id="import-json">復元(JSON)</button>
      <input type="file" id="import-json-file" accept="application/json,.json" class="hidden" />
      <button type="button" class="secondary" id="export-csv">結果をCSVでダウンロード</button>
      <button type="button" class="danger" id="clear-all">すべて削除</button>
    </div>
    <div class="errors" id="io-errors" role="alert"></div>
  </div>

  <div class="summary" id="summary">
    <h2>試算結果</h2>
    <p class="big" id="total-line"></p>
    <p id="diff-line"></p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>日付</th><th>取引先</th><th class="num">税込金額</th><th>税率</th><th>区分</th><th class="num">消費税額</th><th class="num">控除割合</th><th class="num">控除可能額</th><th class="num">控除不可額</th><th></th></tr></thead>
        <tbody id="result-body"></tbody>
      </table>
    </div>
    <h3>期間別の集計</h3>
    <div class="table-wrap"><table><thead><tr><th>期間</th><th class="num">件数</th><th class="num">消費税額</th><th class="num">控除可能額</th></tr></thead><tbody id="period-body"></tbody></table></div>
  </div>

  <div class="panel">
    <h3>控除割合の早見表（免税事業者等からの仕入れ）</h3>
    <table><thead><tr><th>課税仕入れの日</th><th class="num">控除割合</th></tr></thead><tbody>${periodRows}</tbody></table>
    <p><small class="muted">判定は請求書の発行日や支払日ではなく「課税仕入れを行った日」で行います。基準日: ${AS_OF}</small></p>
  </div>

  <div class="disclaimer">
    <strong>免責事項:</strong>
    本ツールは一般的な試算を簡易に行うものであり、税務上の助言に代わるものではありません。実際の控除額は帳簿・請求書等の保存要件、
    消費税の課税方式、個別の取引内容等により異なります。${SOURCE_NOTE}
    重要な判断の前には、国税庁の最新の公表情報、または税理士など専門家にご確認ください。
  </div>
  <footer>入力データはこの端末のブラウザ内にのみ保存されます（サーバーへの送信は行いません）。</footer>
`

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T
const addForm = $<HTMLFormElement>('add-form')
const errorsEl = $<HTMLDivElement>('errors')
const ioErrorsEl = $<HTMLDivElement>('io-errors')
const resultBody = $<HTMLTableSectionElement>('result-body')
const periodBody = $<HTMLTableSectionElement>('period-body')
const totalLine = $<HTMLParagraphElement>('total-line')
const diffLine = $<HTMLParagraphElement>('diff-line')
const roundingSel = $<HTMLSelectElement>('rounding')

let state: AppState = loadState() ?? { ...EMPTY_STATE, purchases: [] }

const yen = (n: number): string => Math.round(n).toLocaleString('ja-JP') + '円'
const newId = (): string => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2))

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

function render(): void {
  roundingSel.value = state.rounding
  const { results, summary } = calcAll(state.purchases, state.rounding)
  resultBody.innerHTML = results
    .map(
      (r) => `<tr>
        <td>${r.purchase.date}</td>
        <td>${escapeHtml(r.purchase.supplier) || '-'}</td>
        <td class="num">${yen(r.purchase.amountYen)}</td>
        <td>${r.purchase.taxRate}%</td>
        <td>${r.purchase.supplierType === 'qualified' ? '適格' : '免税等'}</td>
        <td class="num">${yen(r.taxYen)}</td>
        <td class="num">${Math.round(r.ratio * 100)}%</td>
        <td class="num">${yen(r.deductibleYen)}</td>
        <td class="num">${yen(r.nonDeductibleYen)}</td>
        <td><button type="button" class="danger" data-del="${escapeHtml(r.purchase.id)}" aria-label="この明細を削除">削除</button></td>
      </tr>`,
    )
    .join('')
  periodBody.innerHTML = summary.byPeriod
    .map((p) => `<tr><td>${p.periodLabel}</td><td class="num">${p.count}</td><td class="num">${yen(p.taxYen)}</td><td class="num">${yen(p.deductibleYen)}</td></tr>`)
    .join('')
  if (summary.count === 0) {
    totalLine.textContent = '明細がありません。上のフォームから追加するか、CSVをインポートしてください。'
    diffLine.textContent = ''
  } else {
    totalLine.textContent = `${summary.count}件 / 控除できる消費税額 合計 ${yen(summary.totalDeductibleYen)}（控除できない額 ${yen(summary.totalNonDeductibleYen)}）`
    const d = summary.totalDiffFromOldYen
    diffLine.textContent =
      d === 0
        ? '令和8年度改正前のスケジュールと比べた控除額の差: なし'
        : `令和8年度改正前のスケジュールと比べた控除額の差: ${d > 0 ? '+' : '-'}${yen(Math.abs(d))}`
  }
  saveState(state)
}

function setPurchases(purchases: Purchase[]): void {
  state = { ...state, purchases }
  render()
}

addForm.addEventListener('submit', (e) => {
  e.preventDefault()
  const dateRaw = $<HTMLInputElement>('f-date').value
  const date = normalizeDate(dateRaw)
  const amount = normalizeAmount($<HTMLInputElement>('f-amount').value)
  const candidate: Purchase = {
    id: newId(),
    date: date ?? dateRaw,
    supplier: $<HTMLInputElement>('f-supplier').value.trim(),
    amountYen: amount ?? -1,
    taxRate: Number($<HTMLSelectElement>('f-rate').value) as 10 | 8,
    supplierType: $<HTMLSelectElement>('f-type').value as Purchase['supplierType'],
  }
  const errors = validatePurchase(candidate)
  errorsEl.textContent = errors.join(' ')
  if (errors.length > 0) return
  setPurchases([...state.purchases, candidate])
  $<HTMLInputElement>('f-amount').value = ''
  $<HTMLInputElement>('f-supplier').value = ''
})

resultBody.addEventListener('click', (e) => {
  const id = (e.target as HTMLElement).getAttribute('data-del')
  if (id) setPurchases(state.purchases.filter((p) => p.id !== id))
})

roundingSel.addEventListener('change', () => {
  state = { ...state, rounding: roundingSel.value as Rounding }
  render()
})

$('clear-all').addEventListener('click', () => {
  if (state.purchases.length === 0) return
  if (window.confirm('すべての明細を削除します。よろしいですか？（事前にバックアップを推奨します）')) setPurchases([])
})

$('export-csv').addEventListener('click', () => {
  const { results } = calcAll(state.purchases, state.rounding)
  download(csvBlob(buildResultsCsv(results)), csvDownloadFileName())
})
$('export-template').addEventListener('click', () => download(csvBlob(buildTemplateCsv()), 'invoice-credit-template.csv'))
$('export-json').addEventListener('click', () => download(stateToJsonBlob(state), `invoice-credit-backup-${ymd()}.json`))

const csvFile = $<HTMLInputElement>('import-csv-file')
$('import-csv').addEventListener('click', () => csvFile.click())
csvFile.addEventListener('change', async () => {
  const file = csvFile.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const out = parsePurchasesCsv(text, newId)
    const shown = out.errors.slice(0, 5).join(' ')
    const more = out.errors.length > 5 ? ` ほか${out.errors.length - 5}件` : ''
    if (out.purchases.length > 0) setPurchases([...state.purchases, ...out.purchases])
    ioErrorsEl.textContent =
      out.errors.length > 0
        ? `${out.purchases.length}件を取り込みました。取り込めなかった行: ${shown}${more}`
        : `${out.purchases.length}件を取り込みました。`
  } catch {
    ioErrorsEl.textContent = 'CSVの読み込みに失敗しました。'
  } finally {
    csvFile.value = ''
  }
})

const jsonFile = $<HTMLInputElement>('import-json-file')
$('import-json').addEventListener('click', () => jsonFile.click())
jsonFile.addEventListener('change', async () => {
  const file = jsonFile.files?.[0]
  if (!file) return
  try {
    state = parseState(await file.text())
    ioErrorsEl.textContent = `${state.purchases.length}件を復元しました。`
    render()
  } catch (err) {
    ioErrorsEl.textContent = err instanceof Error ? err.message : 'インポートに失敗しました。'
  } finally {
    jsonFile.value = ''
  }
})

render()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // 登録に失敗しても通常利用は継続できる
    })
  })
}
