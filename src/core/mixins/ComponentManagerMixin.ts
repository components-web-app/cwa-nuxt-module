import consola from 'consola'

export interface ComponentManagerComponent {
  name: string
  tabs: Array<{ label: string; component: Function }>
}

export interface ComponentManagerAddEvent {
  data: ComponentManagerComponent
  resource: Object
}

export const ComponentManagerMixin = {
  data() {
    return {
      componentManager: {}
    } as {
      componentManager: ComponentManagerComponent
    }
  },
  computed: {
    computedIri() {
      return this.resource['@id']
    }
  },
  methods: {
    componentManagerShowListener() {
      if (!this.resource) {
        consola.error(
          'Could not add component to component manager. No resource is defined',
          this
        )
        return
      }
      this.$cwa.$eventBus.$emit('cwa:component-manager:add-component', {
        data: this.componentManager,
        resource: this.resource
      } as ComponentManagerAddEvent)
    },
    initComponentManagerShowListener() {
      this.$cwa.$eventBus.$once(
        'cwa:component-manager:show',
        this.componentManagerShowListener
      )
      // we should only be populating when the element is clicked and the show event is called
      // if we click, but this results in the manager hiding (it is already shown)
      // we should remove the event listener to prevent it being fired if the next click
      // is not on this component
      setTimeout(() => {
        this.removeComponentManagerShowListener()
      }, 0)
    },
    removeComponentManagerShowListener() {
      this.$cwa.$eventBus.$off(
        'cwa:component-manager:show',
        this.componentManagerShowListener
      )
    },
    managerComponentListener(iri) {
      if (iri === this.computedIri) {
        !this.$el.classList.contains('cwa-manager-highlighted') &&
          this.$el.classList.add('cwa-manager-highlighted')
        return
      }
      this.$el.classList.contains('cwa-manager-highlighted') &&
        this.$el.classList.remove('cwa-manager-highlighted')
    }
  },
  mounted() {
    this.$el.addEventListener('click', this.initComponentManagerShowListener)
    this.$cwa.$eventBus.$on(
      'cwa:component-manager:component',
      this.managerComponentListener
    )
  },
  beforeDestroy() {
    this.$el.removeEventListener('click', this.initComponentManagerShowListener)
    this.$cwa.$eventBus.$off(
      'cwa:component-manager:component',
      this.managerComponentListener
    )
  }
}

export default ComponentManagerMixin
