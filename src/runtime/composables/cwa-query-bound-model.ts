import { useRouter, useRoute, type LocationQueryValue } from 'vue-router'
import { computed, ref, watch } from 'vue'
import { debounce } from 'lodash-es'

type ModelOps = {
  defaultValue?: any
  delay?: number
}

export const useQueryBoundModel = (queryParam: string|string[], ops?: ModelOps) => {
  const route = useRoute()
  const router = useRouter()
  let debounced: any

  const exp = new RegExp(`^${queryParam}\\[([a-zA-Z0-9]+)]$`, 'i')
  const matchingQueryParams = computed(() => {
    if (Array.isArray(queryParam)) {
      const foundParams: string[] = []
      for (const p of queryParam) {
        route.query[p] && foundParams.push(p)
      }
      return foundParams
    }
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
    const normalizeValueAsArray = (valueIsArray: boolean, value: LocationQueryValue|LocationQueryValue[]) => {
      if (Array.isArray(value)) {
        return value
      }
      if (valueIsArray) {
        return [value]
      }
      return value
    }
    if (Array.isArray(queryParam)) {
      for (const p of queryParam) {
        const valueIsArray = p.endsWith('[]')
        if (route.query[p]) {
          return normalizeValueAsArray(valueIsArray, route.query[p])
        }
      }
    } else if (route.query[queryParam]) {
      const valueIsArray = queryParam.endsWith('[]')
      return normalizeValueAsArray(valueIsArray, route.query[queryParam])
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

  const model = ref(matchedQueryParamValue.value !== null ? matchedQueryParamValue.value : ops?.defaultValue)

  watch(matchedQueryParamValue, (newValue) => {
    // if the query param value(s) changes, update the model
    model.value = newValue
  })

  watch(model, async (newValue) => {
    // update the query params on model change

    if (debounced) {
      debounced.cancel()
    }

    const filteredKeys = Object.keys(route.query).filter(key => !matchingQueryParams.value.includes(key))
    const newQuery: { [key: string]: LocationQueryValue|LocationQueryValue[] } = {}
    for (const retainedKey of filteredKeys) {
      newQuery[retainedKey] = route.query[retainedKey]
    }

    const isObj = Object.prototype.toString.call(newValue) === '[object Object]'
    if (isObj) {
      for (const newValueKey of Object.keys(newValue)) {
        if (!newValue[newValueKey]) {
          continue
        }
        if (Array.isArray(queryParam)) {
          for (const p of queryParam) {
            newQuery[`${p}[${newValueKey}]`] = newValue[newValueKey]
          }
        } else {
          newQuery[`${queryParam}[${newValueKey}]`] = newValue[newValueKey]
        }
      }
    } else if (newValue) {
      if (Array.isArray(queryParam)) {
        for (const p of queryParam) {
          newQuery[p] = newValue
        }
      } else {
        newQuery[queryParam] = newValue
      }
    }

    debounced = debounce(async () => {
      await router.replace({ query: newQuery })
    }, ops?.delay || 10)
    await debounced()
  })

  return {
    model
  }
}
