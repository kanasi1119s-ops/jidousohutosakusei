import './style.css'
import { calculateLimit, validateInput, type LimitInput, type LimitResult } from './calc'
import { AS_OF, SOURCE_NOTE, TAX_YEAR_LABEL } from './params'
import { summarize, validateDonation, ONE_STOP_MAX_MUNICIPALITIES, type Donation } from './donations'
import { DEFAULT_INPUT, dataToJsonBlob, loadData, parseAppData, saveData } from './storage'
import { buildDonationsCsvBlob, csvDownloadFileName } from './csv'

const TAX_YEAR = 2026

const app = document.getElementById('app')
if (!app) throw new Error('#app 要素が見つかりません')

app.innerHTML = `
  <h1>ふるさと納税 上限額シミュレーター</h1>
  <p class="subtitle">${TAX_YEAR_LABEL}の控除上限額の目安を試算し、寄附の残り枠を管理します（給与所得者向け）。</p>
  <div>
    <span class="privacy-badge">登録不要</span>
    <span class="privacy-badge">入力データは外部送信されません</span>
    <span class="privacy-badge">オフラインでも利用可能</span>
  </div>

  <form id="sim-form" novalidate>
    <div class="field">
      <label for="salaryYen">給与収入（年額・円／額面）</label>
      <input type="number" id="salaryYen" name="salaryYen" min="0" step="1" required />
    </div>
    <div class="field">
      <label class="checkbox"><input type="checkbox" id="useActualSocialInsurance" />社会保険料を実額で入力する（未チェックは収入の約14.5%で概算）</label>
      <input type="number" id="socialInsuranceYen" name="socialInsuranceYen" min="0" step="1" aria-label="社会保険料（年額・円）" />
    </div>
    <div class="field">
      <label for="spouse">配偶者控除・配偶者（特別）控除の対象となる配偶者</label>
      <select id="spouse" name="spouse">
        <option value="none">なし（独身・共働き等）</option>
        <option value="general">あり（70歳未満）</option>
        <option value="elderly">あり（70歳以上）</option>
      </select>
    </div>
    <fieldset>
      <legend>扶養親族の人数（16歳未満の子は控除対象外のため入力不要）</legend>
      <div class="grid2">
        <div class="field"><label for="dependentsGeneral">一般（16〜18歳・23〜69歳）</label>
          <input type="number" id="dependentsGeneral" min="0" step="1" /></div>
        <div class="field"><label for="dependentsSpecific">特定（19〜22歳）</label>
          <input type="number" id="dependentsSpecific" min="0" step="1" /></div>
        <div class="field"><label for="dependentsElderly">老人（70歳以上）</label>
          <input type="number" id="dependentsElderly" min="0" step="1" /></div>
      </div>
    </fieldset>
    <div class="field">
      <label for="otherDeductionsYen">その他の所得控除の合計（円・生命保険料控除、iDeCo、医療費控除など。0でも可）</label>
      <input type="number" id="otherDeductionsYen" min="0" step="1" />
    </div>
    <div class="field">
      <label for="housingLoanResidentCreditYen">住民税から控除される住宅ローン控除額（円・年額。なければ0）</label>
      <input type="number" id="housingLoanResidentCreditYen" min="0" step="1" />
    </div>
    <div class="errors" id="errors" role="alert"></div>
    <div class="actions"><button type="submit">上限額を試算する</button></div>
  </form>

  <section class="card hidden" id="result" aria-live="polite">
    <h2>控除上限額の目安</h2>
    <p class="big" id="limit"></p>
    <p id="safe-limit"></p>
    <details>
      <summary>計算の内訳</summary>
      <ul id="breakdown"></ul>
    </details>
  </section>

  <section class="card" id="tracker">
    <h2>寄附の記録（${TAX_YEAR}年）</h2>
    <p id="tracker-status"></p>
    <form id="donation-form" novalidate>
      <div class="grid2">
        <div class="field"><label for="d-date">寄附日（決済完了日）</label><input type="date" id="d-date" /></div>
        <div class="field"><label for="d-muni">自治体名</label><input type="text" id="d-muni" maxlength="50" /></div>
        <div class="field"><label for="d-amount">寄附額（円）</label><input type="number" id="d-amount" min="1000" step="1" /></div>
        <div class="field"><label class="checkbox"><input type="checkbox" id="d-onestop" />ワンストップ特例の申請書を送付済み</label></div>
      </div>
      <div class="errors" id="d-errors" role="alert"></div>
      <div class="actions"><button type="submit" id="add-donation">寄附を追加</button></div>
    </form>
    <div class="table-wrap">
      <table>
        <thead><tr><th>日付</th><th>自治体</th><th>金額</th><th>ワンストップ</th><th></th></tr></thead>
        <tbody id="donation-body"></tbody>
      </table>
    </div>
    <div class="actions">
      <button type="button" class="secondary" id="export-csv">寄附一覧をCSVでダウンロード</button>
      <button type="button" class="secondary" id="export-json">バックアップ(JSON)を保存</button>
      <button type="button" class="secondary" id="import-json">バックアップ(JSON)を読み込む</button>
      <input type="file" id="import-file" accept="application/json" class="hidden" />
    </div>
    <div class="errors" id="io-errors" role="alert"></div>
  </section>

  <div class="disclaimer">
    <strong>免責事項:</strong>
    本ツールは一般的な試算を簡易に行うものであり、税務上の助言に代わるものではありません。
    実際の控除上限額は、お住まいの自治体の住民税決定通知書（所得割額）や、各種控除・所得の状況により異なります。
    給与収入が約200万円未満の場合や、事業所得・不動産所得等がある場合、年収2,000万円超の場合は精度が下がります。
    ${SOURCE_NOTE}
    寄附の期限は12月31日までに決済が完了したものです。ワンストップ特例は同一年に寄附先が5自治体以内の場合のみ利用できます。
    重要な判断の前には、総務省・国税庁の最新の公表情報、または税理士等の専門家にご確認ください。
  </div>
  <footer>入力データはこの端末のブラウザ内にのみ保存されます（サーバーへの送信は行いません）。基準日: ${AS_OF}</footer>
`

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id)
  if (!el) throw new Error(`#${id} が見つかりません`)
  return el as T
}

