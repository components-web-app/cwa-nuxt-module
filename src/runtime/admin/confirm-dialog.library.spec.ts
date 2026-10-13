import { afterEach, describe, expect, test } from 'vitest'
import { createApp, defineComponent, h, inject, nextTick } from 'vue'
import { createConfirmDialog } from './confirm-dialog'

const Dialog = defineComponent({
  emits: ['confirm', 'cancel'],
  setup() {
    const provided = inject<string>('cwa-test-provide', 'missing')
    return () => h('p', { id: 'cwa-test-dialog' }, provided)
  },
})

describe('createConfirmDialog with the real dialog library', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('a revealed dialog renders in the body with what the app provides', async () => {
    const app = createApp({ render: () => null })
    app.provide('cwa-test-provide', 'from the app')
    app.mount(document.createElement('div'))

    const dialog = await createConfirmDialog(app, Dialog)
    dialog.reveal()
    await nextTick()

    expect(document.body.querySelector('#vuejs-confirm-dialog-root #cwa-test-dialog')?.textContent).toBe('from the app')
    app.unmount()
  })
})
