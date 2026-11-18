import './style.css'
import { calculate, validateInput, salaryTable, parseNumber, AS_OF, type FurusatoInput } from './calc'
import { DEFAULT_INPUT, loadInput, saveInput, inputToJsonBlob, parseInputFromJsonText } from './storage'
import { buildCsvBlob, csvDownloadFileName } from './csv'

const app = document.getElementById('app')
if (!app) throw new Error('#app 要素が見つかりません')

app.innerHTML = `
  <h1>ふるさと納税 上限額シミュレーター</h1>
  <p class="subtitle">給与所得者（会社員・パート等）向けに、自己負担2,000円で済む寄附上限額の目安を試算します。</p>
  <div>
    <span class="privacy-badge">登録不要</span>
    <span class="privacy-badge">入力データは外部送信されません</span>
    <span class="privacy-badge">オフラインでも利用可能</span>
  </div>
  <form id="sim-form" novalidate>
    <div class="field">
      <label for="salaryYen">給与収入（年額・円）※源泉徴収票の「支払金額」</label>
      <input type="text" inputmode="numeric" id="salaryYen" name="salaryYen" autocomplete="off" />
    </div>
    <div class="field">
      <label for="socialInsuranceYen">社会保険料（年額・円）※空欄なら給与収入の15%で概算</label>
      <input type="text" inputmode="numeric" id="socialInsuranceYen" name="socialInsuranceYen" autocomplete="off" />
    </div>
    <div class="field">
      <label for="idecoYen">iDeCo・小規模企業共済等の掛金（年額・円）</label>
      <input type="text" inputmode="numeric" id="idecoYen" name="idecoYen" autocomplete="off" />
    </div>
    <div class="field">
      <label for="otherDeductionYen">その他の所得控除の合計（生命保険料控除・医療費控除など・円）</label>
      <input type="text" inputmode="numeric" id="otherDeductionYen" name="otherDeductionYen" autocomplete="off" />
    </div>
    <div class="field check-row">
      <input type="checkbox" id="hasSpouse" name="hasSpouse" />
      <label for="hasSpouse">配偶者がいる（配偶者の給与収入が160万円以下）</label>
    </div>
    <div class="field">
      <label for="dependentsGeneral">一般の扶養親族の人数（16歳以上。19〜22歳を除く）</label>
      <input type="text" inputmode="numeric" id="dependentsGeneral" name="dependentsGeneral" autocomplete="off" />
    </div>
    <div class="field">
      <label for="dependentsSpecific">特定扶養親族の人数（19〜22歳）</label>
      <input type="text" inputmode="numeric" id="dependentsSpecific" name="dependentsSpecific" autocomplete="off" />
    </div>
    <div class="field">
      <label for="alreadyDonatedYen">今年すでに寄附した金額（円）</label>
      <input type="text" inputmode="numeric" id="alreadyDonatedYen" name="alreadyDonatedYen" autocomplete="off" />
    </div>
    <p class="hint">全角数字・カンマ区切り・「円」付きでも入力できます。</p>
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
    <p>寄附上限額の目安</p>
    <p class="result-main" id="limit"></p>
    <p id="safe"></p>
    <p id="remaining"></p>
    <p id="detail" class="hint"></p>
    <h3>年収別の上限額の目安（他の条件は同じ）</h3>
    <table>
      <thead><tr><th>給与収入</th><th>上限額の目安</th></tr></thead>
      <tbody id="table-body"></tbody>
    </table>
  </div>
  <div class="disclaimer">
    <strong>免責事項:</strong>
    本ツールは一般的な目安を簡易に試算するものであり、税務上の助言に代わるものではありません。
    住宅ローン控除・事業所得・配当/譲渡所得・複数の勤務先・年の途中の転職、2,000万円超の給与収入などは考慮していません。
    控除額や税率は令和8年（2026年）分の制度を前提とした簡易モデルで、実際の控除額は異なる場合があります。
    寄附は年内（12月31日まで）に決済が完了したものが対象です。
    正確な金額は、お住まいの市区町村・総務省「ふるさと納税ポータルサイト」の公表情報、または税理士等の専門家にご確認ください。
    ※根拠とした一次情報の個別ページは公開前に人間が確認する必要があります（docs/LEGAL.md 参照）。
  </div>
  <footer>入力データはこの端末のブラウザ内にのみ保存されます（サーバーへの送信は行いません）。基準日: ${AS_OF}</footer>
`

