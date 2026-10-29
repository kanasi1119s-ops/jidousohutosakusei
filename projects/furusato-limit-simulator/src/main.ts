import './style.css'
import { simulate, validateInput, type SimulatorInput, type SpouseType } from './calc'
import { SOURCE_NOTE, AS_OF } from './rules'
import { loadInput, saveInput, inputToJsonBlob, parseInputFromJsonText } from './storage'
import { buildResultsCsvBlob, csvDownloadFileName } from './csv'

const DEFAULT_INPUT: SimulatorInput = {
  salaryYen: 5000000,
  socialInsuranceYen: null,
  spouse: 'none',
  dependents: 0,
  specialDependents: 0,
}

const app = document.getElementById('app')
if (!app) {
  throw new Error('#app 要素が見つかりません')
}

app.innerHTML = `
  <h1>ふるさと納税 控除上限額シミュレーター</h1>
  <p class="subtitle">給与収入と家族構成から、自己負担2,000円で済む寄付額の上限の目安を試算します。</p>
  <div>
    <span class="privacy-badge">登録不要</span>
    <span class="privacy-badge">入力データは外部送信されません</span>
    <span class="privacy-badge">オフラインでも利用可能</span>
  </div>
  <form id="sim-form" novalidate>
    <div class="field">
      <label for="salaryYen">今年の給与収入（年収・円、税引前）</label>
      <input type="number" id="salaryYen" name="salaryYen" min="0" step="1" required />
    </div>
    <div class="field">
      <label for="socialInsuranceYen">社会保険料（円・空欄なら年収の15%で概算）</label>
      <input type="number" id="socialInsuranceYen" name="socialInsuranceYen" min="0" step="1" />
    </div>
    <div class="field">
      <label for="spouse">配偶者控除の対象となる配偶者</label>
      <select id="spouse" name="spouse">
        <option value="none">いない／対象外</option>
        <option value="deduction">いる（配偶者控除の対象）</option>
      </select>
    </div>
    <div class="field">
      <label for="dependents">一般の扶養親族の人数（16歳以上・19〜22歳以外）</label>
      <input type="number" id="dependents" name="dependents" min="0" max="20" step="1" required />
    </div>
    <div class="field">
      <label for="specialDependents">特定扶養親族の人数（19歳以上23歳未満）</label>
      <input type="number" id="specialDependents" name="specialDependents" min="0" max="20" step="1" required />
    </div>
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
    <p class="big" id="limit"></p>
    <p id="gift-ref"></p>
    <table>
      <thead><tr><th>項目</th><th>金額</th></tr></thead>
      <tbody id="result-body"></tbody>
    </table>
  </div>
  <div class="disclaimer">
    <strong>免責事項:</strong>
    本ツールは一般的な試算を簡易に行うものであり、税務・法律上の助言に代わるものではありません。
    住宅ローン控除・医療費控除・iDeCo・生命保険料控除などの適用、個人事業主・年金受給者、年の途中の収入変動がある場合は
    実際の上限額が変わります。実際の寄付額は余裕を持たせ、お住まいの自治体や税理士等にご確認ください。
    ${SOURCE_NOTE}
    ふるさと納税の控除上限額の見直し（制度改正）が検討されており、将来の寄付には本結果が当てはまらない可能性があります。
  </div>
  <footer>入力データはこの端末のブラウザ内にのみ保存されます（サーバーへの送信は行いません）。基準日: ${AS_OF}</footer>
`

const form = document.getElementById('sim-form') as HTMLFormElement
const errorsEl = document.getElementById('errors') as HTMLDivElement
const summaryEl = document.getElementById('summary') as HTMLDivElement
const limitEl = document.getElementById('limit') as HTMLParagraphElement
const giftEl = document.getElementById('gift-ref') as HTMLParagraphElement
const resultBody = document.getElementById('result-body') as HTMLTableSectionElement
const importFile = document.getElementById('import-file') as HTMLInputElement

let lastResult: ReturnType<typeof simulate> | null = null

const el = (name: string) => form.elements.namedItem(name) as HTMLInputElement

function readFormInput(): SimulatorInput {
  const si = el('socialInsuranceYen').value.trim()
  return {
    salaryYen: el('salaryYen').value.trim() === '' ? Number.NaN : Number(el('salaryYen').value),
    socialInsuranceYen: si === '' ? null : Number(si),
    spouse: el('spouse').value as SpouseType,
    dependents: Number(el('dependents').value),
    specialDependents: Number(el('specialDependents').value),
  }
}

function fillForm(input: SimulatorInput): void {
  el('salaryYen').value = String(input.salaryYen)
  el('socialInsuranceYen').value = input.socialInsuranceYen === null ? '' : String(input.socialInsuranceYen)
  el('spouse').value = input.spouse
  el('dependents').value = String(input.dependents)
  el('specialDependents').value = String(input.specialDependents)
}

function formatYen(value: number): string {
  return Math.round(value).toLocaleString('ja-JP') + '円'
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

function renderResult(input: SimulatorInput): void {
  const errors = validateInput(input)
  errorsEl.textContent = errors.join(' ')
  if (errors.length > 0) {
    summaryEl.style.display = 'none'
    lastResult = null
    return
  }

  const r = simulate(input)
  lastResult = r
  limitEl.textContent =
    r.limitYen > 0
      ? `控除上限額の目安: 約 ${formatYen(r.limitYen)}`
      : '控除上限額の目安: 0円（住民税の所得割額がないため、控除の対象外となる可能性があります）'
  giftEl.textContent = `返礼品の還元率30%以下の場合の受取額の参考値: 約 ${formatYen(r.giftReferenceYen)}分`

  const rows: Array<[string, string]> = [
    ['給与収入', formatYen(r.salaryYen)],
    ['給与所得控除', formatYen(r.salaryDeductionYen)],
    ['給与所得', formatYen(r.incomeYen)],
    ['社会保険料（概算含む）', formatYen(r.socialInsuranceYen)],
    ['所得税の課税所得', formatYen(r.incomeTaxableYen)],
    ['所得税率', `${Math.round(r.incomeTaxRate * 100)}%`],
    ['住民税の課税所得', formatYen(r.residentTaxableYen)],
    ['調整控除', formatYen(r.adjustmentDeductionYen)],
    ['住民税の所得割額', formatYen(r.residentIncomeLevyYen)],
  ]
  resultBody.innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')
  summaryEl.style.display = 'block'
  saveInput(input)
}

form.addEventListener('submit', (e) => {
  e.preventDefault()
  renderResult(readFormInput())
})

document.getElementById('export-json')!.addEventListener('click', () => {
  download(inputToJsonBlob(readFormInput()), 'furusato-limit-settings.json')
})

document.getElementById('import-json')!.addEventListener('click', () => importFile.click())

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

document.getElementById('export-csv')!.addEventListener('click', () => {
  if (!lastResult) {
    errorsEl.textContent = '先に「試算する」を押して結果を表示してください。'
    return
  }
  download(buildResultsCsvBlob(lastResult), csvDownloadFileName())
})

const savedInput = loadInput() ?? DEFAULT_INPUT
fillForm(savedInput)
renderResult(savedInput)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // オフライン対応の登録に失敗しても、通常利用は継続できる
    })
  })
}
