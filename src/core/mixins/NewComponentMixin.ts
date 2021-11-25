import Vue from 'vue'
import { COMPONENT_MANAGER_EVENTS, NewComponentEvent } from '../events'

export default Vue.extend({
  data() {
    return {
      newComponentIri: null,
      newComponentEvent: null
    } as {
      newComponentIri: string
      newComponentEvent: NewComponentEvent
    }
  },
  computed: {
    newComponentResource() {
      if (!this.newComponentIri) {
        return null
      }
      return this.$cwa.getResource(this.newComponentIri)
    },
    newComponentName() {
      const componentName =
        this.newComponentResource?.uiComponent ||
        this.newComponentResource?.['@type']
      if (!componentName) {
        return null
      }
      return `CwaComponents${componentName}`
    }
  },
  watch: {
    newComponentEvent(event: NewComponentEvent) {
      if (!event) {
        this.newComponentIri = null
        // should we remove the data or keep it in case we want to continue adding??
        // if we keep then the below 'setResource' call will need to be enhanced so as to not override
        return
      }

      this.createNewComponent(event)
    }
  },
  mounted() {
    this.$cwa.$eventBus.$on(
      COMPONENT_MANAGER_EVENTS.highlightComponent,
      this.handleHighlightComponentEvent
    )
  },
  beforeDestroy() {
    this.$cwa.$eventBus.$off(
      COMPONENT_MANAGER_EVENTS.highlightComponent,
      this.handleHighlightComponentEvent
    )
  },
  methods: {
    handleInitialData(dataObject: Object) {
      const resource = { ...this.newComponentResource, ...dataObject }
      this.$cwa.$storage.setResource({
        resource
      })
    },
    createNewComponent({ iri, name, isPublishable }: NewComponentEvent) {
      this.newComponentIri = iri
      const resource = {
        '@id': iri,
        '@type': name,
        _metadata: {
          _isNew: true
        }
      } as {
        '@id': string
        '@type': string
        _metadata?: {
          _isNew: boolean
          published?: boolean
        }
      }
      if (isPublishable) {
        resource._metadata.published = false
      }
      this.$cwa.$storage.setResource({
        resource
      })
    },
    handleHighlightComponentEvent({
      iri,
      force
    }: {
      iri?: string
      force?: boolean
    }) {
      if (
        this.newComponentEvent &&
        this.newComponentIri !== iri &&
        this.newComponentResource
      ) {
        if (
          !force &&
          window.confirm('Are you sure you want to discard your new component?')
        ) {
          this.newComponentEvent = null
          this.$cwa.$eventBus.$emit(
            COMPONENT_MANAGER_EVENTS.newComponentCleared
          )
        } else {
          this.$cwa.$eventBus.$emit(
            COMPONENT_MANAGER_EVENTS.selectComponent,
            this.newComponentIri
          )
        }
      }
    }
  }
})