const form = document.getElementById('sim-form') as HTMLFormElement
const errorsEl = document.getElementById('errors') as HTMLDivElement
const summaryEl = document.getElementById('summary') as HTMLDivElement
const $ = (id: string) => document.getElementById(id) as HTMLElement
const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement

let last: { input: FurusatoInput; result: ReturnType<typeof calculate> } | null = null

const yen = (v: number) => Math.round(v).toLocaleString('ja-JP') + '円'

const NUM_FIELDS = [
  ['salaryYen', '給与収入'],
  ['idecoYen', 'iDeCo等の掛金'],
  ['otherDeductionYen', 'その他の所得控除'],
  ['dependentsGeneral', '一般の扶養親族の人数'],
  ['dependentsSpecific', '特定扶養親族の人数'],
  ['alreadyDonatedYen', '寄附済み金額'],
] as const

function readForm(): { input: FurusatoInput; parseErrors: string[] } {
  const parseErrors: string[] = []
  const nums: Record<string, number> = {}
  for (const [key, label] of NUM_FIELDS) {
    const n = parseNumber(field(key).value)
    if (n !== null && Number.isNaN(n)) {
      parseErrors.push(`${label}は数字で入力してください。`)
      nums[key] = NaN
    } else {
      nums[key] = n ?? 0
    }
  }
  const si = parseNumber(field('socialInsuranceYen').value)
  if (si !== null && Number.isNaN(si)) parseErrors.push('社会保険料は数字で入力してください。')
  return {
    parseErrors,
    input: {
      salaryYen: nums.salaryYen,
      socialInsuranceYen: si,
      idecoYen: nums.idecoYen,
      otherDeductionYen: nums.otherDeductionYen,
      hasSpouse: field('hasSpouse').checked,
      dependentsGeneral: nums.dependentsGeneral,
      dependentsSpecific: nums.dependentsSpecific,
      alreadyDonatedYen: nums.alreadyDonatedYen,
    },
  }
}

function fillForm(i: FurusatoInput): void {
  field('salaryYen').value = String(i.salaryYen)
  field('socialInsuranceYen').value = i.socialInsuranceYen === null ? '' : String(i.socialInsuranceYen)
  field('idecoYen').value = String(i.idecoYen)
  field('otherDeductionYen').value = String(i.otherDeductionYen)
  field('hasSpouse').checked = i.hasSpouse
  field('dependentsGeneral').value = String(i.dependentsGeneral)
  field('dependentsSpecific').value = String(i.dependentsSpecific)
  field('alreadyDonatedYen').value = String(i.alreadyDonatedYen)
}

function render(input: FurusatoInput, parseErrors: string[] = []): void {
  const errors = parseErrors.length > 0 ? parseErrors : validateInput(input)
  errorsEl.textContent = errors.join(' ')
  if (errors.length > 0) {
    summaryEl.style.display = 'none'
    last = null
    return
  }
  const r = calculate(input)
  last = { input, result: r }
  $('limit').textContent = yen(r.limitYen)
  $('safe').textContent = `余裕を持った目安（上限の90%）: ${yen(r.safeLimitYen)}`
  $('remaining').textContent =
    input.alreadyDonatedYen > 0
      ? `寄附済み ${yen(input.alreadyDonatedYen)} → 残りの寄附可能額（目安）: ${yen(r.remainingYen)}`
      : `自己負担額: ${yen(r.selfPaymentYen)}`
  $('detail').textContent =
    `住民税所得割額 ${yen(r.residentTaxIncomePortionYen)} ／ 所得税率 ${Math.round(r.incomeTaxRate * 100)}% ／ ` +
    `社会保険料 ${yen(r.socialInsuranceYen)}${input.socialInsuranceYen === null ? '（概算）' : ''}`
  $('table-body').innerHTML = salaryTable(input)
    .map((row) => `<tr><td>${yen(row.salaryYen)}</td><td>${yen(row.limitYen)}</td></tr>`)
    .join('')
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
  const { input, parseErrors } = readForm()
  render(input, parseErrors)
})

$('export-json').addEventListener('click', () => {
  const { input, parseErrors } = readForm()
  if (parseErrors.length > 0) {
    errorsEl.textContent = parseErrors.join(' ')
    return
  }
  download(inputToJsonBlob(input), 'furusato-limit-settings.json')
})

const importFile = $('import-file') as HTMLInputElement
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
    errorsEl.textContent = '先に「試算する」を押して結果を表示してください。'
    return
  }
  download(buildCsvBlob(last.input, last.result), csvDownloadFileName())
})

const initial = loadInput() ?? DEFAULT_INPUT
fillForm(initial)
render(initial)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
