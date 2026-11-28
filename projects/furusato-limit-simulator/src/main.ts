import './style.css'
import { DEFAULT_INPUT, buildQuickTable, parseYen, simulate, type SimulatorInput, type SpouseType } from './calc'
import { buildResultsCsvBlob, csvDownloadFileName } from './csv'
import { PARAMS_AS_OF } from './params'
import { inputToJsonBlob, loadInput, parseInputFromJsonText, saveInput } from './storage'

const yen = (n: number) => `${n.toLocaleString('ja-JP')}円`

const app = document.getElementById('app')!
app.innerHTML = `
  <h1>ふるさと納税 上限額シミュレーター</h1>
  <p class="subtitle">給与所得者向け・2026年（令和8年）の寄附の目安。登録不要・オフライン対応。</p>
  <span class="privacy-badge">入力データはこの端末のブラウザ内にのみ保存され、外部には送信されません</span>

  <section class="card" aria-labelledby="h-input">
    <h2 id="h-input">条件を入力</h2>
    <label>給与収入（年収・額面・円）
      <input id="salary" type="text" inputmode="numeric" autocomplete="off" />
    </label>
    <label>社会保険料（円・空欄で年収の15%で概算）
      <input id="social" type="text" inputmode="numeric" autocomplete="off" placeholder="空欄＝概算" />
    </label>
    <label>配偶者
      <select id="spouse">
        <option value="none">いない／控除対象外</option>
        <option value="spouse">配偶者控除の対象（配偶者の合計所得58万円以下）</option>
        <option value="special">配偶者特別控除（満額相当）の対象</option>
      </select>
    </label>
    <label>扶養親族: 16〜18歳・23〜69歳（人）
      <input id="depGeneral" type="text" inputmode="numeric" autocomplete="off" />
    </label>
    <label>扶養親族: 19〜22歳（人）
      <input id="depSpecific" type="text" inputmode="numeric" autocomplete="off" />
    </label>
    <label>扶養親族: 70歳以上（人）
      <input id="depElderly" type="text" inputmode="numeric" autocomplete="off" />
    </label>
    <label>その他の所得控除の合計（生命保険料・地震保険料・医療費控除など・円）
      <input id="other" type="text" inputmode="numeric" autocomplete="off" />
    </label>
    <label>住宅ローン控除のうち住民税から控除される額（円）
      <input id="housing" type="text" inputmode="numeric" autocomplete="off" />
    </label>
    <label>今年の寄附予定額（任意・円）
      <input id="planned" type="text" inputmode="numeric" autocomplete="off" />
    </label>
    <p id="input-error" class="error hidden" role="alert"></p>
  </section>

  <section class="card" aria-labelledby="h-result" aria-live="polite">
    <h2 id="h-result">結果</h2>
    <p class="big">控除上限額の目安: <strong id="limit"></strong></p>
    <p>余裕を見た目安（上限の約9割）: <strong id="safe"></strong></p>
    <p id="donation-status" class="status"></p>
    <details>
      <summary>計算の内訳</summary>
      <ul id="breakdown"></ul>
    </details>
  </section>

  <section class="card" aria-labelledby="h-table">
    <h2 id="h-table">年収別の早見表（現在の家族構成のまま）</h2>
    <div class="table-wrap"><table id="quick"><thead><tr><th>給与収入</th><th>上限の目安</th><th>余裕を見た目安</th></tr></thead><tbody></tbody></table></div>
  </section>

  <section class="card" aria-labelledby="h-data">
    <h2 id="h-data">データの保存・書き出し</h2>
    <div class="buttons">
      <button id="btn-csv" type="button">結果をCSVでダウンロード</button>
      <button id="btn-json" type="button">設定をJSONで書き出し</button>
      <button id="btn-import" type="button">JSONを読み込み</button>
      <button id="btn-reset" type="button">入力をリセット</button>
    </div>
    <input id="file-import" type="file" accept="application/json,.json" class="hidden" />
    <p id="data-message" class="message" role="status"></p>
  </section>

  <section class="card disclaimer" aria-labelledby="h-disc">
    <h2 id="h-disc">ご利用にあたって（免責）</h2>
    <ul>
      <li>本サイトの結果は一般的な算式による<strong>概算の目安</strong>であり、実際の控除額を保証するものではありません。お住まいの市区町村から届く住民税決定通知書、または各ポータルの詳細シミュレーション等で最終確認してください。税務・法律上の助言に代わるものではありません。</li>
      <li>住宅ローン控除・医療費控除・雑損控除・自営業等の所得・年の途中の転職・副業収入は簡易的にしか反映できません。該当する場合は専門家や自治体にご相談ください。</li>
      <li>制度パラメータの基準日: ${PARAMS_AS_OF}。2027年（令和9年）以降の寄附は特例控除額に定額上限が設けられる改正が予定されており、本サイトの対象外です。</li>
      <li>寄附金控除を受けるには、確定申告またはワンストップ特例制度の手続きが必要です（ワンストップ特例は寄附先が年5自治体以内などの条件あり）。</li>
    </ul>
  </section>
`

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

