import Vue from 'vue'
import ComponentManagerMixin, {
  ComponentManagerComponent,
  ComponentManagerComponentContext,
  ComponentManagerTab
} from './ComponentManagerMixin'
import ResourceMixin from './ResourceMixin'
import ApiRequestMixin from './ApiRequestMixin'

interface DataInterface {
  componentManagerContext: ComponentManagerComponentContext
  elementsAdded: { [key: string]: HTMLElement }
}

export default Vue.extend({
  mixins: [ResourceMixin, ApiRequestMixin, ComponentManagerMixin],
  props: {
    showSort: {
      type: Boolean,
      default: false,
      required: false
    },
    sortValue: {
      type: Number,
      default: null,
      required: false
    }
  },
  data(): DataInterface {
    return {
      componentManagerContext: {
        componentTab: {
          UiComponents: [],
          UiClassNames: []
        }
      },
      elementsAdded: {}
    }
  },
  computed: {
    displaySortValue() {
      return this.showSort ? this.sortValue : null
    },
    componentManager(): ComponentManagerComponent {
      return {
        name: this?.resource?.['@type'] || 'Unknown Component',
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
        context: Object.assign(
          {
            statusTab: {
              enabled: this.publishable && !this.metadata?._isNew
            }
          },
          this.componentManagerContext
        )
      }
    },
    componentManagerTabs() {
      return []
    },
    defaultManagerTabs() {
      const tabs: Array<ComponentManagerTab> = [
        {
          label: 'Order',
          component: () =>
            import(
              '@cwa/nuxt-module/core/templates/components/admin/cwa-component-manager/tabs/component/sort-order.vue'
            ),
          priority: 100,
          context: {
            showOrderValues: true
          }
        },
        {
          label: 'Info',
          component: () =>
            import(
              '@cwa/nuxt-module/core/templates/components/admin/cwa-component-manager/tabs/component/info.vue'
            ),
          priority: 200
        }
      ]
      return tabs
    },
    metadata() {
      return this.resource?._metadata || {}
    },
    publishable() {
      return 'published' in this.metadata
    },
    published() {
      return this.publishable ? this.metadata.published : true
    }
  },
  watch: {
    displaySortValue(newValue) {
      if (newValue !== null) {
        if (!this.elementsAdded.sortValue) {
          this.$set(
            this.elementsAdded,
            'sortValue',
            document.createElement('span')
          )
          this.elementsAdded.sortValue.className = 'cwa-sort-value'
          this.$el.appendChild(this.elementsAdded.sortValue)
        }
        this.elementsAdded.sortValue.innerHTML = newValue
        return
      }
      if (this.elementsAdded.sortValue) {
        this.elementsAdded.sortValue.parentNode.removeChild(
          this.elementsAdded.sortValue
        )
        this.$delete(this.elementsAdded, 'sortValue')
      }
    }
  }
})