const form = $<HTMLFormElement>('sim-form')
const errorsEl = $('errors')
const resultEl = $('result')
const state: { input: LimitInput; donations: Donation[]; result: LimitResult | null } = {
  input: { ...DEFAULT_INPUT },
  donations: [],
  result: null,
}

const fmt = (n: number): string => Math.round(n).toLocaleString('ja-JP') + '円'
const num = (id: string): number => {
  const v = $<HTMLInputElement>(id).value
  return v === '' ? 0 : Number(v)
}

function readInput(): LimitInput {
  return {
    salaryYen: num('salaryYen'),
    useActualSocialInsurance: $<HTMLInputElement>('useActualSocialInsurance').checked,
    socialInsuranceYen: num('socialInsuranceYen'),
    spouse: $<HTMLSelectElement>('spouse').value as LimitInput['spouse'],
    dependentsGeneral: num('dependentsGeneral'),
    dependentsSpecific: num('dependentsSpecific'),
    dependentsElderly: num('dependentsElderly'),
    otherDeductionsYen: num('otherDeductionsYen'),
    housingLoanResidentCreditYen: num('housingLoanResidentCreditYen'),
  }
}

function fillForm(i: LimitInput): void {
  $<HTMLInputElement>('salaryYen').value = String(i.salaryYen)
  $<HTMLInputElement>('useActualSocialInsurance').checked = i.useActualSocialInsurance
  $<HTMLInputElement>('socialInsuranceYen').value = String(i.socialInsuranceYen)
  $<HTMLSelectElement>('spouse').value = i.spouse
  $<HTMLInputElement>('dependentsGeneral').value = String(i.dependentsGeneral)
  $<HTMLInputElement>('dependentsSpecific').value = String(i.dependentsSpecific)
  $<HTMLInputElement>('dependentsElderly').value = String(i.dependentsElderly)
  $<HTMLInputElement>('otherDeductionsYen').value = String(i.otherDeductionsYen)
  $<HTMLInputElement>('housingLoanResidentCreditYen').value = String(i.housingLoanResidentCreditYen)
  syncSocialInsuranceField()
}

function syncSocialInsuranceField(): void {
  $<HTMLInputElement>('socialInsuranceYen').disabled = !$<HTMLInputElement>('useActualSocialInsurance').checked
}

function persist(): void {
  saveData({ version: 1, input: state.input, donations: state.donations })
}

function renderResult(): void {
  const errors = validateInput(state.input)
  errorsEl.textContent = errors.join(' ')
  if (errors.length > 0) {
    resultEl.classList.add('hidden')
    state.result = null
    renderTracker()
    return
  }
  const r = calculateLimit(state.input)
  state.result = r
  $('limit').textContent = `約 ${fmt(r.limitYen)}`
  $('safe-limit').textContent = `余裕を見た目安（上限の90%）: 約 ${fmt(r.safeLimitYen)}　／　自己負担: 2,000円`
  const list = $('breakdown')
  list.replaceChildren()
  const rows = [
    `給与所得（所得税）: ${fmt(r.salaryIncomeIncomeTaxYen)}`,
    `給与所得（住民税）: ${fmt(r.salaryIncomeResidentTaxYen)}`,
    `社会保険料（${state.input.useActualSocialInsurance ? '実額' : '概算'}）: ${fmt(r.socialInsuranceYen)}`,
    `課税所得（所得税）: ${fmt(r.incomeTaxTaxableYen)}／適用税率 ${Math.round(r.incomeTaxRate * 100)}%`,
    `課税所得（住民税）: ${fmt(r.residentTaxTaxableYen)}`,
    `住民税所得割（調整控除前）: ${fmt(r.residentTaxBeforeAdjustYen)}`,
    `調整控除: ${fmt(r.adjustmentCreditYen)}`,
    `住民税所得割（上限額計算に使用）: ${fmt(r.residentTaxIncomePortionYen)}`,
  ]
  for (const t of rows) {
    const li = document.createElement('li')
    li.textContent = t
    list.appendChild(li)
  }
  resultEl.classList.remove('hidden')
  renderTracker()
}

