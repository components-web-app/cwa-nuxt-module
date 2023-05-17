// @vitest-environment nuxt
import { describe, expect, test } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import Spinner from './Spinner'

describe('Spinner', () => {
  describe('snapshots', () => {
    test('should match snapshot', () => {
      expect(shallowMount(Spinner, { props: { show: true } }).element).toMatchSnapshot()
    })
  })
})
