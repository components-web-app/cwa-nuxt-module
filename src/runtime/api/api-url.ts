export const UNSET_API_URL = 'https://api-url-not-set.invalid'

export type ApiUrlSource = 'private' | 'public' | 'browser' | 'unset'

export interface ApiUrlRuntimeConfig {
  public: { cwa?: { apiUrl?: string, apiUrlBrowser?: string } }
  cwa?: { apiUrl?: string }
}

export interface ResolvedApiUrl {
  url: string
  source: ApiUrlSource
}

export function resolveApiUrl(runtimeConfig: ApiUrlRuntimeConfig, isServer: boolean): ResolvedApiUrl {
  const publicApiUrl = runtimeConfig.public.cwa?.apiUrl
  const publicApiUrlBrowser = runtimeConfig.public.cwa?.apiUrlBrowser

  if (isServer) {
    const privateApiUrl = runtimeConfig.cwa?.apiUrl
    if (privateApiUrl) {
      return { url: privateApiUrl, source: 'private' }
    }
    if (publicApiUrl) {
      return { url: publicApiUrl, source: 'public' }
    }
    if (publicApiUrlBrowser) {
      return { url: publicApiUrlBrowser, source: 'browser' }
    }
    return { url: UNSET_API_URL, source: 'unset' }
  }

  if (publicApiUrlBrowser) {
    return { url: publicApiUrlBrowser, source: 'browser' }
  }
  if (publicApiUrl) {
    return { url: publicApiUrl, source: 'public' }
  }
  return { url: UNSET_API_URL, source: 'unset' }
}
