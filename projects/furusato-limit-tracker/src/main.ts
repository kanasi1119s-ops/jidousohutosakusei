import './style.css'
import { calcLimit, validateLimitInput, type LimitInput } from './calc'
import { AS_OF, SOURCE_NOTE, TARGET_TAX_YEAR_NOTE } from './params'
import { formatYen, parseNumber } from './parse'
import { daysUntilYearEnd, newId, summarize, validateDonation } from './tracker'
import { buildDonationsCsvBlob, csvFileName, parseDonationsCsv } from './csv'
import { loadState, parseStateFromJsonText, saveState, stateToJsonBlob, type AppState } from './storage'

const today = new Date()
const DEFAULT_STATE: AppState = {
  version: 1,
  year: today.getFullYear(),
  input: {
    salaryYen: 5_000_000,
    socialInsuranceRate: 0.15,
    socialInsuranceYen: null,
    hasSpouse: false,
    generalDependents: 0,
    specificDependents: 0,
    elderlyDependents: 0,
    otherDeductionYen: 0,
  },
  donations: [],
}
let state: AppState = loadState() ?? structuredClone(DEFAULT_STATE)

const app = document.getElementById('app')
if (!app) throw new Error('#app 要素が見つかりません')

app.innerHTML = `
  <h1>ふるさと納税 上限＆記録ノート</h1>
  <p class="subtitle">控除上限額の目安を試算し、今年の寄附を記録して残り枠を確認します。</p>
  <div>
    <span class="privacy-badge">登録不要</span>
    <span class="privacy-badge">入力データは外部送信されません</span>
    <span class="privacy-badge">オフラインでも利用可能</span>
  </div>

  <section>
    <h2>1. 控除上限額の目安（給与所得者向け）</h2>
    <form id="sim-form" novalidate>
      <div class="grid2">
        <div class="field"><label for="year">寄附する年（西暦）</label>
          <input type="text" id="year" inputmode="numeric" /></div>
        <div class="field"><label for="salaryYen">給与収入（年収・額面・円）</label>
          <input type="text" id="salaryYen" inputmode="numeric" /></div>
        <div class="field"><label for="socialInsuranceRate">社会保険料率（％・目安15）</label>
          <input type="text" id="socialInsuranceRate" inputmode="decimal" /></div>
        <div class="field"><label for="socialInsuranceYen">社会保険料の実額（円・分かる場合のみ）</label>
          <input type="text" id="socialInsuranceYen" inputmode="numeric" /></div>
        <div class="field"><label for="generalDependents">扶養親族（16〜18歳・23〜69歳）の人数</label>
          <input type="text" id="generalDependents" inputmode="numeric" /></div>
        <div class="field"><label for="specificDependents">特定扶養親族（19〜22歳）の人数</label>
          <input type="text" id="specificDependents" inputmode="numeric" /></div>
        <div class="field"><label for="elderlyDependents">老人扶養親族（70歳以上）の人数</label>
          <input type="text" id="elderlyDependents" inputmode="numeric" /></div>
        <div class="field"><label for="otherDeductionYen">その他の所得控除の合計（医療費控除等・円）</label>
          <input type="text" id="otherDeductionYen" inputmode="numeric" /></div>
      </div>
      <div class="field inline-check"><input type="checkbox" id="hasSpouse" />
        <label for="hasSpouse">配偶者控除（または配偶者特別控除）を受ける配偶者がいる</label></div>
      <div class="errors" id="errors" role="alert"></div>
      <div class="actions"><button type="submit">上限額を試算する</button></div>
    </form>
    <div class="summary hidden" id="limit-result">
      <p>控除上限額の目安</p>
      <p class="big" id="limit-yen"></p>
      <p id="safe-limit"></p>
      <p id="limit-detail"></p>
    </div>
  </section>

  <section>
    <h2>2. 寄附の記録</h2>
    <form id="don-form" novalidate>
      <div class="grid2">
        <div class="field"><label for="d-name">自治体名</label><input type="text" id="d-name" maxlength="60" /></div>
        <div class="field"><label for="d-date">寄附日</label><input type="date" id="d-date" /></div>
        <div class="field"><label for="d-amount">寄附額（円）</label><input type="text" id="d-amount" inputmode="numeric" /></div>
        <div class="field inline-check"><input type="checkbox" id="d-onestop" checked />
          <label for="d-onestop">ワンストップ特例を希望する</label></div>
      </div>
      <div class="errors" id="d-errors" role="alert"></div>
      <div class="actions"><button type="submit">寄附を追加</button></div>
    </form>
    <div class="summary" id="tracker">
      <p id="t-total"></p>
      <p id="t-remain"></p>
      <p id="t-burden"></p>
      <p id="t-deadline"></p>
      <p id="t-onestop"></p>
      <div class="table-wrap"><table>
        <thead><tr><th>寄附日</th><th>自治体名</th><th>寄附額</th><th>ワンストップ</th><th></th></tr></thead>
        <tbody id="don-body"></tbody>
      </table></div>
    </div>
  </section>

  <section>
    <h2>3. バックアップ・書き出し</h2>
    <div class="actions">
      <button type="button" class="secondary" id="export-csv">寄附記録をCSVでダウンロード</button>
      <button type="button" class="secondary" id="import-csv">寄附記録をCSVから読み込み</button>
      <input type="file" id="import-csv-file" accept=".csv,text/csv" class="hidden" />
      <button type="button" class="secondary" id="export-json">全データをエクスポート(JSON)</button>
      <button type="button" class="secondary" id="import-json">全データをインポート(JSON)</button>
      <input type="file" id="import-json-file" accept="application/json" class="hidden" />
    </div>
    <div class="errors" id="io-msg" role="status"></div>
  </section>

  <div class="disclaimer">
    <strong>免責事項:</strong>
    本ツールは一般的な概算を行うものであり、税務上の助言に代わるものではありません。実際の控除上限額は、
    ふるさと納税以外の控除（住宅ローン控除、副業・事業所得、iDeCo等）や自治体の課税内容により変わります。
    表示額は目安であり、上限を超える寄附は自己負担になります。余裕を持った金額での寄附をおすすめします。
    ${TARGET_TAX_YEAR_NOTE}
    ${SOURCE_NOTE}
  </div>
  <footer>入力データはこの端末のブラウザ内にのみ保存されます（サーバーへの送信は行いません）。基準日: ${AS_OF}</footer>
`

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

