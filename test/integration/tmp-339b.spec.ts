// @vitest-environment nuxt
import { describe, test, expect } from 'vitest'
import { createPinia, setActivePinia, getActivePinia } from 'pinia'
import { buildHarness } from './harness'
import { flush } from './replay-cwa-fetch'
import { ResourcesStore } from '#cwa/storage/stores/resources/resources-store'
import { FetcherStore } from '#cwa/storage/stores/fetcher/fetcher-store'
import { Resources } from '#cwa/resources/resources'
import base from '../cassettes/topic-1-nested.json'

const LAYOUT = '/_api/_/layouts/c7e086b5-af9d-471c-a561-f06d4ecbaeaa'
const PAGE = '/_api/_/pages/3d594703-c764-4624-8c12-9695d02ef206'
const TOP = '/_api/_/component_groups/49552a4f-7d20-40b4-995a-a43a194b0eb8'
const BOTTOM = '/_api/_/component_groups/7cccb80e-8386-435b-bb23-aa019e1dff89'

function group(iri: string, ref: string) {
  return {
    method: 'GET', path: iri, status: 200, headers: {},
    body: {
      '@id': iri, '@type': 'ComponentGroup', 'reference': ref, 'location': LAYOUT,
      'layouts': [LAYOUT], 'pages': [], 'components': [], 'componentPositions': [],
      '_metadata': { '@type': 'ResourceMetadata', '@id': '/_api/.well-known/genid/a' + iri.slice(-4), 'persisted': true },
    },
  }
}

function cassette() {
  const c = JSON.parse(JSON.stringify(base))
  c.entries.push(group(TOP, `top_${LAYOUT}`))
  c.entries.push(group(BOTTOM, `bottom_${LAYOUT}`))
  return c
}

describe('#339 hydration round trip', () => {
  test('groups resolve by reference after a payload round trip', async () => {
    const h = buildHarness(cassette() as never)
    await h.fetcher.fetchRoute(h.route('/'))
    await flush()

    const pinia = getActivePinia()!
    const payload = JSON.parse(JSON.stringify(pinia.state.value))
    console.log('payload store keys:', Object.keys(payload))
    console.log('resources keys:', Object.keys(payload['cwa.resources'] || {}))
    const groupsInPayload = Object.entries(payload['cwa.resources']?.current?.byId || {})
      .filter(([iri]) => iri.includes('component_groups'))
      .map(([iri, r]: any) => `${iri} ref=${r?.data?.reference} status=${r?.apiState?.status}`)
    console.log('groups in payload:\n' + groupsInPayload.join('\n'))

    // simulate the client: fresh pinia primed from the payload
    const clientPinia = createPinia()
    clientPinia.state.value = payload
    setActivePinia(clientPinia)
    const rs = new ResourcesStore('cwa')
    const fs = new FetcherStore('cwa')
    const clientResources = new Resources(rs, fs)

    console.log('client top:', clientResources.getComponentGroupByReference(`top_${LAYOUT}`)?.data?.['@id'])
    console.log('client page group:', clientResources.getComponentGroupByReference(`primary_${PAGE}`)?.data?.['@id'])
    expect(clientResources.getComponentGroupByReference(`top_${LAYOUT}`)).toBeTruthy()
    expect(clientResources.getComponentGroupByReference(`primary_${PAGE}`)).toBeTruthy()
  })
})
