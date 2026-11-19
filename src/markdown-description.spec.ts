import { describe, expect, test } from 'vitest'
import { hasMarkup, markdownDescription, withoutMarkup } from './markdown-description'

const html = (source: string) => markdownDescription(source).html
const text = (source: string) => markdownDescription(source).text

describe('a component description in Markdown', () => {
  test('plain text is one paragraph, as it was written', () => {
    expect(markdownDescription('A picture uploaded to the site')).toEqual({
      html: '<p>A picture uploaded to the site</p>',
      text: 'A picture uploaded to the site',
    })
  })

  test('bold, italic and code are inline elements', () => {
    expect(html('**Bold**, *italic*, _also italic_ and `code`')).toBe('<p><strong>Bold</strong>, <em>italic</em>, <em>also italic</em> and <code>code</code></p>')
  })

  test('the plain text drops the Markdown syntax', () => {
    expect(text('**Bold**, *italic*, _also italic_, `code` and [a link](https://example.com)')).toBe('Bold, italic, also italic, code and a link')
  })

  test('a blank line starts a paragraph and a single line break is kept', () => {
    expect(markdownDescription('First line\r\nsecond line\n\n  \nNext paragraph\n')).toEqual({
      html: '<p>First line<br>second line</p><p>Next paragraph</p>',
      text: 'First line second line Next paragraph',
    })
  })

  test('an underscore inside a word and a lone asterisk stay as they are', () => {
    expect(html('snake_case_name, my_var_ and 2 * 3 * 4')).toBe('<p>snake_case_name, my_var_ and 2 * 3 * 4</p>')
  })

  test('a backslash keeps a Markdown character literal', () => {
    expect(html('\\*not italic\\* and \\[not a link\\](/x)')).toBe('<p>*not italic* and [not a link](/x)</p>')
  })

  test('Markdown inside code is literal', () => {
    expect(html('`**not bold** [x](/y)`')).toBe('<p><code>**not bold** [x](/y)</code></p>')
  })

  test('emphasis can wrap a link and a link text can be emphasised', () => {
    expect(html('**see [the docs](/docs)** or [*this*](#top)')).toBe('<p><strong>see <a href="/docs">the docs</a></strong> or <a href="#top"><em>this</em></a></p>')
  })

  test('headings, lists, images and tables are not Markdown here', () => {
    expect(html('# Title\n- item\n![alt](/a.png)\n| a | b |')).toBe('<p># Title<br>- item<br>!<a href="/a.png">alt</a><br>| a | b |</p>')
  })

  test('an empty description has nothing to show', () => {
    expect(markdownDescription('  \n\n ')).toEqual({ html: '', text: '' })
  })
})

describe('links in a description', () => {
  test.each([
    ['https://example.com/a?b=1&c=2', '<a href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">x</a>'],
    ['HTTP://example.com', '<a href="HTTP://example.com" target="_blank" rel="noopener noreferrer">x</a>'],
    ['//cdn.example.com/a', '<a href="//cdn.example.com/a" target="_blank" rel="noopener noreferrer">x</a>'],
    ['mailto:team@example.com', '<a href="mailto:team@example.com">x</a>'],
    ['/docs/components', '<a href="/docs/components">x</a>'],
    ['../guide', '<a href="../guide">x</a>'],
    ['guide/images', '<a href="guide/images">x</a>'],
    ['#styles', '<a href="#styles">x</a>'],
    ['?tab=ui', '<a href="?tab=ui">x</a>'],
  ])('%s is a link', (url, link) => {
    expect(html(`[x](${url})`)).toBe(`<p>${link}</p>`)
  })

  test.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert`1`',
    'vbscript:msgbox',
    'data:text/html;base64,PHNjcmlwdD4=',
    'file:///etc/passwd',
    'java\u0000script:alert',
    'java\u0001script:alert',
    '/\\evil.example.com',
  ])('%s is rendered as its text, never a link', (url) => {
    expect(html(`[click me](${url})`)).not.toContain('<a')
    expect(html(`[click me](${url})`)).toContain('click me')
  })

  test('a URL broken by a parenthesis or a space is not a link at all', () => {
    expect(html('[x](javascript:alert(1))')).toBe('<p>[x](javascript:alert(1))</p>')
    expect(html('[x]( javascript:alert)')).toBe('<p>[x]( javascript:alert)</p>')
  })

  test('an encoded scheme stays a literal relative URL', () => {
    expect(html('[x](javascript&#58;alert)')).toBe('<p><a href="javascript&amp;#58;alert">x</a></p>')
  })
})

describe('hostile descriptions', () => {
  test('HTML is escaped, never passed through', () => {
    expect(html('<script>alert(1)</script> <img src=x onerror="alert(1)"> & \'quotes\'')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt; &lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;quotes&#39;</p>')
  })

  test('a quote in a URL cannot leave the href attribute', () => {
    expect(html('[x](/a"onmouseover="alert(1))')).not.toMatch(/<a [^>]*onmouseover/)
    expect(html('[x](/a"onmouseover="alert)')).toBe('<p><a href="/a&quot;onmouseover=&quot;alert">x</a></p>')
  })

  test('HTML in a link text or code is escaped', () => {
    expect(html('[<img src=x onerror=alert(1)>](/x) `<b>`')).toBe('<p><a href="/x">&lt;img src=x onerror=alert(1)&gt;</a> <code>&lt;b&gt;</code></p>')
  })

  test('emphasis in a URL never reaches the href', () => {
    expect(html('[x](/a*b*c/_d_)')).toBe('<p><a href="/a*b*c/_d_">x</a></p>')
  })

  test('a placeholder-like character in the source cannot inject a stored element', () => {
    expect(html('\u00000\u0000 `a`')).toBe('<p>0 <code>a</code></p>')
  })

  test('every tag in the HTML is one the subset writes', () => {
    const output = html('**a** *b* `c` [d](https://e.example) [f](/g)\nh\n\n<i>i</i> <a href="j">k</a>')
    expect([...output.matchAll(/<\/?([a-z]+)/g)].map(match => match[1]).every(tag => ['p', 'br', 'strong', 'em', 'code', 'a'].includes(tag!))).toBe(true)
    expect(output).not.toContain('<i>')
    expect(output).not.toContain('href="j"')
  })
})

describe('markup outside the Markdown subset', () => {
  test('a tag is markup, a comparison or a tag inside code is not', () => {
    expect(hasMarkup('<p>Hello</p>')).toBe(true)
    expect(hasMarkup('5 < 6 and 7 > 3')).toBe(false)
    expect(hasMarkup('Use `<h2>` for sections')).toBe(false)
  })
  test('removing the markup keeps its paragraphs and line breaks and decodes its entities', () => {
    expect(withoutMarkup('<p>Use this &amp; <b>that</b></p><p class="x">Two<br/>lines</p>')).toBe('Use this & that\n\nTwo\nlines')
  })
})
