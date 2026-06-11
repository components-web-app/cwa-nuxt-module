// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { useCwaSelect } from '#cwa/composables/cwa-select'

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...mod,
    // let watches run synchronously with immediate: false (default)
  }
})

describe('useCwaSelect', () => {
  test('selectModel initialises to model.value', () => {
    const model = ref('initial')
    const { model: selectModel } = useCwaSelect(model, [])
    expect(selectModel.value).toBe('initial')
  })

  test('options initialises to the provided array', () => {
    const model = ref('a')
    const opts = [{ label: 'A', value: 'a' }]
    const { options } = useCwaSelect(model, opts)
    expect(options.value).toEqual(opts)
  })

  test('options defaults to empty array', () => {
    const model = ref('x')
    const { options } = useCwaSelect(model)
    expect(options.value).toEqual([])
  })

  test('when options change, selectModel updates to matching option value', async () => {
    const model = ref('b')
    const { model: selectModel, options } = useCwaSelect(model, [])
    options.value = [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
    ]
    await nextTick()
    expect(selectModel.value).toBe('b')
  })

  test('when options change with no match, selectModel becomes undefined', async () => {
    const model = ref('z')
    const { model: selectModel, options } = useCwaSelect(model, [])
    options.value = [{ label: 'A', value: 'a' }]
    await nextTick()
    expect(selectModel.value).toBeUndefined()
  })

  test('when selectModel changes, upstream model is updated', async () => {
    const model = ref('a')
    const { model: selectModel } = useCwaSelect(model, [])
    selectModel.value = 'b'
    await nextTick()
    expect(model.value).toBe('b')
  })

  test('when selectModel equals model, upstream model is not changed', async () => {
    const model = ref('a')
    const { model: selectModel } = useCwaSelect(model, [])
    // already equal, changing selectModel to same value should not trigger update
    selectModel.value = 'a'
    await nextTick()
    expect(model.value).toBe('a')
  })

  test('when upstream model changes, selectModel is synced', async () => {
    const model = ref('a')
    const { model: selectModel } = useCwaSelect(model, [])
    model.value = 'new-value'
    await nextTick()
    expect(selectModel.value).toBe('new-value')
  })
})
