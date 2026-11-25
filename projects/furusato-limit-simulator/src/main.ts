import './style.css'
import { calculate, validateInput, AS_OF, type FurusatoInput } from './calc'
import { DEFAULT_INPUT, loadInput, saveInput, inputToJsonBlob, parseInputFromJsonText } from './storage'
import { parseNumberField } from './parse'
import { buildResultCsvBlob, csvDownloadFileName } from './csv'

const app = document.getElementById('app')
if (!app) throw new Error('#app 要素が見つかりません')

app.innerHTML = `
  <h1>ふるさと納税 控除上限額シミュレーター</h1>
  <p class="subtitle">給与収入と家族構成から、2026年中の寄附の控除上限額の目安を試算します（給与所得者向け）。</p>
  <div>
    <span class="badge">登録不要</span>
    <span class="badge">入力データは外部送信されません</span>
    <span class="badge">オフラインでも利用可能</span>
  </div>
  <form id="sim-form" novalidate>
    <div class="field">
      <label for="annualSalaryYen">給与収入（額面・年間, 円）</label>
      <input type="text" inputmode="numeric" id="annualSalaryYen" name="annualSalaryYen" autocomplete="off" />
    </div>
    <div class="field">
      <label for="socialInsuranceYen">社会保険料（年間, 円）※空欄なら給与収入の15%で概算</label>
      <input type="text" inputmode="numeric" id="socialInsuranceYen" name="socialInsuranceYen" autocomplete="off" placeholder="空欄で自動概算" />
    </div>
    <div class="field">
      <label for="otherDeductionsYen">その他の所得控除の合計（円）※生命保険料・iDeCo・医療費控除など</label>
      <input type="text" inputmode="numeric" id="otherDeductionsYen" name="otherDeductionsYen" autocomplete="off" />
    </div>
    <div class="field">
      <label for="spouse">配偶者</label>
      <select id="spouse" name="spouse">
        <option value="none">なし／配偶者控除の対象外</option>
        <option value="deduction">配偶者控除の対象（配偶者の給与収入123万円以下）</option>
      </select>
      <small>配偶者特別控除（配偶者の給与収入が123万円超）は未対応です。「対象外」を選ぶと安全側（低め）の目安になります。</small>
    </div>
    <div class="field">
      <label for="generalDependents">一般の扶養親族の人数（16歳以上、19〜22歳を除く）</label>
      <input type="text" inputmode="numeric" id="generalDependents" name="generalDependents" autocomplete="off" />
    </div>
    <div class="field">
      <label for="specialDependents">特定扶養親族の人数（19〜22歳）</label>
      <input type="text" inputmode="numeric" id="specialDependents" name="specialDependents" autocomplete="off" />
    </div>
    <div class="field">
      <label for="alreadyDonatedYen">今年すでに寄附した額（円）</label>
      <input type="text" inputmode="numeric" id="alreadyDonatedYen" name="alreadyDonatedYen" autocomplete="off" />
    </div>
    <div class="errors" id="errors" role="alert"></div>
    <div class="actions">
      <button type="submit">試算する</button>
      <button type="button" class="secondary" id="export-json">設定をエクスポート(JSON)</button>
      <button type="button" class="secondary" id="import-json">設定をインポート(JSON)</button>
      <input type="file" id="import-file" accept="application/json,.json" class="hidden" />
      <button type="button" class="secondary" id="export-csv">結果をCSVでダウンロード</button>
    </div>
  </form>
  <div class="summary hidden" id="summary">
    <h2>試算結果</h2>
    <p class="big">控除上限額の目安 <strong id="limit"></strong></p>
    <p>余裕をみた目安（上限額の9割） <strong id="safe-limit"></strong></p>
    <p id="remaining"></p>
    <table>
      <tbody id="detail-body"></tbody>
    </table>
    <p class="note">自己負担は原則2,000円です。上限額を超えた分は全額自己負担になります。</p>
  </div>
  <div class="disclaimer">
    <strong>免責事項:</strong>
    本ツールが示す金額はあくまで一般的な計算式（住民税所得割額×20%÷(90%−所得税率×1.021)＋2,000円）による目安であり、
    実際の控除額を保証するものではなく、税務上の助言に代わるものでもありません。住宅ローン控除・医療費控除・配当控除・
    副業所得・配偶者特別控除・老人扶養・障害者控除・特定親族特別控除などには対応していません。
    収入や控除の状況により実際の上限額は異なります。正確な金額は、源泉徴収票・住民税決定通知書や、
    <a href="https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/furusato/mechanism/deduction.html" rel="noopener noreferrer" target="_blank">総務省ふるさと納税ポータルサイト</a>
    の最新情報でご確認いただくか、税理士・お住まいの自治体にご相談ください。
    税制は2026年11月時点の公表内容に基づく想定（令和8年分所得税・令和9年度住民税）であり、改正により変わる場合があります。
  </div>
  <section class="notes">
    <h2>年末の手続きメモ（一般的な目安）</h2>
    <ul>
      <li>寄附の年内扱い: クレジットカード決済は決済完了日、振込は入金日が基準になるのが一般的です（自治体の案内で要確認）。</li>
      <li>ワンストップ特例: 寄附先が5自治体以内の給与所得者が対象。申請書は2027年1月10日必着が目安です。</li>
      <li>確定申告: 2026年分の申告期限は2027年3月15日が目安です。</li>
    </ul>
  </section>
  <footer>入力データはこの端末のブラウザ内にのみ保存されます（サーバーへの送信は行いません）。基準日: ${AS_OF}</footer>
`

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const form = $<HTMLFormElement>('sim-form')
const errorsEl = $<HTMLDivElement>('errors')
const summaryEl = $<HTMLDivElement>('summary')
const importFile = $<HTMLInputElement>('import-file')

