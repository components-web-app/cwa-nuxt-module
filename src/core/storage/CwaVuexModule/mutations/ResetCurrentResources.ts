import Vue from 'vue'

export function ResetCurrentResources(state) {
  Vue.set(state.resources, 'new', {})
  const resetCurrentIds = (obj) => {
    // of not in? Object.values() ?
    for (const resourceName of Object.keys(obj)) {
      if (obj[resourceName].currentIds === undefined) {
        continue
      }
      Vue.set(obj[resourceName], 'currentIds', [])
    }
  }
  resetCurrentIds(state.resources.current)
}

export default ResetCurrentResources
