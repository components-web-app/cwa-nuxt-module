import consola from 'consola'
import { COMPONENT_MANAGER_EVENTS } from '../events'

export const EVENTS = COMPONENT_MANAGER_EVENTS

export interface ComponentTabContext {
  UiComponents?: Array<string>
  UiClassNames?: Array<string>
}

export interface StatusTabContext {
  enabled?: boolean
}

export interface ComponentManagerComponentContext {
  componentTab?: ComponentTabContext
  statusTab?: StatusTabContext
}

export interface ComponentManagerTab {
  label: string
  component: Function
  priority?: number
  context?: object
}

export interface ComponentManagerComponent {
  name: string
  tabs: Array<ComponentManagerTab>
  context?: ComponentManagerComponentContext
}

export interface ComponentManagerAddEvent {
  data: ComponentManagerComponent
  resource: Object
}

export const ComponentManagerMixin = {
  data() {
    return {
      highlightElementAdded: false,
      addedRelativePosition: false
    }
  },
  computed: {
    componentManager(): ComponentManagerComponent {
      return {
        name: 'Unnamed',
        tabs: []
      }
    },
    computedIri() {
      return this.resource['@id']
    },
    cmHighlightClass() {
      return !this.published
        ? 'cwa-manager-highlight is-draft'
        : 'cwa-manager-highlight'
    }
  },
  watch: {
    published() {
      if (!this.highlightElement) {
        return
      }
      this.highlightElement.className = this.cmHighlightClass
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
      this.$cwa.$eventBus.$emit(EVENTS.addComponent, {
        data: this.componentManager,
        resource: this.resource
      } as ComponentManagerAddEvent)
    },
    initComponentManagerShowListener() {
      this.$cwa.$eventBus.$once(EVENTS.show, this.componentManagerShowListener)
      // we should only be populating when the element is clicked and the show event is called
      // if we click, but this results in the manager hiding (it is already shown)
      // we should remove the event listener to prevent it being fired if the next click
      // is not on this component
      setTimeout(() => {
        this.removeComponentManagerShowListener()
      }, 0)
    },
    removeComponentManagerShowListener() {
      this.$cwa.$eventBus.$off(EVENTS.show, this.componentManagerShowListener)
    },
    managerComponentListener(iri) {
      if (iri === this.computedIri) {
        if (!this.highlightElement) {
          if (this.$el.style.position === '') {
            this.$el.style.position = 'relative'
            this.addedRelativePosition = true
          }
          this.highlightElement = document.createElement('div')
          this.highlightElement.className = this.cmHighlightClass
          this.$el.appendChild(this.highlightElement)
        }
        return
      }
      if (this.highlightElement) {
        this.highlightElement.parentNode.removeChild(this.highlightElement)
        this.highlightElement = null
        if (this.addedRelativePosition) {
          this.$el.style.position = ''
        }
      }
    }
  },
  mounted() {
    this.$el.addEventListener('click', this.initComponentManagerShowListener)
    this.$cwa.$eventBus.$on(
      EVENTS.selectComponent,
      this.managerComponentListener
    )
    // will exist with a resource mixin
    if (this.isNew) {
      this.$el.click()

      function elementInViewport(el) {
        let top = el.offsetTop
        let left = el.offsetLeft
        const width = el.offsetWidth
        const height = el.offsetHeight

        while (el.offsetParent) {
          el = el.offsetParent
          top += el.offsetTop
          left += el.offsetLeft
        }

        return (
          top >= window.pageYOffset &&
          left >= window.pageXOffset &&
          top + height <= window.pageYOffset + window.innerHeight &&
          left + width <= window.pageXOffset + window.innerWidth
        )
      }
      if (!elementInViewport(this.$el)) {
        this.$el.scrollIntoView(true)
      }
    }
  },
  beforeDestroy() {
    this.$el.removeEventListener('click', this.initComponentManagerShowListener)
    this.$cwa.$eventBus.$off(
      EVENTS.selectComponent,
      this.managerComponentListener
    )
  }
}

export default ComponentManagerMixin
