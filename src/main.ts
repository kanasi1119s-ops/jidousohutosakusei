import { FAMILY_TYPE_LABELS, simulate, type FamilyType } from './lib/calc'
import {
  clearAllRecords,
  deleteRecord,
  exportAsCsv,
  exportAsJson,
  importFromJson,
  listRecords,
  saveRecord,
  type SavedRecord,
} from './lib/storage'
import { downloadTextFile, safeTimestampFilename } from './lib/download'

const yen = new Intl.NumberFormat('ja-JP')

function familyOptionsHtml(): string {
  return (Object.keys(FAMILY_TYPE_LABELS) as FamilyType[])
    .map((key) => `<option value="${key}">${FAMILY_TYPE_LABELS[key]}</option>`)
    .join('')
}

function recordsTableHtml(records: SavedRecord[]): string {
  if (records.length === 0) {
    return '<p class="result-note">保存された記録はまだありません。</p>'
  }
  const rows = records
    .map(
      (r) => `
      <tr data-id="${r.id}">
        <td>${new Date(r.savedAt).toLocaleString('ja-JP')}</td>
        <td>${yen.format(r.annualIncome)}円</td>
        <td>${FAMILY_TYPE_LABELS[r.familyType]}</td>
        <td>${yen.format(r.result.donationLimit)}円</td>
        <td><button class="delete-record" data-id="${r.id}" type="button">削除</button></td>
      </tr>`,
    )
    .join('')
  return `
    <table class="records">
      <thead>
        <tr><th>保存日時</th><th>年収</th><th>家族構成</th><th>上限額</th><th></th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `
}

function render(): void {
  const app = document.getElementById('app')
  if (!app) return

  const records = listRecords()

  app.innerHTML = `
    <header class="app-header">
      <h1>ふるさと納税 控除上限額シミュレーター</h1>
      <p class="tagline">年収と家族構成から、ふるさと納税の控除上限額（概算）をその場で計算します。</p>
      <div class="badges">
        <span class="badge">登録不要</span>
        <span class="badge">データはブラウザ内のみ・外部送信なし</span>
        <span class="badge">オフライン対応（一度開けば通信不要）</span>
      </div>
    </header>

    <section class="card">
      <form id="sim-form">
        <label for="income">年収（給与収入額・円）</label>
        <input id="income" name="income" type="number" min="0" step="10000" inputmode="numeric" placeholder="例: 5000000" required />

        <label for="family">家族構成</label>
        <select id="family" name="family">${familyOptionsHtml()}</select>

        <div class="button-row">
          <button class="primary" type="submit">計算する</button>
        </div>
      </form>
    </section>

    <section class="card" id="result-card" hidden>
      <label>控除上限額（概算・年間）</label>
      <p class="result-amount" id="result-amount">-</p>
      <p class="result-note" id="result-detail"></p>
      <div class="button-row">
        <button id="save-btn" type="button">この結果を保存する</button>
      </div>
    </section>

    <section class="card">
      <h2 style="margin-top:0;font-size:1rem;">保存した記録</h2>
      <div id="records-area">${recordsTableHtml(records)}</div>
      <div class="button-row">
        <button id="export-csv" type="button">CSVでエクスポート</button>
        <button id="export-json" type="button">JSONでエクスポート（バックアップ）</button>
        <label for="import-json" style="display:inline-flex;align-items:center;margin:0;">
          <button id="import-json-btn" type="button">JSONをインポート</button>
        </label>
        <input id="import-json" type="file" accept="application/json" hidden />
        <button id="clear-records" type="button">全件削除</button>
      </div>
    </section>

    <section class="card disclaimer">
      <p><strong>ご利用にあたって（免責事項）</strong></p>
      <p>
        本ツールが示す金額は、一般的な給与所得者を想定した簡易モデルによる概算です。
        医療費控除・iDeCo・生命保険料控除・住宅ローン控除・調整控除など個別の事情により
        実際の控除上限額は変動します。正確な金額は、お住まいの自治体・税務署・税理士等に
        ご確認ください。本ツールは専門家による助言に代わるものではありません。
      </p>
      <p>
        計算式の根拠: 総務省「ふるさと納税のしくみ｜税金の控除について」
        （控除上限額 ≒ 住民税所得割額 × 20% ÷ (90% − 所得税率 × 1.021) + 2,000円）。
        算出日時点（2026年）の制度・税率表に基づきます。
      </p>
      <p>
        入力した年収・家族構成などのデータは、このブラウザの localStorage にのみ保存され、
        サーバーや外部サービスへ送信されることはありません。
      </p>
    </section>

    <footer class="app-footer">
      <p>ふるさと納税 控除上限額シミュレーター &mdash; データはあなたのブラウザ内だけに保存されます。</p>
    </footer>
  `

  wireEvents()
}

