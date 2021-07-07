<template>
  <div>
    <cwa-admin-select
      id="component"
      v-model="selectedComponent"
      label="Add"
      :options="componentOptions"
      :wrapper="wrapperComponent"
    />
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import consola from 'consola'
import {
  COMPONENT_MANAGER_EVENTS,
  NewComponentEvent
} from '../../../../../../events'
import ComponentManagerTabMixin from '../../../../../../mixins/ComponentManagerTabMixin'
import CwaAdminSelect from '../../../input/cwa-admin-select.vue'
import components from '~/.nuxt/cwa/components'

export default Vue.extend({
  components: { CwaAdminSelect },
  mixins: [ComponentManagerTabMixin],
  data() {
    return {
      loadingComponents: false,
      availableComponents: [],
      selectedComponent: null,
      wrapperComponent: async () => await import('../../input/wrapper.vue')
    }
  },
  computed: {
    componentOptions() {
      return Object.keys(this.availableComponents)
    }
  },
  watch: {
    async selectedComponent(newComponent) {
      // get the component for the dialog from the ui component
      const component = await components[`CwaComponents${newComponent}`]
      const {
        endpoint,
        resourceName: name,
        isPublishable
      } = this.availableComponents[newComponent]
      const event: NewComponentEvent = {
        collection: this.resource['@id'],
        component,
        endpoint,
        name,
        isPublishable
      }
      this.$cwa.$eventBus.$emit(COMPONENT_MANAGER_EVENTS.newComponent, event)
    }
  },
  async mounted() {
    this.availableComponents = await this.fetchComponents()
  },
  methods: {
    getUiComponent(resourceName) {
      const searchKey = `CwaComponents${resourceName}`
      const uiComponent = components[searchKey]
      if (!uiComponent) {
        consola.error(
          `UI component not found for API component named ${resourceName}. Searched for key ${searchKey}`
        )
        return
      }
      return components[searchKey]
    },
    async fetchComponents() {
      const loadedComponents = {}
      this.loadingComponents = true
      const data = await this.$cwa.getApiDocumentation()
      const properties = data.docs['hydra:supportedClass'].reduce(
        (obj, supportedClass) => {
          obj[supportedClass['rdfs:label']] = supportedClass[
            'hydra:supportedProperty'
          ].map((supportedProperty) => supportedProperty['hydra:title'])
          return obj
        },
        {}
      )
      for (const [key, endpoint] of Object.entries(
        data.entrypoint
      ) as string[][]) {
        if (endpoint.startsWith('/component/')) {
          const resourceName = key[0].toUpperCase() + key.slice(1)
          if (!this.getUiComponent(resourceName)) {
            continue
          }
          const isPublishable =
            properties?.[resourceName].includes('publishedAt') || false
          loadedComponents[resourceName] = {
            resourceName,
            endpoint,
            isPublishable
          }
        }
      }
      this.loadingComponents = false
      return loadedComponents
    }
  }
})
</script>
