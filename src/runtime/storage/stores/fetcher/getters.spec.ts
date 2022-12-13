import { describe } from 'vitest'
import { reactive } from 'vue'
import { CwaFetcherStateInterface } from './state'

function createState (): CwaFetcherStateInterface {
  return {
    primaryFetch: reactive({}),
    fetches: reactive({})
  }
}

describe.todo('Fetcher actions tests')
