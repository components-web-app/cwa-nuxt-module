import Vue from 'vue'
import {
  COMPONENT_MANAGER_EVENTS,
  CONFIRM_DIALOG_EVENTS,
  ConfirmDialogEvent,
  NewComponentEvent,
  HighlightComponentEvent
} from '../events'

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
    handleHighlightComponentEvent({ iri }: HighlightComponentEvent) {
      if (
        this.newComponentEvent &&
        this.newComponentIri !== iri &&
        this.newComponentResource
      ) {
        const event: ConfirmDialogEvent = {
          id: 'confirm-discard-resource',
          title: 'Confirm Discard',
          html: `<p>Are you sure you want to discard your new component?</p><p class="warning"><span class="cwa-icon"><span class="cwa-warning-triangle"></span></span><span>This action cannot be reversed!</span></p>`,
          onSuccess: () => {
            this.newComponentEvent = null
            this.$cwa.$eventBus.$emit(
              COMPONENT_MANAGER_EVENTS.newComponentCleared
            )
          },
          onCancel: () => {
            this.$nextTick(() => {
              this.$cwa.$eventBus.$emit(
                COMPONENT_MANAGER_EVENTS.selectComponent,
                this.newComponentIri
              )
            })
          },
          confirmButtonText: 'Discard'
        }
        this.$cwa.$eventBus.$emit(CONFIRM_DIALOG_EVENTS.confirm, event)
      }
    }
  }
})
