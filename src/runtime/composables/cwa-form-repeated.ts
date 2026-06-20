import type { Ref } from 'vue'
import { ref } from 'vue'
import debounce from 'lodash-es/debounce'
import { useCwaFormInput } from '#cwa/composables/cwa-form-input'

export const useCwaFormRepeated = (iri: Ref<string | undefined>, fullName: string) => {
  const firstFullName = `${fullName}[first]`
  const secondFullName = `${fullName}[second]`

  const bothBlurred = ref(false)
  let firstHasBlurred = false
  let secondHasBlurred = false

  const first = useCwaFormInput(iri, firstFullName, { blurTrigger: bothBlurred })
  const second = useCwaFormInput(iri, secondFullName, { blurTrigger: bothBlurred })

  const firstOnInput = debounce(() => {
    first.validate({ [secondFullName]: second.value.value || '__FAKE__' })
  }, 300)

  const secondOnInput = debounce(() => {
    second.validate({ [firstFullName]: first.value.value || '__FAKE__' })
  }, 300)

  const firstOnBlur = () => {
    firstHasBlurred = true
    if (secondHasBlurred) bothBlurred.value = true
    first.validate({ [secondFullName]: second.value.value || '__FAKE__' })
  }

  const secondOnBlur = () => {
    secondHasBlurred = true
    if (firstHasBlurred) bothBlurred.value = true
    second.validate({ [firstFullName]: first.value.value || '__FAKE__' })
  }

  return {
    first: { ...first, onInput: firstOnInput, onBlur: firstOnBlur },
    second: { ...second, onInput: secondOnInput, onBlur: secondOnBlur },
  }
}
