// @vitest-environment node

import { describe, test, expect } from 'vitest'
import { generateComponentTemplate, generateApiCommand, generateFilePath } from './templates'

describe('generateComponentTemplate', () => {
  test('basic includes useCwaComponent and no plugins', () => {
    const result = generateComponentTemplate('basic')
    expect(result).toContain('useCwaComponent(props)')
    expect(result).toContain('defineProps<IriProp>')
    expect(result).toContain('defineExpose(exposeMeta)')
    expect(result).not.toContain('withImage')
    expect(result).not.toContain('withCollection')
  })

  test('image includes withImage and its return values', () => {
    const result = generateComponentTemplate('image')
    expect(result).toContain('withImage()')
    expect(result).toContain('contentUrl')
    expect(result).toContain('displayMedia')
    expect(result).toContain('handleLoad')
    expect(result).toContain('loaded')
  })

  test('collection includes withCollection and its return values', () => {
    const result = generateComponentTemplate('collection')
    expect(result).toContain('withCollection()')
    expect(result).toContain('collectionItems')
    expect(result).toContain('pageModel')
    expect(result).toContain('totalPages')
  })
})

describe('generateFilePath', () => {
  test('returns correct path for component name', () => {
    expect(generateFilePath('BlogPost')).toBe('app/cwa/components/BlogPost/BlogPost.vue')
  })
})

describe('generateApiCommand', () => {
  test('bare command with no flags', () => {
    expect(generateApiCommand('Title', {})).toBe('php bin/console make:api-component Title')
  })

  test('adds --timestamped when set', () => {
    expect(generateApiCommand('Post', { timestamped: true })).toContain('--timestamped')
  })

  test('adds --publishable when set', () => {
    expect(generateApiCommand('Post', { publishable: true })).toContain('--publishable')
  })

  test('adds --uploadable when set', () => {
    expect(generateApiCommand('Photo', { uploadable: true })).toContain('--uploadable')
  })

  test('combines multiple flags', () => {
    const result = generateApiCommand('Article', { timestamped: true, publishable: true })
    expect(result).toContain('Article')
    expect(result).toContain('--timestamped')
    expect(result).toContain('--publishable')
    expect(result).not.toContain('--uploadable')
  })
})