const fields = {
  salary: $<HTMLInputElement>('salary'),
  social: $<HTMLInputElement>('social'),
  spouse: $<HTMLSelectElement>('spouse'),
  depGeneral: $<HTMLInputElement>('depGeneral'),
  depSpecific: $<HTMLInputElement>('depSpecific'),
  depElderly: $<HTMLInputElement>('depElderly'),
  other: $<HTMLInputElement>('other'),
  housing: $<HTMLInputElement>('housing'),
  planned: $<HTMLInputElement>('planned'),
}

function setFields(input: SimulatorInput) {
  fields.salary.value = String(input.salaryYen)
  fields.social.value = input.socialInsuranceYen === null ? '' : String(input.socialInsuranceYen)
  fields.spouse.value = input.spouse
  fields.depGeneral.value = String(input.dependentsGeneral)
  fields.depSpecific.value = String(input.dependentsSpecific)
  fields.depElderly.value = String(input.dependentsElderly)
  fields.other.value = String(input.otherDeductionsYen)
  fields.housing.value = String(input.housingLoanResidentTaxYen)
  fields.planned.value = input.plannedDonationYen > 0 ? String(input.plannedDonationYen) : ''
}

function readFields(): { input: SimulatorInput | null; error: string | null } {
  const num = (el: HTMLInputElement, label: string, allowEmpty = true): number | string => {
    if (el.value.trim() === '') return allowEmpty ? 0 : `${label}を入力してください。`
    const n = parseYen(el.value)
    return n === null ? `${label}は0以上の整数（半角・全角どちらも可）で入力してください。` : n
  }
  const salary = num(fields.salary, '給与収入', false)
  const dg = num(fields.depGeneral, '扶養親族（16〜18歳・23〜69歳）')
  const ds = num(fields.depSpecific, '扶養親族（19〜22歳）')
  const de = num(fields.depElderly, '扶養親族（70歳以上）')
  const other = num(fields.other, 'その他の所得控除')
  const housing = num(fields.housing, '住宅ローン控除額')
  const planned = num(fields.planned, '寄附予定額')
  const all = [salary, dg, ds, de, other, housing, planned]
  const err = all.find((v): v is string => typeof v === 'string')
  let social: number | null = null
  let socialErr: string | null = null
  if (fields.social.value.trim() !== '') {
    social = parseYen(fields.social.value)
    if (social === null) socialErr = '社会保険料は0以上の整数で入力してください。'
  }
  if (err || socialErr) return { input: null, error: err ?? socialErr }
  return {
    input: {
      salaryYen: salary as number,
      socialInsuranceYen: social,
      spouse: fields.spouse.value as SpouseType,
      dependentsGeneral: dg as number,
      dependentsSpecific: ds as number,
      dependentsElderly: de as number,
      otherDeductionsYen: other as number,
      housingLoanResidentTaxYen: housing as number,
      plannedDonationYen: planned as number,
    },
    error: null,
  }
}