function wireEvents(): void {
  const form = document.getElementById('sim-form') as HTMLFormElement | null
  const resultCard = document.getElementById('result-card') as HTMLElement | null
  const resultAmount = document.getElementById('result-amount') as HTMLElement | null
  const resultDetail = document.getElementById('result-detail') as HTMLElement | null
  const saveBtn = document.getElementById('save-btn') as HTMLButtonElement | null

  let lastInput: { annualIncome: number; familyType: FamilyType } | null = null

  form?.addEventListener('submit', (e) => {
    e.preventDefault()
    const incomeInput = document.getElementById('income') as HTMLInputElement
    const familyInput = document.getElementById('family') as HTMLSelectElement
    const annualIncome = Math.max(0, Math.round(Number(incomeInput.value) || 0))
    const familyType = familyInput.value as FamilyType

    const result = simulate({ annualIncome, familyType })
    lastInput = { annualIncome, familyType }

    if (resultCard) resultCard.hidden = false
    if (resultAmount) resultAmount.textContent = `${yen.format(result.donationLimit)} 円`
    if (resultDetail) {
      resultDetail.textContent = `所得税率(概算): ${(result.nationalTaxRate * 100).toFixed(0)}% / 住民税所得割額(概算): ${yen.format(result.localIncomeLeviedTax)}円`
    }
  })

  const refreshRecordsArea = (): void => {
    const area = document.getElementById('records-area')
    if (area) area.innerHTML = recordsTableHtml(listRecords())
  }

  saveBtn?.addEventListener('click', () => {
    if (!lastInput) return
    const result = simulate(lastInput)
    saveRecord({
      annualIncome: lastInput.annualIncome,
      familyType: lastInput.familyType,
      result,
      memo: '',
    })
    refreshRecordsArea()
  })

  document.getElementById('records-area')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (target.classList.contains('delete-record')) {
      const id = target.getAttribute('data-id')
      if (id) {
        deleteRecord(id)
        refreshRecordsArea()
      }
    }
  })

  document.getElementById('export-csv')?.addEventListener('click', () => {
    const csv = exportAsCsv(listRecords(), FAMILY_TYPE_LABELS)
    downloadTextFile(safeTimestampFilename('furusato-records', 'csv'), csv, 'text/csv;charset=utf-8')
  })

  document.getElementById('export-json')?.addEventListener('click', () => {
    const json = exportAsJson()
    downloadTextFile(safeTimestampFilename('furusato-backup', 'json'), json, 'application/json;charset=utf-8')
  })

  document.getElementById('import-json-btn')?.addEventListener('click', () => {
    document.getElementById('import-json')?.click()
  })

  document.getElementById('import-json')?.addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const imported = importFromJson(text)
      alert(`${imported}件の記録をインポートしました。`)
      refreshRecordsArea()
    } catch {
      alert('インポートに失敗しました。ファイル形式を確認してください。')
    }
    input.value = ''
  })

  document.getElementById('clear-records')?.addEventListener('click', () => {
    if (confirm('保存された記録をすべて削除します。よろしいですか？')) {
      clearAllRecords()
      refreshRecordsArea()
    }
  })
}

render()

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }))
  })
}
