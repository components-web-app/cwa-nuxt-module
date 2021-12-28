import _CWA from './core/cwa'

export type CWA = _CWA

export type AdminDialogOptions = {
  name: string
  component: () => Promise<Function>
}

export type CwaOptions = {
  vuex: {
    namespace: string
  }
  pagesDepth: number
  fetchConcurrency: number
  allowUnauthorizedTls: boolean
  layouts?: { [key: string]: string }
  websiteName: string
  package: {
    name: string
    version: string
  }
}
