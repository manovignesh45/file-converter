export type PdfDateFormat = 'DD/MM/YYYY' | 'DD-MM-YYYY' | 'YYYY-MM-DD' | 'DD MMM YYYY'

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A date-only value never passes through Date parsing, which can shift its day by timezone. */
export function parseDateOnly(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12) return null
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day >= 1 && day <= daysInMonth[month - 1] ? { year, month, day } : null
}

export function formatDateOnly(value: string, format: PdfDateFormat): string {
  const date = parseDateOnly(value)
  if (!date) throw new Error('Enter a valid date in YYYY-MM-DD format.')
  const yyyy = String(date.year).padStart(4, '0')
  const mm = String(date.month).padStart(2, '0')
  const dd = String(date.day).padStart(2, '0')
  switch (format) {
    case 'DD/MM/YYYY': return `${dd}/${mm}/${yyyy}`
    case 'DD-MM-YYYY': return `${dd}-${mm}-${yyyy}`
    case 'YYYY-MM-DD': return `${yyyy}-${mm}-${dd}`
    case 'DD MMM YYYY': return `${dd} ${monthNames[date.month - 1]} ${yyyy}`
  }
}

export function localTodayDateOnly(now = new Date()): string {
  return `${now.getFullYear().toString().padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
