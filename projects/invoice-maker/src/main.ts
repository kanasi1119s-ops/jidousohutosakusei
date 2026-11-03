import './style.css'
import {
  calcTotals, formatYen, lineAmount, normalizeRegistrationNo, parseNumber, validateInvoice,
  type Invoice, type RoundingMode, type TaxRate,
} from './calc'
import { buildCsvBlob, safeFileName } from './csv'
import { exportJson, loadAll, loadProfile, newInvoice, parseImport, saveAll, saveProfile } from './storage'

const app = document.getElementById('app')!
let list: Invoice[] = loadAll()
let cur: Invoice = list[0] ?? applyProfile(newInvoice())

function applyProfile(inv: Invoice): Invoice {
  const p = loadProfile()
  if (p) Object.assign(inv, p)
  return inv
}

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

app.innerHTML = `
<header>
  <h1>適格請求書ジェネレーター</h1>
  <p class="lead">登録不要・オフライン対応。入力内容はこのブラウザ内にのみ保存され、外部には送信されません。</p>
</header>
<main>
  <div id="issues" class="issues" role="status"></div>
  <div class="layout">
    <section class="edit" aria-label="入力フォーム">
      <fieldset><legend>発行者（あなた）</legend>
        <label>氏名または名称<input id="issuerName" autocomplete="off"></label>
        <label>住所<input id="issuerAddress" autocomplete="off"></label>
        <label>登録番号（T+13桁）<input id="registrationNo" placeholder="T1234567890123" autocomplete="off"></label>
        <label>振込先<textarea id="bankInfo"></textarea></label>
        <button type="button" id="saveProfile">発行者情報を次回用に保存</button>
      </fieldset>
      <fieldset><legend>請求先・基本情報</legend>
        <div class="row">
          <label>宛名<input id="clientName" autocomplete="off"></label>
          <label>敬称<select id="honorific"><option>御中</option><option>様</option><option value="">なし</option></select></label>
          <label>請求書番号<input id="invoiceNo" autocomplete="off"></label>
          <label>発行日（取引年月日）<input id="issueDate" type="date"></label>
          <label>支払期限<input id="dueDate" type="date"></label>
          <label>消費税の端数処理<select id="rounding"><option value="floor">切り捨て</option><option value="round">四捨五入</option><option value="ceil">切り上げ</option></select></label>
        </div>
      </fieldset>
      <fieldset><legend>明細</legend>
        <div id="items"></div>
        <button type="button" id="addItem">＋ 明細を追加</button>
      </fieldset>
      <fieldset><legend>備考</legend><textarea id="note"></textarea></fieldset>
    </section>
    <section aria-label="プレビュー">
      <div class="actions">
        <button type="button" class="primary" id="print">PDFとして保存／印刷</button>
        <button type="button" id="csv">明細CSV</button>
        <button type="button" id="save">この請求書を保存</button>
        <button type="button" id="new">新規作成</button>
      </div>
      <div id="preview" class="paper"></div>
      <fieldset class="saved-box"><legend>保存済みの請求書</legend>
        <ul id="saved" class="saved"></ul>
        <div class="actions">
          <button type="button" id="exportJson">全件をJSONでバックアップ</button>
          <label style="display:inline">JSON読み込み<input id="importJson" type="file" accept="application/json,.json"></label>
        </div>
        <p id="msg" class="disclaimer" role="status"></p>
      </fieldset>
    </section>
  </div>
</main>
<footer>
  <p class="disclaimer">本ツールは請求書作成の補助であり、税務・法律上の助言ではありません。適格請求書の記載要件や税率は国税庁の公表情報で必ずご確認ください。生成した書類の内容の責任は利用者にあります。</p>
</footer>`

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T
const textIds = ['issuerName', 'issuerAddress', 'registrationNo', 'bankInfo', 'clientName', 'invoiceNo', 'issueDate', 'dueDate', 'note'] as const

