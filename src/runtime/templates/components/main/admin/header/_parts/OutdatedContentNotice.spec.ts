// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import OutdatedContentNotice from './OutdatedContentNotice.vue'
import { axe } from '../../../../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../../../../test/utils/focus-ring'
import * as cwaComposable from '#cwa/composables/cwa'

enableAutoUnmount(afterEach)

function mountNotice(hasNewResources: boolean) {
  const mergeNewResources = vi.fn()
  // @ts-expect-error partial Cwa
  vi.spyOn(cwaComposable, 'useCwa').mockReturnValue({ resources: { hasNewResources }, resourcesManager: { mergeNewResources } })
  const wrapper = mount(OutdatedContentNotice, { attachTo: document.body })
  return { wrapper, mergeNewResources }
}

describe('OutdatedContentNotice', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('shows nothing while the content is current', () => {
    const { wrapper } = mountNotice(false)
    expect(wrapper.find('[data-testid="outdated-content-notice"]').exists()).toBe(false)
  })

  test('says the content is outdated, with a kit Update button that merges the new resources', async () => {
    const { wrapper, mergeNewResources } = mountNotice(true)
    const notice = wrapper.get('[data-testid="outdated-content-notice"]')
    expect(notice.attributes('role')).toBe('status')
    expect(notice.text()).toContain('The content on this page is outdated')
    const update = notice.get('button')
    expect(update.text()).toBe('Update')
    expect(drawsFocusRing([...update.element.classList])).toBe(true)
    await update.trigger('click')
    expect(mergeNewResources).toHaveBeenCalledTimes(1)
  })

  test('has no axe violations', async () => {
    mountNotice(true)
    expect(await axe(document.body)).toHaveNoViolations()
  })
})