let last: { input: FurusatoInput; result: ReturnType<typeof calculate> } | null = null

const fieldValue = (name: string): string =>
  (form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement).value

function readFormInput(): FurusatoInput {
  const req = (name: string): number => parseNumberField(fieldValue(name)) ?? 0
  const si = parseNumberField(fieldValue('socialInsuranceYen'))
  return {
    annualSalaryYen: parseNumberField(fieldValue('annualSalaryYen')) ?? NaN,
    socialInsuranceYen: si,
    otherDeductionsYen: req('otherDeductionsYen'),
    spouse: fieldValue('spouse') === 'deduction' ? 'deduction' : 'none',
    generalDependents: req('generalDependents'),
    specialDependents: req('specialDependents'),
    alreadyDonatedYen: req('alreadyDonatedYen'),
  }
}

function fillForm(i: FurusatoInput): void {
  const set = (name: string, v: string) => {
    ;(form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement).value = v
  }
  set('annualSalaryYen', String(i.annualSalaryYen))
  set('socialInsuranceYen', i.socialInsuranceYen === null ? '' : String(i.socialInsuranceYen))
  set('otherDeductionsYen', String(i.otherDeductionsYen))
  set('spouse', i.spouse)
  set('generalDependents', String(i.generalDependents))
  set('specialDependents', String(i.specialDependents))
  set('alreadyDonatedYen', String(i.alreadyDonatedYen))
}

const yen = (v: number) => Math.round(v).toLocaleString('ja-JP') + '円'

function render(input: FurusatoInput): void {
  const errors = validateInput(input)
  errorsEl.textContent = errors.join(' ')
  if (errors.length > 0) {
    summaryEl.classList.add('hidden')
    last = null
    return
  }
  const r = calculate(input)
  last = { input, result: r }
  $('limit').textContent = yen(r.limitYen)
  $('safe-limit').textContent = yen(r.safeLimitYen)
  $('remaining').textContent =
    r.remainingYen >= 0
      ? `寄附済み額 ${yen(input.alreadyDonatedYen)} を引いた、上限額までの残り: ${yen(r.remainingYen)}`
      : `寄附済み額 ${yen(input.alreadyDonatedYen)} は上限額の目安を ${yen(-r.remainingYen)} 超えています（超過分は全額自己負担になる可能性があります）。`
  const rows: [string, string][] = [
    ['給与所得控除', yen(r.salaryDeductionYen)],
    ['給与所得', yen(r.salaryIncomeYen)],
    ['社会保険料（使用値）', yen(r.socialInsuranceYen)],
    ['所得税の課税所得 / 税率', `${yen(r.incomeTaxTaxableYen)} / ${Math.round(r.incomeTaxRate * 100)}%`],
    ['住民税の課税所得', yen(r.residentTaxTaxableYen)],
    ['住民税所得割額（調整控除 ' + yen(r.adjustmentDeductionYen) + ' 適用後）', yen(r.residentTaxIncomePortionYen)],
  ]
  $('detail-body').innerHTML = rows.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('')
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
  render(readFormInput())
})

$('export-json').addEventListener('click', () => {
  download(inputToJsonBlob(readFormInput()), 'furusato-limit-settings.json')
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
    errorsEl.textContent = '先に「試算する」を押して、入力エラーのない状態で結果を表示してください。'
    return
  }
  download(buildResultCsvBlob(last.input, last.result), csvDownloadFileName())
})

const initial = loadInput() ?? DEFAULT_INPUT
fillForm(initial)
render(initial)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // 登録に失敗しても通常利用は継続できる
    })
  })
}