function download(blob: Blob, name: string): void {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

function say(m: string): void { $('msg').textContent = m }

function renderItems(): void {
  $('items').innerHTML = cur.items
    .map(
      (it, i) => `<div class="item" data-i="${i}">
      <label class="name">品目<input data-f="name" value="${esc(it.name)}"></label>
      <label>数量<input data-f="quantity" inputmode="decimal" value="${it.quantity}"></label>
      <label>単価(税抜)<input data-f="unitPrice" inputmode="decimal" value="${it.unitPrice}"></label>
      <label>税率<select data-f="taxRate"><option value="10"${it.taxRate === 10 ? ' selected' : ''}>10%</option><option value="8"${it.taxRate === 8 ? ' selected' : ''}>8%（軽減）</option><option value="0"${it.taxRate === 0 ? ' selected' : ''}>非課税/不課税</option></select></label>
      <button type="button" data-del="${i}" aria-label="明細${i + 1}を削除">削除</button></div>`,
    )
    .join('')
}

function renderForm(): void {
  for (const id of textIds) ($(id) as HTMLInputElement).value = cur[id]
  ;($('honorific') as HTMLSelectElement).value = cur.honorific
  ;($('rounding') as HTMLSelectElement).value = cur.rounding
  renderItems()
}

function renderPreview(): void {
  const t = calcTotals(cur.items, cur.rounding)
  const rows = cur.items
    .filter((i) => i.name.trim())
    .map((i) => `<tr><td>${esc(i.name)}${i.taxRate === 8 ? ' ※' : ''}</td><td class="r">${i.quantity}</td><td class="r">${formatYen(i.unitPrice)}</td><td class="r">${i.taxRate}%</td><td class="r">${formatYen(lineAmount(i))}</td></tr>`)
    .join('')
  const reduced = cur.items.some((i) => i.taxRate === 8 && i.name.trim())
  $('preview').innerHTML = `
    <h2>請求書</h2>
    <div class="meta">
      <div><strong>${esc(cur.clientName)} ${esc(cur.honorific)}</strong><br>下記のとおりご請求申し上げます。</div>
      <div>請求書番号: ${esc(cur.invoiceNo)}<br>発行日: ${esc(cur.issueDate)}<br>支払期限: ${esc(cur.dueDate)}</div>
    </div>
    <p class="total">ご請求金額（税込）: ${formatYen(t.total)}</p>
    <table><thead><tr><th>品目</th><th>数量</th><th>単価</th><th>税率</th><th>金額(税抜)</th></tr></thead><tbody>${rows}</tbody></table>
    ${reduced ? '<p>※ は軽減税率（8%）対象品目です。</p>' : ''}
    <table><thead><tr><th>税率区分</th><th>税抜合計</th><th>消費税額</th></tr></thead><tbody>${t.byRate
      .map((r) => `<tr><td>${r.rate === 0 ? '非課税/不課税' : r.rate + '%対象'}</td><td class="r">${formatYen(r.subtotal)}</td><td class="r">${formatYen(r.tax)}</td></tr>`)
      .join('')}</tbody></table>
    <div class="meta"><div class="pre">${esc(cur.issuerName)}\n${esc(cur.issuerAddress)}\n${cur.registrationNo ? '登録番号: ' + esc(cur.registrationNo) : ''}</div>
    <div class="pre">${esc(cur.bankInfo ? '【お振込先】\n' + cur.bankInfo : '')}</div></div>
    <p class="pre">${esc(cur.note)}</p>`
  const issues = validateInvoice(cur)
  $('issues').innerHTML = issues.length ? '<strong>適格請求書として不足している可能性のある項目</strong><ul>' + issues.map((i) => `<li>${esc(i.message)}</li>`).join('') + '</ul>' : ''
}

function renderSaved(): void {
  $('saved').innerHTML = list.length
    ? list.map((x) => `<li><span>${esc(x.invoiceNo || '(番号なし)')} / ${esc(x.clientName || '(宛名なし)')}</span><span><button type="button" data-load="${esc(x.id)}">開く</button> <button type="button" data-rm="${esc(x.id)}">削除</button></span></li>`).join('')
    : '<li>保存済みの請求書はありません</li>'
}

function refresh(): void { renderPreview() }

for (const id of textIds) {
  $(id).addEventListener('input', (e) => {
    let v = (e.target as HTMLInputElement).value
    if (id === 'registrationNo') v = normalizeRegistrationNo(v)
    cur[id] = v
    refresh()
  })
}
$('registrationNo').addEventListener('blur', () => { ($('registrationNo') as HTMLInputElement).value = cur.registrationNo })
$('honorific').addEventListener('change', (e) => { cur.honorific = (e.target as HTMLSelectElement).value; refresh() })
$('rounding').addEventListener('change', (e) => { cur.rounding = (e.target as HTMLSelectElement).value as RoundingMode; refresh() })

$('items').addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement
  const row = el.closest<HTMLElement>('.item')
  if (!row || !el.dataset.f) return
  const it = cur.items[Number(row.dataset.i)]
  if (el.dataset.f === 'name') it.name = el.value
  else if (el.dataset.f === 'quantity') it.quantity = parseNumber(el.value)
  else if (el.dataset.f === 'unitPrice') it.unitPrice = parseNumber(el.value)
  else if (el.dataset.f === 'taxRate') it.taxRate = Number(el.value) as TaxRate
  refresh()
})
$('items').addEventListener('click', (e) => {
  const d = (e.target as HTMLElement).dataset.del
  if (d === undefined) return
  cur.items.splice(Number(d), 1)
  if (cur.items.length === 0) cur.items.push({ name: '', quantity: 1, unitPrice: 0, taxRate: 10 })
  renderItems(); refresh()
})
$('addItem').addEventListener('click', () => { cur.items.push({ name: '', quantity: 1, unitPrice: 0, taxRate: 10 }); renderItems(); refresh() })

