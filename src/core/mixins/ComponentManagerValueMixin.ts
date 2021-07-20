import Vue from 'vue'
import { COMPONENT_MANAGER_EVENTS, SaveStateEvent } from '../events'

export default Vue.extend({
  computed: {
    componentManagerState() {
      const cmStates =
        this.$cwa.$storage.getState('CwaComponentManagerStates') || {}
      return cmStates?.[this.computedIri || this.iri] || {}
    },
    cmValue() {
      return (name) => {
        return this.componentManagerState[name] || null
      }
    }
  },
  methods: {
    saveCmValue(name: string, value: any, iri?: string) {
      this.$cwa.$eventBus.$emit(COMPONENT_MANAGER_EVENTS.saveState, {
        // @ts-ignore
        iri: iri || this.iri,
        name,
        value
      } as SaveStateEvent)
    }
  }
})
