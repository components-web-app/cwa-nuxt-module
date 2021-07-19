import Vue from 'vue'
import consola from 'consola'
import { COMPONENT_MANAGER_EVENTS, ComponentManagerAddEvent } from '../events'
import AddElementsMixin from './AddElementsMixin'

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
  context?: any
}

export interface ComponentManagerComponent {
  name: string
  tabs: Array<ComponentManagerTab>
  context?: ComponentManagerComponentContext
}

export const ComponentManagerMixin = Vue.extend({
  mixins: [AddElementsMixin],
  computed: {
    componentManager(): ComponentManagerComponent {
      return {
        name: 'Unnamed',
        tabs: []
      }
    },
    computedIri() {
      return this.resource?.['@id']
    },
    cmHighlightClass() {
      return this.publishable && !this.published
        ? 'cwa-manager-highlight is-draft'
        : 'cwa-manager-highlight'
    },
    componentManagerState() {
      const cmStates =
        this.$cwa.$storage.getState('CwaComponentManagerStates') || {}
      return cmStates?.[this.computedIri] || {}
    },
    cmValue() {
      return (name) => {
        return this.componentManagerState[name] || null
      }
    }
  },
  watch: {
    published() {
      if (!this.elementsAdded.highlight) {
        return
      }
      this.elementsAdded.highlight.className = this.cmHighlightClass
    }
  },
  beforeMount() {
    this.$cwa.$eventBus.$on(
      EVENTS.highlightComponent,
      this.managerHighlightComponentListener
    )
    this.$cwa.$eventBus.$on(
      EVENTS.selectComponent,
      this.managerSelectComponentListener
    )
    this.$cwa.$eventBus.$emit(EVENTS.componentMounted, this.computedIri)
  },
  mounted() {
    this.$el.addEventListener('click', this.initComponentManagerShowListener)
    // will exist with a resource mixin
    if (this.isNew) {
      this.$el.click()

      const elementInViewport = (el) => {
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
      EVENTS.highlightComponent,
      this.managerHighlightComponentListener
    )
    this.$cwa.$eventBus.$off(
      EVENTS.selectComponent,
      this.managerSelectComponentListener
    )
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
        iri: this.computedIri
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
    managerHighlightComponentListener({ iri }) {
      // the sort order tab will add the position as well
      // next tick means we don't lose adding it, but there
      // needs to be a better way - what if another component
      // or function needs to do this. Perhaps we have to have
      // events for components to listen to, and this is one?
      // perhaps we always have a default position on all components?
      this.$nextTick(() => {
        if (iri === this.computedIri) {
          if (!this.elementsAdded.highlight) {
            this.$set(
              this.elementsAdded,
              'highlight',
              document.createElement('div')
            )
            this.elementsAdded.highlight.className = this.cmHighlightClass
            this.$el.appendChild(this.elementsAdded.highlight)
          }
          return
        }
        if (this.elementsAdded.highlight) {
          this.elementsAdded.highlight.parentNode.removeChild(
            this.elementsAdded.highlight
          )
          this.$delete(this.elementsAdded, 'highlight')
        }
      })
    },
    managerSelectComponentListener(iri) {
      if (iri !== this.computedIri) {
        return
      }
      this.$nextTick(() => {
        const clickEvent = new MouseEvent('click', {
          view: window,
          bubbles: true,
          cancelable: false
        })
        this.$el.dispatchEvent(clickEvent)
      })
    }
  }
})

export default ComponentManagerMixin
