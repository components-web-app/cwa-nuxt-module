import { describe, expect, test } from 'vitest'
import { typeInto, typeableIn } from './type-into'

const now = () => Promise.resolve()

describe('type-for-me in /kit', () => {
  test('types one character at a time, firing input for each, after clearing what was there', async () => {
    const input = document.createElement('input')
    input.value = 'old'
    document.body.appendChild(input)
    const seen: string[] = []
    input.addEventListener('input', () => seen.push(input.value))
    expect(await typeInto(input, 'gal', { sleep: now })).toBe(true)
    expect(seen).toEqual(['', 'g', 'ga', 'gal'])
    expect(document.activeElement).toBe(input)
    input.remove()
  })

  test('stops when the field leaves the page part-way', async () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.addEventListener('input', () => input.value === 'm' && input.remove())
    expect(await typeInto(input, 'map', { sleep: now })).toBe(false)
    expect(input.value).toBe('m')
  })

  test('finds the text field in a demo, skipping hidden and file inputs', () => {
    const root = document.createElement('div')
    root.innerHTML = '<input type="hidden"><input type="file"><textarea></textarea>'
    expect(typeableIn(root)?.tagName).toBe('TEXTAREA')
    expect(typeableIn(null)).toBeUndefined()
  })
})
