import Vue from 'vue'
import consola from 'consola'
import {
  COMPONENT_MANAGER_EVENTS,
  ComponentManagerResource,
  HighlightComponentEvent
} from '../events'
import CloneComponentMixin from './CloneComponentMixin'
import AddElementsMixin from './AddElementsMixin'
import ComponentManagerValueMixin from './ComponentManagerValueMixin'

const highlightName = 'highlight'

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
  inputFieldsUsed?: string[]
}

export interface ComponentManagerComponent {
  name: string
  tabs: Array<ComponentManagerTab>
  context?: ComponentManagerComponentContext
}

// eslint-disable-next-line vue/one-component-per-file
export const ComponentManagerMixin = Vue.extend({
  mixins: [AddElementsMixin, ComponentManagerValueMixin, CloneComponentMixin],
  data() {
    return {
      highlightIsPosition: false,
      componentManagerDisabled: false,
      elementsAdded: {},
      componentManagerContext: {},
      resourceName: null,
      cmInitialised: false
    }
  },
  computed: {
    defaultManagerTabs(): Array<ComponentManagerTab> {
      return []
    },
    componentManagerTabs(): Array<ComponentManagerTab> {
      return []
    },
    baseComponentManager(): ComponentManagerComponent {
      return {
        name: this.resourceName || 'Unnamed',
        tabs: [
          ...this.defaultManagerTabs.map((item) =>
            Object.assign({}, item, {
              context: {
                ...this.componentManagerContext,
                ...(item.context || {})
              }
            })
          ),
          ...this.componentManagerTabs
        ],
        context: this.componentManagerContext
      }
    },
    componentManager() {
      return this.baseComponentManager
    },
    computedIri() {
      return this.resource?.['@id']
    },
    cmHighlightClass() {
      if (this.cloneComponent) {
        return 'cwa-manager-highlight is-primary'
      }
      return this.publishable && !this.published
        ? 'cwa-manager-highlight is-draft'
        : 'cwa-manager-highlight'
    }
  },
  watch: {
    published() {
      if (!this.elementsAdded.highlight) {
        return
      }
      this.elementsAdded.highlight.className = this.cmHighlightClass
    },
    cmHighlightClass() {
      if (!this.elementsAdded.highlight) {
        return
      }
      this.elementsAdded.highlight.className = this.cmHighlightClass
    }
  },
  mounted() {
    this.initCMMixin()
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
    this.$cwa.$eventBus.$off(
      EVENTS.cancelShow,
      this.removeComponentManagerShowListener
    )
    this.$cwa.$eventBus.$off(
      EVENTS.hide,
      this.removeComponentManagerShowListener
    )
  },
  methods: {
    initCMMixin() {
      if (this.componentManagerDisabled || this.cmInitialised === this.iri) {
        return
      }

      this.$el.addEventListener(
        'click',
        this.initComponentManagerShowListener,
        false
      )

      this.$cwa.$eventBus.$on(
        EVENTS.highlightComponent,
        this.managerHighlightComponentListener
      )
      this.$cwa.$eventBus.$on(
        EVENTS.selectComponent,
        this.managerSelectComponentListener
      )
      this.$cwa.$eventBus.$on(
        EVENTS.cancelShow,
        this.removeComponentManagerShowListener
      )
      this.$cwa.$eventBus.$on(
        EVENTS.hide,
        this.removeComponentManagerShowListener
      )
      if (this.isCloneComponent) {
        this.addHighlightDomElement()
      }

      this.$cwa.$eventBus.$emit(EVENTS.componentMounted, this.computedIri)

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
      this.cmInitialised = this.iri
    },
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
      } as ComponentManagerResource)
    },
    initComponentManagerShowListener() {
      if (this.locationResourceType === 'layouts') {
        this.$cwa.$eventBus.$emit(EVENTS.layoutEditMode)
      }

      this.$cwa.$eventBus.$once(EVENTS.show, this.componentManagerShowListener)
    },
    removeComponentManagerShowListener() {
      this.$cwa.$eventBus.$off(EVENTS.show, this.componentManagerShowListener)
    },
    managerHighlightComponentListener({
      iri,
      selectedPosition
    }: HighlightComponentEvent) {
      this.highlightIsPosition = selectedPosition === this.computedIri
      // the sort order tab will add the position as well
      // next tick means we don't lose adding it, but there
      // needs to be a better way - what if another component
      // or function needs to do this. Perhaps we have to have
      // events for components to listen to, and this is one?
      // perhaps we always have a default position on all components?
      this.$nextTick(() => {
        if (iri === this.computedIri) {
          this.addHighlightDomElement()
          return
        }
        if (!this.isCloneComponent) {
          this.removeDomElement(highlightName)
        }
      })
    },
    addHighlightDomElement() {
      this.addDomElement(highlightName, {
        className: this.cmHighlightClass
      })
    },
    removeDomElement(name: string) {
      if (!this.elementsAdded[name]) {
        return
      }
      this.elementsAdded[name].$el.parentNode.removeChild(
        this.elementsAdded[name].$el
      )
      this.elementsAdded[name].$destroy()
      this.$delete(this.elementsAdded, name)
    },
    addDomElement(name: string, propsData: any = {}) {
      if (this.elementsAdded[name]) {
        consola.info(`Already added element with name '${name}'`)
        return
      }
      // eslint-disable-next-line vue/one-component-per-file
      const NewComponentClass = Vue.extend({
        props: { className: { type: String, required: true } },
        template: '<div v-bind:class="className"></div>'
      })
      const newComponent = new NewComponentClass({
        propsData
      })
      newComponent.$mount()
      this.$set(this.elementsAdded, name, newComponent)
      this.$el.appendChild(newComponent.$el)
      return this.elementsAdded[name]
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
