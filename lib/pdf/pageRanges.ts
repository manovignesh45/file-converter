export interface PageRange {
  start: number
  end: number
}

/**
 * Parses a human page selection such as "1-3, 5, 8-" into 1-based inclusive
 * ranges. An open-ended range ("8-") runs to the last page.
 */
export function parsePageRanges(input: string, pageCount: number): PageRange[] {
  const parts = input.split(',').map(part => part.trim()).filter(Boolean)
  if (parts.length === 0) throw new Error('Enter at least one page or page range.')

  return parts.map(part => {
    const match = /^(\d+)?\s*(-)?\s*(\d+)?$/.exec(part)
    if (!match || (!match[1] && !match[3])) throw new Error(`"${part}" is not a valid page range.`)

    const start = match[1] ? Number(match[1]) : 1
    const end = match[2] ? (match[3] ? Number(match[3]) : pageCount) : start

    if (start < 1 || end < 1) throw new Error('Page numbers start at 1.')
    if (start > end) throw new Error(`"${part}" ends before it starts.`)
    if (end > pageCount) throw new Error(`This PDF has ${pageCount} page${pageCount === 1 ? '' : 's'}; "${part}" is out of range.`)
    return { start, end }
  })
}

export function rangeLabel(range: PageRange): string {
  return range.start === range.end ? `page${range.start}` : `pages${range.start}-${range.end}`
}
