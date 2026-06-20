import type { Ref } from 'vue'
import debounce from 'lodash-es/debounce'
import { useCwaFormInput } from '#cwa/composables/cwa-form-input'

export const useCwaFormRepeated = (iri: Ref<string | undefined>, fullName: string) => {
  const firstFullName = `${fullName}[first]`
  const secondFullName = `${fullName}[second]`

  const first = useCwaFormInput(iri, firstFullName)
  const second = useCwaFormInput(iri, secondFullName)

  const firstOnInput = debounce(() => {
    first.validate({ [secondFullName]: second.value.value || '__FAKE__' })
  }, 300)

  const secondOnInput = debounce(() => {
    second.validate({ [firstFullName]: first.value.value || '__FAKE__' })
  }, 300)

  const firstOnBlur = () => {
    first.onBlur()
    first.validate({ [secondFullName]: second.value.value || '__FAKE__' })
  }

  const secondOnBlur = () => {
    second.onBlur()
    second.validate({ [firstFullName]: first.value.value || '__FAKE__' })
  }

  return {
    first: { ...first, onInput: firstOnInput, onBlur: firstOnBlur },
    second: { ...second, onInput: secondOnInput, onBlur: secondOnBlur },
  }
}
