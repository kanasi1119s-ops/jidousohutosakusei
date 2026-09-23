export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** ファイル名は英数字・ハイフンのみに正規化する(ZIP展開時の文字化け防止) */
export function safeTimestampFilename(prefix: string, ext: string): string {
  const now = new Date()
  const stamp = now.toISOString().slice(0, 10)
  return `${prefix}-${stamp}.${ext}`
}
