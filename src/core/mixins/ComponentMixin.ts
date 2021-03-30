import ComponentManagerMixin, {
  ComponentManagerComponent,
  ComponentManagerComponentContext,
  ComponentManagerTab
} from './ComponentManagerMixin'
import ResourceMixin from './ResourceMixin'
import ApiRequestMixin from './ApiRequestMixin'

export default {
  mixins: [ResourceMixin, ApiRequestMixin, ComponentManagerMixin],
  data() {
    return {
      componentManagerContext: {
        componentTab: {
          UiComponents: [],
          UiClassNames: []
        }
      } as ComponentManagerComponentContext
    }
  },
  computed: {
    componentManager(): ComponentManagerComponent {
      return {
        name: this?.resource?.['@type'] || 'Unknown Component',
        tabs: this.defaultManagerTabs,
        context: Object.assign(
          {
            statusTab: {
              enabled: this.publishable
            }
          },
          this.componentManagerContext
        )
      }
    },
    defaultManagerTabs() {
      const tabs: Array<ComponentManagerTab> = [
        {
          label: 'Order',
          component: () =>
            import(
              '@cwa/nuxt-module/core/templates/components/admin/cwa-component-manager/tabs/component/sort-order.vue'
            ),
          priority: 100
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
      return this.resource._metadata || {}
    },
    publishable() {
      return 'published' in this.metadata
    },
    published() {
      return this.publishable ? this.metadata.published : true
    }
  }
}