function fillForm(): void {
  const i = state.input
  $<HTMLInputElement>('year').value = String(state.year)
  $<HTMLInputElement>('salaryYen').value = String(i.salaryYen)
  $<HTMLInputElement>('socialInsuranceRate').value = String(Math.round(i.socialInsuranceRate * 1000) / 10)
  $<HTMLInputElement>('socialInsuranceYen').value = i.socialInsuranceYen === null ? '' : String(i.socialInsuranceYen)
  $<HTMLInputElement>('generalDependents').value = String(i.generalDependents)
  $<HTMLInputElement>('specificDependents').value = String(i.specificDependents)
  $<HTMLInputElement>('elderlyDependents').value = String(i.elderlyDependents)
  $<HTMLInputElement>('otherDeductionYen').value = String(i.otherDeductionYen)
  $<HTMLInputElement>('hasSpouse').checked = i.hasSpouse
}

function readForm(): { year: number; input: LimitInput } {
  const v = (id: string) => parseNumber($<HTMLInputElement>(id).value)
  const si = $<HTMLInputElement>('socialInsuranceYen').value.trim()
  return {
    year: v('year'),
    input: {
      salaryYen: v('salaryYen'),
      socialInsuranceRate: v('socialInsuranceRate') / 100,
      socialInsuranceYen: si === '' ? null : parseNumber(si),
      hasSpouse: $<HTMLInputElement>('hasSpouse').checked,
      generalDependents: v('generalDependents'),
      specificDependents: v('specificDependents'),
      elderlyDependents: v('elderlyDependents'),
      otherDeductionYen: v('otherDeductionYen'),
    },
  }
}

function currentLimit(): { limit: number; safe: number } | null {
  if (validateLimitInput(state.input).length > 0) return null
  const r = calcLimit(state.input)
  return { limit: r.limitYen, safe: r.safeLimitYen }
}

function renderLimit(): void {
  const el = $('limit-result')
  const errs = validateLimitInput(state.input)
  if (errs.length > 0) {
    el.classList.add('hidden')
    return
  }
  const r = calcLimit(state.input)
  el.classList.remove('hidden')
  $('limit-yen').textContent = formatYen(r.limitYen)
  $('safe-limit').textContent = `余裕を持った目安（90％）: ${formatYen(r.safeLimitYen)}`
  $('limit-detail').textContent =
    `給与所得 ${formatYen(r.salaryIncomeYen)} / 住民税所得割額（概算） ${formatYen(r.residentTaxAmountYen)} / 所得税の限界税率 ${Math.round(r.marginalRate * 100)}％`
}

