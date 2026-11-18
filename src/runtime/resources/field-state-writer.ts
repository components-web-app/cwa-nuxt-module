import { lazyImport } from '#cwa/lazy-import'

type FieldStates = typeof import('#cwa/admin/field-states')

const fieldStates = lazyImport(() => import('#cwa/admin/field-states'))
let waiting = 0

export function writeFieldStates(write: (states: FieldStates) => void) {
  const loaded = fieldStates.loaded
  if (loaded && !waiting) {
    write(loaded)
    return
  }
  waiting++
  fieldStates.load().then((states) => {
    waiting--
    write(states)
  }, () => {
    waiting--
  })
}
