import { useRouter, useRoute, LocationQueryValue } from 'vue-router'
import { computed, ref, watch } from 'vue'

export const useQueryBoundModel = (queryParam: string, defaultValue?: any) => {
  const route = useRoute()
  const router = useRouter()

  const exp = new RegExp(`^${queryParam}\\[([a-zA-Z0-9]+)]$`, 'i')
  const matchingQueryParams = computed(() => {
    if (route.query[queryParam]) {
      return [queryParam]
    }
    const allQueryParams = Object.keys(route.query)
    return allQueryParams.filter(param => exp.test(param))
  })

  const matchedQueryParamValue = computed(() => {
    const matchingParams = matchingQueryParams.value
    if (!matchingParams || !matchingParams.length) {
      return null
    }
    if (route.query[queryParam]) {
      return route.query[queryParam]
    }
    const matches = matchingParams[0].match(exp)
    if (!matches || matches.length < 2) {
      return null
    }
    const matchingObjectKey = matches[1]
    if (matchingParams.length && matchingObjectKey) {
      return { [matchingObjectKey]: route.query[matchingParams[0]] }
    }
    return null
  })

  const model = ref(matchedQueryParamValue.value !== null ? matchedQueryParamValue.value : defaultValue)

  watch(matchedQueryParamValue, (newValue) => {
    model.value = newValue
  })
  watch(model, async (newValue) => {
    const filteredKeys = Object.keys(route.query).filter(key => !matchingQueryParams.value.includes(key))
    const newQuery: { [key: string]: LocationQueryValue|LocationQueryValue[] } = {}
    for (const retainedKey of filteredKeys) {
      newQuery[retainedKey] = route.query[retainedKey]
    }

    const isObj = Object.prototype.toString.call(newValue) === '[object Object]'
    if (isObj) {
      for (const newValueKey of Object.keys(newValue)) {
        newQuery[`${queryParam}[${newValueKey}]`] = newValue[newValueKey]
      }
    } else {
      newQuery[queryParam] = newValue
    }

    await router.replace({ query: newQuery })
  })

  return {
    model
  }
}
