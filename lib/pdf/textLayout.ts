export interface TextLayoutOptions {
  width: number
  height: number
  fontSize: number
  minFontSize: number
  singleLine: boolean
  autoFit: boolean
}

export interface TextLayoutResult { lines: string[]; fontSize: number; overflow: boolean }

function wrapParagraph(paragraph: string, size: number, width: number, measure: (text: string, size: number) => number): string[] {
  if (!paragraph) return ['']
  const words = paragraph.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (line && measure(candidate, size) > width) { lines.push(line); line = word }
    else line = candidate
  }
  lines.push(line)
  return lines
}

export function layoutText(text: string, options: TextLayoutOptions, measure: (text: string, size: number) => number): TextLayoutResult {
  const preferred = Math.max(4, options.fontSize)
  const minimum = Math.max(4, Math.min(options.minFontSize, preferred))
  const width = Math.max(1, options.width)
  const height = Math.max(1, options.height)
  const content = options.singleLine ? text.replace(/\s*\r?\n\s*/g, ' ') : text
  const calculate = (size: number): TextLayoutResult => {
    const lines = options.singleLine ? [content] : content.split(/\r?\n/).flatMap(paragraph => wrapParagraph(paragraph, size, width, measure))
    const overflow = lines.some(line => measure(line, size) > width) || lines.length * size * 1.2 > height
    return { lines, fontSize: size, overflow }
  }
  if (!options.autoFit) return calculate(preferred)
  for (let size = Math.floor(preferred); size >= minimum; size -= 1) {
    const result = calculate(size)
    if (!result.overflow) return result
  }
  return calculate(minimum)
}
