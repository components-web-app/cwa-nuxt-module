import { pageDataTypes } from './page-data-types'
import type Cwa from '#cwa/cwa'

const answers = new WeakMap<Cwa, Promise<boolean>>()

export function hasPageDataTypes($cwa: Cwa): Promise<boolean> {
  let answer = answers.get($cwa)
  if (!answer) {
    answer = $cwa.getApiDocumentation().then(docs => pageDataTypes(docs).length > 0, () => {
      answers.delete($cwa)
      return false
    })
    answers.set($cwa, answer)
  }
  return answer
}
