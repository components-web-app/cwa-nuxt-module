import Vue from 'vue'
import consola from 'consola'
import {
  COMPONENT_MANAGER_EVENTS,
  CONFIRM_DIALOG_EVENTS,
  ConfirmDialogEvent
} from '../events'

export default Vue.extend({
  computed: {
    isCloneComponent() {
      return this.cloneComponent && this.cloneComponent.iri === this.iri
    },
    cloneFromPath() {
      return this.$cwa.$state.clone.fromPath
    },
    cloneComponent: {
      get(): string {
        return this.$cwa.$state.clone.component
      },
      set(value: string) {
        this.$cwa.$storage.setCloneFromPath(this.$route.path)
        this.$cwa.$storage.setCloneComponent(value)
      }
    },
    cloneDestination: {
      get(): string {
        return this.$cwa.$state.clone.destination
      },
      set(value: string) {
        this.$cwa.$storage.setCloneDestination(value)
      }
    },
    cloneNavigate: {
      get(): boolean {
        return this.$cwa.$state.clone.navigate
      },
      set(value: boolean) {
        this.$cwa.$storage.setCloneNavigate(value)
      }
    },
    cloneDestinationIsCollection() {
      if (!this.cloneDestinationResource) {
        return null
      }
      const destination = this.cloneDestinationResource
      return destination['@type'] === 'ComponentCollection'
    },
    cloneDestinationResource() {
      if (!this.cloneDestination) {
        return null
      }
      return this.$cwa.getResource(this.cloneDestination)
    },
    cloneAllowNavigate(): boolean {
      return this.$cwa.$storage.get('CLONE_ALLOW_NAVIGATE')
    }
  },
  methods: {
    async clone(useBefore = false) {
      const destination = this.cloneDestination
      if (!destination) {
        consola.warn('Cannot clone: no destination selected')
        return
      }
      const destinationIsCollection = this.cloneDestinationIsCollection
      const collection = destinationIsCollection
        ? destination
        : this.$cwa.getResource(
            this.cloneDestinationResource.componentCollection
          )
      let sortValue = destinationIsCollection
        ? 1
        : this.cloneDestinationResource.sortValue
      if (useBefore) {
        sortValue--
      } else {
        sortValue++
      }
      await this.$cwa.createResource(
        '/_/component_positions',
        {
          componentCollection: destinationIsCollection
            ? this.cloneDestination
            : this.cloneDestinationResource.componentCollection,
          sortValue,
          component: this.cloneComponent.iri
        },
        null,
        destinationIsCollection
          ? [this.cloneDestination]
          : [
              this.cloneDestinationResource.componentCollection,
              ...collection.componentPositions
            ]
      )
      this.$cwa.$eventBus.$emit(
        COMPONENT_MANAGER_EVENTS.selectComponent,
        this.cloneComponent.iri
      )
      this.cancelClone(false)
    },
    cancelClone(confirm: boolean = true) {
      const doCancel = () => {
        this.cloneComponent = null
        this.cloneDestination = null
        this.cloneNavigate = false
      }
      if (!confirm) {
        doCancel()
        return
      }
      const event: ConfirmDialogEvent = {
        id: 'confirm-cancel-clone',
        title: 'Cancel',
        html: `<p>Are you sure you want to stop cloning this component?</p>`,
        onSuccess: () => {
          doCancel()
        },
        confirmButtonText: 'Continue'
      }
      this.$cwa.$eventBus.$emit(CONFIRM_DIALOG_EVENTS.confirm, event)
    }
  }
})