function renderTracker(): void {
  const s = summarize(state.donations, TAX_YEAR, state.result ? state.result.limitYen : null)
  const otherYear = state.donations.filter((d) => !d.date.startsWith(`${TAX_YEAR}-`)).length
  const parts = [`${TAX_YEAR}年の寄附合計: ${fmt(s.total)}（${s.municipalities}自治体）`]
  const status = $('tracker-status')
  status.replaceChildren()
  const p1 = document.createElement('span')
  p1.textContent = parts[0]
  status.appendChild(p1)
  if (otherYear > 0) {
    const n = document.createElement('div')
    n.textContent = `※${TAX_YEAR}年以外の日付の記録が${otherYear}件あります（合計・残り枠には含めません）。`
    status.appendChild(n)
  }
  if (state.result) {
    const p2 = document.createElement('div')
    if (s.overYen > 0) {
      p2.className = 'warn'
      p2.textContent = `上限の目安を ${fmt(s.overYen)} 超えています（超過分は自己負担になる可能性があります）。`
    } else {
      p2.textContent = `上限の目安までの残り枠: ${fmt(s.remainingYen)}`
    }
    status.appendChild(p2)
  }
  if (s.oneStopWarning) {
    const p3 = document.createElement('div')
    p3.className = 'warn'
    p3.textContent = `寄附先が${ONE_STOP_MAX_MUNICIPALITIES}自治体を超えています。ワンストップ特例は使えないため、確定申告が必要です。`
    status.appendChild(p3)
  }

  const body = $('donation-body')
  body.replaceChildren()
  const sorted = [...state.donations].sort((a, b) => a.date.localeCompare(b.date))
  for (const d of sorted) {
    const tr = document.createElement('tr')
    const cells = [d.date, d.municipality, fmt(d.amountYen), d.oneStopSent ? '送付済み' : '未送付']
    for (const c of cells) {
      const td = document.createElement('td')
      td.textContent = c
      tr.appendChild(td)
    }
    const td = document.createElement('td')
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'danger'
    btn.textContent = '削除'
    btn.setAttribute('data-delete', d.id)
    btn.addEventListener('click', () => {
      state.donations = state.donations.filter((x) => x.id !== d.id)
      persist()
      renderTracker()
    })
    td.appendChild(btn)
    tr.appendChild(td)
    body.appendChild(tr)
  }
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

form.addEventListener('submit', (e) => {
  e.preventDefault()
  state.input = readInput()
  renderResult()
  if (state.result) persist()
})
$('useActualSocialInsurance').addEventListener('change', syncSocialInsuranceField)

$<HTMLFormElement>('donation-form').addEventListener('submit', (e) => {
  e.preventDefault()
  const draft = {
    date: $<HTMLInputElement>('d-date').value,
    municipality: $<HTMLInputElement>('d-muni').value,
    amountYen: num('d-amount'),
  }
  const errs = validateDonation(draft)
  $('d-errors').textContent = errs.join(' ')
  if (errs.length > 0) return
  state.donations.push({
    id: `d-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    date: draft.date,
    municipality: draft.municipality.trim(),
    amountYen: draft.amountYen,
    oneStopSent: $<HTMLInputElement>('d-onestop').checked,
  })
  $<HTMLInputElement>('d-muni').value = ''
  $<HTMLInputElement>('d-amount').value = ''
  $<HTMLInputElement>('d-onestop').checked = false
  persist()
  renderTracker()
})

$('export-csv').addEventListener('click', () => {
  download(buildDonationsCsvBlob(state.donations), csvDownloadFileName())
})
$('export-json').addEventListener('click', () => {
  state.input = readInput()
  download(dataToJsonBlob({ version: 1, input: state.input, donations: state.donations }), 'furusato-backup.json')
})
const importFile = $<HTMLInputElement>('import-file')
$('import-json').addEventListener('click', () => importFile.click())
importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0]
  if (!file) return
  try {
    let text = await file.text()
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
    const data = parseAppData(JSON.parse(text))
    state.input = data.input
    state.donations = data.donations
    fillForm(state.input)
    renderResult()
    persist()
    $('io-errors').textContent = ''
  } catch (err) {
    $('io-errors').textContent = err instanceof Error ? err.message : 'インポートに失敗しました。'
  } finally {
    importFile.value = ''
  }
})

const saved = loadData()
if (saved) {
  state.input = saved.input
  state.donations = saved.donations
}
fillForm(state.input)
renderResult()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // 登録失敗でも通常利用は継続できる
    })
  })
}
