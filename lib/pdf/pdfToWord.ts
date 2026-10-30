/**
 * Turns positioned PDF text fragments into Word-style paragraphs. PDFs store
 * text as absolutely placed pieces, so lines and paragraphs are rebuilt from
 * baseline positions, gaps and font sizes.
 */

export interface TextFragment {
  text: string
  /** Left edge in PDF points. */
  x: number
  /** Baseline in PDF points, measured from the bottom of the page. */
  y: number
  width: number
  fontSize: number
  bold: boolean
  italic: boolean
}

export interface WordRun {
  text: string
  fontSize: number
  bold: boolean
  italic: boolean
}

export interface WordParagraph {
  runs: WordRun[]
  heading?: 1 | 2
  /** Left indent relative to the page's text margin, in points. */
  indent: number
  alignment: 'left' | 'center'
  /** Vertical space before the paragraph, in points. */
  spaceBefore: number
}

interface Line {
  y: number
  fontSize: number
  left: number
  right: number
  fragments: TextFragment[]
}

function groupLines(fragments: TextFragment[]): Line[] {
  const sorted = fragments
    .filter(fragment => fragment.text.trim().length > 0 && fragment.fontSize > 0)
    .sort((a, b) => b.y - a.y || a.x - b.x)

  const lines: Line[] = []
  for (const fragment of sorted) {
    const line = lines.find(candidate => Math.abs(candidate.y - fragment.y) <= Math.max(candidate.fontSize, fragment.fontSize) * 0.45)
    if (line) {
      line.fragments.push(fragment)
      line.fontSize = Math.max(line.fontSize, fragment.fontSize)
      line.left = Math.min(line.left, fragment.x)
      line.right = Math.max(line.right, fragment.x + fragment.width)
    } else {
      lines.push({ y: fragment.y, fontSize: fragment.fontSize, left: fragment.x, right: fragment.x + fragment.width, fragments: [fragment] })
    }
  }

  for (const line of lines) line.fragments.sort((a, b) => a.x - b.x)
  return lines.sort((a, b) => b.y - a.y)
}

function lineRuns(line: Line): WordRun[] {
  const runs: WordRun[] = []
  let previous: TextFragment | null = null

  for (const fragment of line.fragments) {
    let text = fragment.text
    if (previous) {
      const gap = fragment.x - (previous.x + previous.width)
      const needsSpace = gap > Math.min(previous.fontSize, fragment.fontSize) * 0.15
      if (needsSpace && !/\s$/.test(previous.text) && !/^\s/.test(text)) text = ` ${text}`
    }
    appendRun(runs, { text, fontSize: round(fragment.fontSize), bold: fragment.bold, italic: fragment.italic })
    previous = fragment
  }
  return runs
}

function appendRun(runs: WordRun[], run: WordRun) {
  const last = runs[runs.length - 1]
  if (last && last.bold === run.bold && last.italic === run.italic && last.fontSize === run.fontSize) {
    last.text += run.text
  } else {
    runs.push({ ...run })
  }
}

function round(value: number): number {
  return Math.round(value * 2) / 2
}

/** The font size carrying the most characters is treated as body text. */
export function bodyFontSize(fragments: TextFragment[]): number {
  const weights = new Map<number, number>()
  for (const fragment of fragments) {
    const size = round(fragment.fontSize)
    weights.set(size, (weights.get(size) ?? 0) + fragment.text.trim().length)
  }
  let best = 12
  let bestWeight = -1
  weights.forEach((weight, size) => {
    if (weight > bestWeight) {
      best = size
      bestWeight = weight
    }
  })
  return best
}

export function buildParagraphs(fragments: TextFragment[], pageWidth: number, bodySize = bodyFontSize(fragments)): WordParagraph[] {
  const lines = groupLines(fragments)
  if (lines.length === 0) return []

  const margin = Math.min(...lines.map(line => line.left))
  const textRight = Math.max(...lines.map(line => line.right))
  const fullWidth = textRight - margin
  const paragraphs: WordParagraph[] = []
  let current: { paragraph: WordParagraph; last: Line } | null = null

  for (const line of lines) {
    const runs = lineRuns(line)
    const indent = Math.max(0, line.left - margin)
    const leftGap = line.left
    const rightGap = pageWidth - line.right
    const centered = line.right - line.left < fullWidth * 0.8 && indent > 24 && Math.abs(leftGap - rightGap) < Math.max(18, pageWidth * 0.05)

    if (current) {
      const { last } = current
      const gap = last.y - line.y
      const sizeChanged = Math.abs(last.fontSize - line.fontSize) > 1
      const previousEndedShort = last.right < margin + fullWidth * 0.75
      const indentChanged = Math.abs((last.left - margin) - indent) > line.fontSize * 1.5
      const startsNew = gap > Math.max(last.fontSize, line.fontSize) * 1.6 ||
        sizeChanged || previousEndedShort || indentChanged || centered || current.paragraph.alignment === 'center'

      if (!startsNew) {
        const lastRun = current.paragraph.runs[current.paragraph.runs.length - 1]
        if (/[A-Za-z]-$/.test(lastRun.text)) {
          // Rejoin a word hyphenated across the line break.
          lastRun.text = lastRun.text.slice(0, -1)
        } else if (!/\s$/.test(lastRun.text)) {
          lastRun.text += ' '
        }
        for (const run of runs) appendRun(current.paragraph.runs, run)
        current.last = line
        continue
      }
    }

    const previousLine: Line | undefined = current?.last
    const paragraph: WordParagraph = {
      runs,
      indent: centered ? 0 : indent,
      alignment: centered ? 'center' : 'left',
      spaceBefore: previousLine ? Math.max(0, previousLine.y - line.y - line.fontSize * 1.2) : 0,
    }
    if (line.fontSize >= bodySize * 1.5) paragraph.heading = 1
    else if (line.fontSize >= bodySize * 1.2) paragraph.heading = 2
    paragraphs.push(paragraph)
    current = { paragraph, last: line }
  }

  for (const paragraph of paragraphs) {
    const last = paragraph.runs[paragraph.runs.length - 1]
    last.text = last.text.trimEnd()
  }
  return paragraphs
}

/** Best-effort weight and style detection from a PDF font name like "ABCDEF+Arial-BoldItalicMT". */
export function fontStyleFromName(name: string | undefined): { bold: boolean; italic: boolean } {
  const value = (name ?? '').replace(/^[A-Z]{6}\+/, '')
  return {
    bold: /bold|black|heavy|semibold|demi/i.test(value),
    italic: /italic|oblique/i.test(value),
  }
}
