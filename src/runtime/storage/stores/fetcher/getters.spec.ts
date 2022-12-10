import { describe, test, expect } from 'vitest'
import { reactive } from 'vue'
import getters from './getters'
import { CwaFetcherStateInterface } from './state'

function createState (): CwaFetcherStateInterface {
  return {
    status: reactive({}),
    manifests: reactive({})
  }
}

describe('Fetcher getter inProgress', () => {
  const state = createState()
  const getterFns = getters(state)

  test('returns false if fetch not set', () => {
    expect(getterFns.inProgress.value).toBeFalsy()
  })

  test('returns true if there is a fetch path but no result', () => {
    state.status.fetch = { path: 'my-path', token: 'my-token' }
    expect(getterFns.inProgress.value).toBeTruthy()
  })

  test('returns false is we have a success result as true', () => {
    state.status.fetch = { path: 'my-path', token: 'my-token', success: true }
    expect(getterFns.inProgress.value).toBeFalsy()
  })

  test('returns false is we have a success result as false', () => {
    state.status.fetch = { path: 'my-path', token: 'my-token', success: false }
    expect(getterFns.inProgress.value).toBeFalsy()
  })
})

describe('Fetcher getter manifestInProgress', () => {
  const state = createState()
  const getterFns = getters(state)

  test('returns false if manifest does not exist', () => {
    expect(getterFns.manifestInProgress.value('manifest-path')).toBeFalsy()
  })
  test('returns false if manifest is not in progress', () => {
    state.manifests['manifest-path'] = {
      inProgress: false
    }
    expect(getterFns.manifestInProgress.value('manifest-path')).toBeFalsy()
  })
  test('returns true if manifest is not in progress', () => {
    state.manifests['manifest-path'] = {
      inProgress: true
    }
    expect(getterFns.manifestInProgress.value('manifest-path')).toBeTruthy()
  })
})

describe('Fetcher getter manifestsInProgress', () => {
  const state = createState()
  const getterFns = getters(state)

  test('returns false if manifest is not in progress', () => {
    state.manifests['manifest-path'] = {
      inProgress: false
    }
    expect(getterFns.manifestsInProgress.value).toBeFalsy()
  })
  test('returns true if manifest is not in progress', () => {
    state.manifests['manifest-path'] = {
      inProgress: true
    }
    expect(getterFns.manifestsInProgress.value).toBeTruthy()
  })
})
