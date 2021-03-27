import ComponentManagerMixin, {
  ComponentManagerComponent,
  ComponentManagerTab
} from './ComponentManagerMixin'
import ResourceMixin from './ResourceMixin'
import ApiRequestMixin from './ApiRequestMixin'

export default {
  mixins: [ResourceMixin, ApiRequestMixin, ComponentManagerMixin],
  computed: {
    componentManager(): ComponentManagerComponent {
      return {
        name: this?.resource?.['@type'] || 'Unknown Component',
        tabs: this.defaultManagerTabs
      }
    },
    defaultManagerTabs() {
      const tabs: Array<ComponentManagerTab> = [
        {
          label: 'Component',
          component: () =>
            import(
              '@cwa/nuxt-module/core/templates/components/admin/cwa-component-manager/tabs/component/component-ui.vue'
            ),
          priority: 0
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

      if (this.publishable) {
        tabs.push({
          label: 'Status',
          component: () =>
            import(
              '@cwa/nuxt-module/core/templates/components/admin/cwa-component-manager/tabs/component/publishable-status.vue'
            ),
          priority: 100
        })
      }

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
