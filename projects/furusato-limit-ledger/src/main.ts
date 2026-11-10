import './style.css'
import { calculateLimit, validateInput, type LimitInput, type LimitResult } from './calc'
import { summarize, validateDonation, normalizeMunicipality, type Donation } from './ledger'
import { buildDonationsCsvBlob, csvFileName, parseDonationsCsv } from './csv'
import { defaultState, loadState, saveState, stateToJsonBlob, parseStateJson, type AppState } from './storage'

const yen = (n: number) => n.toLocaleString('ja-JP') + '円'
const todayIso = () => { const d = new Date(), p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2))

const state: AppState = loadState() ?? defaultState(new Date().getFullYear())
let result: LimitResult | null = null

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) e.setAttribute(k, v)
  if (text !== undefined) e.textContent = text
  return e
}
function download(blob: Blob, name: string) {
  const a = el('a', { href: URL.createObjectURL(blob), download: name })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
function field(id: string, label: string, type: string, value: string, extra: Record<string, string> = {}) {
  const l = el('label', {}, label)
  l.appendChild(el('input', { id, type, value, ...extra }))
  return l
}
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const num = (id: string) => ($<HTMLInputElement>(id).value.trim() === '' ? NaN : Number($<HTMLInputElement>(id).value.normalize('NFKC').replace(/,/g, '')))

function render() {
  const app = $('app')
  app.textContent = ''
  const main = el('main')
  main.appendChild(el('h1', {}, 'ふるさと納税 上限額＆寄付台帳'))
  main.appendChild(el('p', { class: 'lead' }, '登録不要・オフライン対応。入力したデータはこの端末のブラウザ内にのみ保存され、外部には送信されません。'))

  // --- 上限額 ---
  const s1 = el('section'); s1.appendChild(el('h2', {}, '1. 控除上限額の目安（給与所得者）'))
  const f = el('form', { id: 'limit-form', novalidate: '' }); const g = el('div', { class: 'grid' })
  const i = state.input
  g.appendChild(field('salaryYen', '給与収入（年・円）', 'text', String(i.salaryYen), { inputmode: 'numeric' }))
  g.appendChild(field('socialInsuranceYen', '社会保険料（円・空欄で15%概算）', 'text', i.socialInsuranceYen === null ? '' : String(i.socialInsuranceYen), { inputmode: 'numeric' }))
  const sp = el('label', {}, '配偶者控除の対象となる配偶者'); const sel = el('select', { id: 'spouse' })
  sel.appendChild(el('option', { value: 'none' }, 'いない / 対象外')); sel.appendChild(el('option', { value: 'deduction' }, 'いる（配偶者控除の対象）'))
  sel.value = i.spouse; sp.appendChild(sel); g.appendChild(sp)
  g.appendChild(field('generalDependents', '一般の扶養親族（16〜18歳・23〜69歳）人数', 'text', String(i.generalDependents), { inputmode: 'numeric' }))
  g.appendChild(field('specialDependents', '特定扶養親族（19〜22歳）人数', 'text', String(i.specialDependents), { inputmode: 'numeric' }))
  g.appendChild(field('otherDeductionYen', 'その他の所得控除合計（医療費控除・iDeCo等・円）', 'text', String(i.otherDeductionYen), { inputmode: 'numeric' }))
  f.appendChild(g)
  const a = el('div', { class: 'actions' }); a.appendChild(el('button', { type: 'submit', id: 'calc-btn' }, '上限額を試算する')); f.appendChild(a)
  f.appendChild(el('ul', { id: 'errors', class: 'err' }))
  s1.appendChild(f); const out = el('div', { id: 'limit-out' }); s1.appendChild(out)
  s1.appendChild(el('p', { class: 'note' }, '※2025〜2026年分の制度に基づく一般的な目安です。住宅ローン控除・事業所得・複数の勤務先・2,000万円超の給与などは考慮していません。実際の上限額は市区町村の案内や税理士にご確認ください。'))
  main.appendChild(s1)

  // --- 台帳 ---
  const s2 = el('section'); s2.appendChild(el('h2', {}, '2. 寄付の管理台帳'))
  const yl = field('year', '寄付する年', 'text', String(state.year), { inputmode: 'numeric' }); s2.appendChild(yl)
  const df = el('form', { id: 'donation-form', novalidate: '' }); const dg = el('div', { class: 'grid' })
  dg.appendChild(field('d-date', '寄付日（YYYY-MM-DD）', 'text', todayIso()))
  dg.appendChild(field('d-muni', '自治体名', 'text', ''))
  dg.appendChild(field('d-amount', '金額（円）', 'text', '', { inputmode: 'numeric' }))
  const ml = el('label', {}, '申請方法'); const ms = el('select', { id: 'd-method' })
  ms.appendChild(el('option', { value: 'onestop' }, 'ワンストップ特例')); ms.appendChild(el('option', { value: 'kakutei' }, '確定申告'))
  ml.appendChild(ms); dg.appendChild(ml); df.appendChild(dg)
  const da = el('div', { class: 'actions' }); da.appendChild(el('button', { type: 'submit', id: 'add-btn' }, '寄付を追加')); df.appendChild(da)
  df.appendChild(el('ul', { id: 'd-errors', class: 'err' })); s2.appendChild(df)
  s2.appendChild(el('div', { id: 'summary' }))
  const tw = el('div', { class: 'table-wrap' }); const tb = el('table')
  const th = el('tr'); for (const h of ['日付', '自治体', '金額', '方法', '送付済み', '']) th.appendChild(el('th', {}, h))
  const thead = el('thead'); thead.appendChild(th); tb.appendChild(thead); tb.appendChild(el('tbody', { id: 'rows' })); tw.appendChild(tb); s2.appendChild(tw)
  main.appendChild(s2)

  // --- データ ---
  const s3 = el('section'); s3.appendChild(el('h2', {}, '3. データの保存・移行'))
  const ac = el('div', { class: 'actions' })
  for (const [id, t] of [['export-csv', '寄付一覧をCSV出力'], ['export-json', '全データをJSON出力']] as const) ac.appendChild(el('button', { type: 'button', id, class: 'secondary' }, t))
  const lf = el('label', {}, '読み込み（JSON / CSV）'); lf.appendChild(el('input', { type: 'file', id: 'import-file', accept: '.json,.csv' })); ac.appendChild(lf)
  s3.appendChild(ac); s3.appendChild(el('p', { id: 'import-msg', class: 'note' }))
  s3.appendChild(el('p', { class: 'note' }, 'データはブラウザ内（localStorage）に保存されます。ブラウザのデータを消去すると失われるため、定期的にJSONでバックアップしてください。'))
  main.appendChild(s3)
  main.appendChild(el('footer', {}, '本サイトは一般的な試算・管理ツールであり、税務・法律上の助言ではありません。制度は2026年11月時点の公開情報に基づきます。'))
  app.appendChild(main)

  f.addEventListener('submit', (e) => { e.preventDefault(); onCalc() })
  df.addEventListener('submit', (e) => { e.preventDefault(); onAdd() })
  $('year').addEventListener('change', () => { const y = num('year'); if (Number.isInteger(y) && y >= 2000 && y <= 2100) { state.year = y; persist(); refresh() } })
  $('export-csv').addEventListener('click', () => download(buildDonationsCsvBlob(state.donations), csvFileName()))
  $('export-json').addEventListener('click', () => download(stateToJsonBlob(state), 'furusato-ledger-backup.json'))
  $('import-file').addEventListener('change', onImport)
  refresh(); if (result === null) onCalc(true)
}

function persist() { saveState(state) }

function readInput(): LimitInput {
  const si = $<HTMLInputElement>('socialInsuranceYen').value.trim()
  return {
    salaryYen: num('salaryYen'),
    socialInsuranceYen: si === '' ? null : num('socialInsuranceYen'),
    spouse: $<HTMLSelectElement>('spouse').value === 'deduction' ? 'deduction' : 'none',
    generalDependents: num('generalDependents'), specialDependents: num('specialDependents'), otherDeductionYen: num('otherDeductionYen'),
  }
}

function onCalc(silent = false) {
  const input = readInput(); const errs = validateInput(input)
  const ul = $('errors'); ul.textContent = ''
  if (errs.length) { if (!silent) errs.forEach((m) => ul.appendChild(el('li', {}, m))); return }
  state.input = input; persist(); result = calculateLimit(input)
  const out = $('limit-out'); out.textContent = ''
  out.appendChild(el('div', { class: 'note' }, '控除上限額の目安'))
  out.appendChild(el('div', { class: 'big', id: 'limit-value' }, yen(result.limitYen)))
  out.appendChild(el('p', { class: 'note', id: 'limit-detail' }, `給与所得 ${yen(result.salaryIncomeYen)} / 社会保険料 ${yen(result.socialInsuranceYen)} / 所得税率 ${Math.round(result.incomeTaxRate * 100)}% / 住民税所得割 ${yen(result.residentTaxIncomePortionYen)}`))
  result.warnings.forEach((w) => out.appendChild(el('p', { class: 'warn' }, '⚠ ' + w)))
  refresh()
}

function onAdd() {
  const d = { date: $<HTMLInputElement>('d-date').value.normalize('NFKC').trim(), municipality: $<HTMLInputElement>('d-muni').value, amountYen: num('d-amount') }
  const errs = validateDonation(d); const ul = $('d-errors'); ul.textContent = ''
  if (errs.length) { errs.forEach((m) => ul.appendChild(el('li', {}, m))); return }
  state.donations.push({ id: newId(), date: d.date, municipality: d.municipality.normalize('NFKC').trim(), amountYen: d.amountYen, method: $<HTMLSelectElement>('d-method').value === 'kakutei' ? 'kakutei' : 'onestop', sent: false })
  state.donations.sort((a, b) => a.date.localeCompare(b.date))
  persist(); $<HTMLInputElement>('d-muni').value = ''; $<HTMLInputElement>('d-amount').value = ''; refresh()
}

function refresh() {
  const limit = result?.limitYen ?? 0
  const sm = summarize(state.donations, state.year, limit, todayIso())
  const box = $('summary'); box.textContent = ''
  const pct = limit > 0 ? Math.min(100, Math.round((sm.totalYen / limit) * 100)) : 0
  box.appendChild(el('p', { id: 'total' }, `${state.year}年の寄付合計: ${yen(sm.totalYen)}（${sm.count}件）`))
  const bar = el('div', { class: 'bar' + (sm.overYen > 0 ? ' over' : '') }); const inner = el('div'); inner.style.width = pct + '%'; bar.appendChild(inner); box.appendChild(bar)
  box.appendChild(el('p', { id: 'remaining', class: sm.overYen > 0 ? 'bad' : 'ok' }, sm.overYen > 0 ? `上限の目安を ${yen(sm.overYen)} 超えています（超過分は自己負担になる可能性があります）。` : `上限の目安まで あと ${yen(sm.remainingYen)}`))
  box.appendChild(el('p', { id: 'onestop-count', class: sm.onestopLimitExceeded ? 'bad' : '' }, `ワンストップ特例の寄付先: ${sm.onestopMunicipalities}自治体 / 5自治体まで` + (sm.onestopLimitExceeded ? ' — 6自治体以上のため、確定申告が必要です。' : '')))
  if (sm.unsentOnestop > 0) box.appendChild(el('p', { id: 'unsent', class: 'warn' }, `申請書が未送付のワンストップ寄付先: ${sm.unsentOnestop}自治体（${sm.deadline} 必着まで あと${sm.daysToOnestopDeadline}日）`))
  if (sm.daysToDonationEnd >= 0) box.appendChild(el('p', { class: 'note' }, `${state.year}年12月31日まで あと${sm.daysToDonationEnd}日`))
  if (sm.ignoredCount > 0) box.appendChild(el('p', { class: 'note' }, `${state.year}年以外の寄付 ${sm.ignoredCount}件は集計に含めていません。`))
  box.appendChild(el('p', { class: 'note' }, '確定申告をすると、提出済みのワンストップ特例の申請は無効になります（医療費控除などで確定申告をする場合は、全寄付を申告に含めてください）。'))

  const tb = $('rows'); tb.textContent = ''
  for (const d of state.donations) {
    const tr = el('tr'); tr.appendChild(el('td', {}, d.date)); tr.appendChild(el('td', {}, d.municipality)); tr.appendChild(el('td', {}, yen(d.amountYen)))
    tr.appendChild(el('td', {}, d.method === 'onestop' ? 'ワンストップ' : '確定申告'))
    const sc = el('td'); if (d.method === 'onestop') { const cb = el('input', { type: 'checkbox', 'aria-label': d.municipality + 'の申請書送付済み' }); cb.checked = d.sent; cb.addEventListener('change', () => { d.sent = cb.checked; persist(); refresh() }); sc.appendChild(cb) } else sc.textContent = '-'
    tr.appendChild(sc)
    const dc = el('td'); const del = el('button', { type: 'button', class: 'secondary' }, '削除'); del.addEventListener('click', () => { state.donations = state.donations.filter((x) => x.id !== d.id); persist(); refresh() }); dc.appendChild(del); tr.appendChild(dc)
    tb.appendChild(tr)
  }
}

async function onImport(ev: Event) {
  const inp = ev.target as HTMLInputElement; const file = inp.files?.[0]; const msg = $('import-msg')
  if (!file) return
  try {
    const text = await file.text()
    const isJson = text.replace(/^\uFEFF/, '').trimStart().startsWith('{')
    if (!isJson) {
      const list = parseDonationsCsv(text, newId)
      const key = (d: Donation) => `${d.date}|${normalizeMunicipality(d.municipality)}|${d.amountYen}`
      const have = new Set(state.donations.map(key)); let added = 0
      for (const d of list) if (!have.has(key(d))) { state.donations.push(d); have.add(key(d)); added++ }
      state.donations.sort((a, b) => a.date.localeCompare(b.date)); persist()
      msg.textContent = `CSVから ${added}件を追加しました（重複 ${list.length - added}件はスキップ）。`
    } else {
      const s = parseStateJson(text); Object.assign(state, s); persist(); result = null
      msg.textContent = 'JSONを読み込みました。'; render(); $('import-msg').textContent = 'JSONを読み込みました。'; return
    }
    refresh()
  } catch (e) { msg.textContent = e instanceof Error ? e.message : '読み込みに失敗しました。' }
  inp.value = ''
}

render()
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}) })
}