$('saveProfile').addEventListener('click', () => {
  saveProfile({ issuerName: cur.issuerName, issuerAddress: cur.issuerAddress, registrationNo: cur.registrationNo, bankInfo: cur.bankInfo })
  say('発行者情報をこのブラウザに保存しました。')
})
$('save').addEventListener('click', () => {
  cur.updatedAt = new Date().toISOString()
  const idx = list.findIndex((x) => x.id === cur.id)
  if (idx >= 0) list[idx] = structuredClone(cur)
  else list.unshift(structuredClone(cur))
  saveAll(list); renderSaved(); say('保存しました。')
})
$('new').addEventListener('click', () => { cur = applyProfile(newInvoice()); renderForm(); refresh(); say('') })
$('saved').addEventListener('click', (e) => {
  const t = e.target as HTMLElement
  if (t.dataset.load) { const f = list.find((x) => x.id === t.dataset.load); if (f) { cur = structuredClone(f); renderForm(); refresh() } }
  if (t.dataset.rm) { list = list.filter((x) => x.id !== t.dataset.rm); saveAll(list); renderSaved() }
})
$('print').addEventListener('click', () => window.print())
$('csv').addEventListener('click', () => download(buildCsvBlob(cur), safeFileName(cur, 'csv')))
$('exportJson').addEventListener('click', () => {
  download(new Blob([exportJson(list)], { type: 'application/json;charset=utf-8' }), `invoice-maker-backup-${new Date().toISOString().slice(0, 10)}.json`)
})
$('importJson').addEventListener('change', async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  try {
    const imported = parseImport(await f.text())
    const ids = new Set(list.map((x) => x.id))
    list = [...imported.filter((x) => !ids.has(x.id)), ...list]
    saveAll(list); renderSaved(); say(`${imported.length}件を読み込みました。`)
  } catch {
    say('読み込みに失敗しました。このツールで書き出したJSONファイルを選んでください。')
  }
  ;(e.target as HTMLInputElement).value = ''
})

renderForm(); renderPreview(); renderSaved()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* 非対応環境では無視 */ })
}
