import Vue from 'vue'
import { COMPONENT_MANAGER_EVENTS } from '../events'

export default Vue.extend({
  computed: {
    reuseComponent: {
      get(): string {
        return this.$cwa.$state.reuse.component
      },
      set(value: string) {
        this.$cwa.$storage.setReuseComponent(value)
      }
    },
    reuseDestination: {
      get(): string {
        return this.$cwa.$state.reuse.destination
      },
      set(value: string) {
        this.$cwa.$storage.setReuseDestination(value)
      }
    },
    reuseNavigate: {
      get(): boolean {
        return this.$cwa.$state.reuse.navigate
      },
      set(value: boolean) {
        this.$cwa.$storage.setReuseNavigate(value)
      }
    }
  },
  methods: {
    async reuse(useBefore = false) {
      const destination = this.$cwa.getResource(this.reuseDestination)
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
            ? this.reuseDestination
            : destination.componentCollection,
          sortValue,
          component: this.reuseComponent
        },
        null,
        destinationIsCollection
          ? [this.reuseDestination]
          : [destination.componentCollection, ...collection.componentPositions]
      )
      this.$cwa.$eventBus.$emit(
        COMPONENT_MANAGER_EVENTS.selectComponent,
        this.reuseComponent
      )
      this.cancelReuse()
    },
    cancelReuse() {
      this.reuseComponent = null
      this.reuseDestination = null
      this.reuseNavigate = false
    }
  }
})
