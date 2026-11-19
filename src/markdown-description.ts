const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ', ['#39']: '\'' }

const CODE_SPAN = /`([^`\n]+)`/g
const BACKSLASH_ESCAPE = /\\([\\`*_[\]()#!|-])/g
const LINK = /\[([^[\]\n]+)\]\(([^()\s]+)\)/g
const SCHEME = /^([a-z][a-z\d+.-]*):/i
const SAFE_SCHEMES = ['http', 'https', 'mailto']
const TOKEN = /\0(\d+)\0/g

export interface MarkdownDescription {
  html: string
  text: string
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, char => ESCAPES[char]!)
}

function decodeHtml(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (_, entity: string) => ENTITIES[entity]!)
}

function emphasis(escaped: string): string {
  return escaped
    .replace(/\*\*(?=[^*\s<])([^*<]*[^*\s<])\*\*/g, '<strong>$1</strong>')
    .replace(/\*(?=[^*\s<])([^*<]*[^*\s<])\*/g, '<em>$1</em>')
    .replace(/(?<![\p{L}\p{N}_])_(?=[^_\s<])([^_<]*[^_\s<])_(?![\p{L}\p{N}_])/gu, '<em>$1</em>')
}

function linkAttributes(url: string): string | undefined {
  const raw = decodeHtml(url)
  if (raw.includes('\\') || [...raw].some(char => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7F)) {
    return
  }
  const scheme = SCHEME.exec(raw)?.[1]?.toLowerCase()
  if (scheme && !SAFE_SCHEMES.includes(scheme)) {
    return
  }
  const external = scheme === 'http' || scheme === 'https' || raw.startsWith('//')
  return `href="${url}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}`
}

function inline(source: string): string {
  const tokens: string[] = []
  const store = (html: string) => `\0${tokens.push(html) - 1}\0`

  const escaped = escapeHtml(source
    .replace(CODE_SPAN, (_, code: string) => store(`<code>${escapeHtml(code)}</code>`))
    .replace(BACKSLASH_ESCAPE, (_, char: string) => store(escapeHtml(char))))

  const linked = escaped.replace(LINK, (_, label: string, url: string) => {
    const attributes = linkAttributes(url)
    return store(attributes ? `<a ${attributes}>${emphasis(label)}</a>` : emphasis(label))
  })

  let html = emphasis(linked)
  while (html.includes('\0')) {
    html = html.replace(TOKEN, (_, index: string) => tokens[Number(index)]!)
  }
  return html
}

export function markdownDescription(source: string): MarkdownDescription {
  const paragraphs = source
    .replace(/\0/g, '')
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    .map(paragraph => paragraph.split('\n').map(line => line.trim()).filter(Boolean).join('\n'))
    .filter(Boolean)
    .map(paragraph => inline(paragraph).replace(/\n/g, '<br>'))

  return {
    html: paragraphs.map(paragraph => `<p>${paragraph}</p>`).join(''),
    text: decodeHtml(paragraphs.join(' ').replace(/<br>/g, ' ').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim(),
  }
}

export function hasMarkup(source: string): boolean {
  return /<[a-z/!][^>]*>/i.test(source.replace(CODE_SPAN, ''))
}

export function withoutMarkup(source: string): string {
  return decodeHtml(source
    .replace(/<\/p\s*>\s*<p\b[^>]*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ''))
}
