import { describe, expect, test } from 'vitest'
import { fakeDialogForm } from './fake-dialog-form'

describe('the /kit fake dialog form', () => {
  test('several field errors on the next Save mark each field and keep the changes unsaved', async () => {
    const form = fakeDialogForm({ reference: 'Shaker', title: 'Shaker | Hand-built' })
    form.model<string>('reference').model.value = 'Taken'
    form.model<string>('title').model.value = ''
    form.failNext({ reference: 'Already used.', title: 'Needed.' })
    await form.save()
    expect(form.fieldErrors).toEqual({ reference: 'Already used.', title: 'Needed.' })
    expect(form.unsavedFields).toEqual(['reference', 'title'])
    expect(form.failures).toBe(1)
  })

  test('a server error or going offline fails the whole Save with a form error, cleared by the next Save', async () => {
    const form = fakeDialogForm({ reference: 'Shaker' })
    form.model<string>('reference').model.value = 'New'
    form.failNext({}, 'The server could not save this page.')
    await form.save()
    expect(form.formError).toBe('The server could not save this page.')
    await form.save()
    expect(form.formError).toBeUndefined()
    expect(form.saves).toEqual([{ reference: 'New' }])
  })

  test('a slow Save stays saving until its wait settles', async () => {
    let finish!: () => void
    const form = fakeDialogForm({ reference: 'Shaker' }, {}, () => new Promise<void>((resolve) => {
      finish = resolve
    }))
    const saving = form.save()
    expect(form.saving).toBe(true)
    finish()
    await saving
    expect(form.saving).toBe(false)
  })

  test('discard puts every field back and clears errors', async () => {
    const form = fakeDialogForm({ reference: 'Shaker' })
    form.model<string>('reference').model.value = 'Changed'
    form.failNext({ reference: 'No.' }, 'Not saved.')
    await form.save()
    form.discard()
    expect(form.local.reference).toBe('Shaker')
    expect(form.fieldErrors).toEqual({})
    expect(form.formError).toBeUndefined()
  })
})
