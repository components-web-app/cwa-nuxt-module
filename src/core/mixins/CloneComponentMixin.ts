import Vue from 'vue'
import { COMPONENT_MANAGER_EVENTS } from '../events'

export default Vue.extend({
  computed: {
    cloneComponent: {
      get(): string {
        return this.$cwa.$state.clone.component
      },
      set(value: string) {
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
    }
  },
  methods: {
    async clone(useBefore = false) {
      const destination = this.$cwa.getResource(this.cloneDestination)
      const destinationIsCollection =
        destination['@type'] === 'ComponentCollection'
      const collection = destinationIsCollection
        ? destination
        : this.$cwa.getResource(destination.componentCollection)
      let sortValue = destinationIsCollection ? 1 : destination.sortValue
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
            : destination.componentCollection,
          sortValue,
          component: this.cloneComponent
        },
        null,
        destinationIsCollection
          ? [this.cloneDestination]
          : [destination.componentCollection, ...collection.componentPositions]
      )
      this.$cwa.$eventBus.$emit(
        COMPONENT_MANAGER_EVENTS.selectComponent,
        this.cloneComponent
      )
      this.cancelClone()
    },
    cancelClone() {
      this.cloneComponent = null
      this.cloneDestination = null
      this.cloneNavigate = false
    }
  }
})