function renderTracker(): void {
  const lim = currentLimit()
  const limit = lim?.limit ?? 0
  const s = summarize(state.donations, state.year, limit)
  $('t-total').textContent = `${state.year}年の寄附合計: ${formatYen(s.totalYen)}（${s.count}件・${s.municipalities}自治体）`
  const remain = $('t-remain')
  remain.classList.toggle('warn', s.overYen > 0)
  remain.textContent =
    lim === null
      ? '上限額を試算すると、残り枠が表示されます。'
      : s.overYen > 0
        ? `上限の目安を ${formatYen(s.overYen)} 超えています（超過分は自己負担になる可能性があります）。`
        : `上限の目安までの残り枠: ${formatYen(s.remainingYen)}`
  $('t-burden').textContent = lim === null ? '' : `自己負担の目安: ${formatYen(s.burdenYen)}（通常は2,000円）`
  const days = daysUntilYearEnd(state.year, new Date())
  $('t-deadline').textContent =
    days >= 0
      ? `${state.year}年12月31日まで あと${days}日。ワンストップ特例の申請書は、翌年1月10日必着が一般的な期限です（自治体の案内で確認してください）。`
      : `${state.year}年の寄附の受付は終了しています。`
  $('t-onestop').textContent = s.oneStopIssues.length === 0 ? 'ワンストップ特例: 条件の範囲内です（5自治体以内）。' : s.oneStopIssues.join(' ')

  const body = $('don-body')
  body.replaceChildren()
  const sorted = [...state.donations].sort((a, b) => a.date.localeCompare(b.date))
  for (const d of sorted) {
    const tr = document.createElement('tr')
    for (const text of [d.date, d.municipality, formatYen(d.amountYen), d.oneStop ? '希望' : '希望しない']) {
      const td = document.createElement('td')
      td.textContent = text
      tr.appendChild(td)
    }
    const td = document.createElement('td')
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'secondary'
    btn.textContent = '削除'
    btn.setAttribute('aria-label', `${d.municipality}の寄附を削除`)
    btn.addEventListener('click', () => {
      state.donations = state.donations.filter((x) => x.id !== d.id)
      persist()
    })
    td.appendChild(btn)
    tr.appendChild(td)
    body.appendChild(tr)
  }
}

function persist(): void {
  saveState(state)
  renderLimit()
  renderTracker()
}

$('sim-form').addEventListener('submit', (e) => {
  e.preventDefault()
  const { year, input } = readForm()
  const errs = validateLimitInput(input)
  if (!Number.isInteger(year) || year < 2020 || year > 2100) errs.push('寄附する年は2020〜2100の西暦で入力してください。')
  $('errors').textContent = errs.join(' ')
  if (errs.length > 0) return
  state.year = year
  state.input = input
  persist()
})

$('d-date').addEventListener('focus', () => {
  const el = $<HTMLInputElement>('d-date')
  if (!el.value) el.value = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
})

$('don-form').addEventListener('submit', (e) => {
  e.preventDefault()
  const d = {
    municipality: $<HTMLInputElement>('d-name').value.trim(),
    date: $<HTMLInputElement>('d-date').value,
    amountYen: parseNumber($<HTMLInputElement>('d-amount').value),
    oneStop: $<HTMLInputElement>('d-onestop').checked,
  }
  const errs = validateDonation(d)
  $('d-errors').textContent = errs.join(' ')
  if (errs.length > 0) return
  state.donations.push({ id: newId(), ...d })
  $<HTMLInputElement>('d-name').value = ''
  $<HTMLInputElement>('d-amount').value = ''
  persist()
})

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function msg(text: string, isError = false): void {
  const el = $('io-msg')
  el.textContent = text
  el.classList.toggle('warn', isError)
}

$('export-csv').addEventListener('click', () => download(buildDonationsCsvBlob(state.donations), csvFileName()))
$('export-json').addEventListener('click', () => download(stateToJsonBlob(state), 'furusato-limit-tracker-data.json'))
$('import-csv').addEventListener('click', () => $<HTMLInputElement>('import-csv-file').click())
$('import-json').addEventListener('click', () => $<HTMLInputElement>('import-json-file').click())

$<HTMLInputElement>('import-csv-file').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const list = parseDonationsCsv(await file.text())
    const key = (x: { municipality: string; date: string; amountYen: number }) => `${x.municipality}|${x.date}|${x.amountYen}`
    const existing = new Set(state.donations.map(key))
    const added = list.filter((x) => !existing.has(key(x)))
    state.donations = [...state.donations, ...added]
    persist()
    msg(`${added.length}件の寄附を読み込みました（重複${list.length - added.length}件はスキップ）。`)
  } catch (err) {
    msg((err as Error).message, true)
  }
  input.value = ''
})

$<HTMLInputElement>('import-json-file').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    state = parseStateFromJsonText(await file.text())
    fillForm()
    persist()
    msg('全データを読み込みました。')
  } catch (err) {
    msg(err instanceof SyntaxError ? 'JSONとして読み込めません。' : (err as Error).message, true)
  }
  input.value = ''
})

fillForm()
renderLimit()
renderTracker()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