let current: SimulatorInput = loadInput() ?? DEFAULT_INPUT
setFields(current)

function render() {
  const { input, error } = readFields()
  const errEl = $('input-error')
  if (!input) {
    errEl.textContent = error
    errEl.classList.remove('hidden')
    return
  }
  errEl.classList.add('hidden')
  current = input
  saveInput(input)
  const r = simulate(input)
  $('limit').textContent = yen(r.limitYen)
  $('safe').textContent = yen(r.safeLimitYen)
  const status = $('donation-status')
  if (r.donationStatus === 'within') {
    status.textContent = `寄附予定額は上限の目安の範囲内です（自己負担は約${yen(r.estimatedSelfBurdenYen)}）。`
  } else if (r.donationStatus === 'over') {
    status.textContent = `寄附予定額が上限の目安を超えています。超過分は控除されず、自己負担は約${yen(r.estimatedSelfBurdenYen)}になる見込みです。`
  } else {
    status.textContent = ''
  }
  const items = [
    `給与所得控除: ${yen(r.salaryDeductionYen)}`,
    `給与所得: ${yen(r.incomeYen)}`,
    `社会保険料: ${yen(r.socialInsuranceYen)}`,
    `住民税の課税所得: ${yen(r.residentTaxableYen)}`,
    `所得税の課税所得: ${yen(r.incomeTaxableYen)}（税率 ${Math.round(r.incomeTaxRate * 100)}%）`,
    `調整控除: ${yen(r.adjustmentDeductionYen)}`,
    `住民税所得割額: ${yen(r.residentTaxIncomePortionYen)}`,
    `特例控除の割合: ${(r.specialDeductionRate * 100).toFixed(2)}%`,
  ]
  const ul = $('breakdown')
  ul.replaceChildren(
    ...items.map((t) => {
      const li = document.createElement('li')
      li.textContent = t
      return li
    }),
  )
  const tbody = document.querySelector<HTMLTableSectionElement>('#quick tbody')!
  tbody.replaceChildren(
    ...buildQuickTable(input).map((row) => {
      const tr = document.createElement('tr')
      for (const text of [`${row.salaryYen / 10_000}万円`, yen(row.limitYen), yen(row.safeLimitYen)]) {
        const td = document.createElement('td')
        td.textContent = text
        tr.appendChild(td)
      }
      return tr
    }),
  )
}

for (const el of Object.values(fields)) {
  el.addEventListener('input', render)
  el.addEventListener('change', render)
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const msg = (text: string) => {
  $('data-message').textContent = text
}

$('btn-csv').addEventListener('click', () => {
  const { input } = readFields()
  if (!input) return msg('入力内容を確認してください。')
  download(buildResultsCsvBlob(input, simulate(input)), csvDownloadFileName())
  msg('CSVをダウンロードしました（Excelで開いても文字化けしないBOM付きUTF-8）。')
})
$('btn-json').addEventListener('click', () => {
  const { input } = readFields()
  if (!input) return msg('入力内容を確認してください。')
  download(inputToJsonBlob(input), 'furusato-limit-settings.json')
  msg('設定をJSONで書き出しました。')
})
$('btn-import').addEventListener('click', () => $<HTMLInputElement>('file-import').click())
$<HTMLInputElement>('file-import').addEventListener('change', async (ev) => {
  const el = ev.target as HTMLInputElement
  const file = el.files?.[0]
  if (!file) return
  try {
    const imported = parseInputFromJsonText(await file.text())
    setFields(imported)
    render()
    msg('JSONを読み込みました。')
  } catch (e) {
    msg(e instanceof Error ? e.message : '読み込みに失敗しました。')
  } finally {
    el.value = ''
  }
})
$('btn-reset').addEventListener('click', () => {
  setFields(DEFAULT_INPUT)
  render()
  msg('入力をリセットしました。')
})

render()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {})
}
