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
import consola from 'consola'
import { COMPONENT_MANAGER_EVENTS } from '../../../../../../events'
import { NewComponentEvent } from '../../types'
import ComponentManagerTabMixin from '../../../../../../mixins/ComponentManagerTabMixin'
import CwaAdminSelect from '../../../input/cwa-admin-select.vue'
import components from '~/.nuxt/cwa/components'

export default {
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
      const { endpoint, resourceName: name } = this.availableComponents[
        newComponent
      ]
      const event: NewComponentEvent = {
        collection: this.resource['@id'],
        component,
        endpoint,
        name
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
    // resolveComponentProperties(docs) {
    //   const componentDataTemplates = {}
    //   for (const supportedClass of docs['hydra:supportedClass']) {
    //     if (!Array.isArray(supportedClass['hydra:supportedOperation'])) {
    //       continue
    //     }
    //     let hasPut = false
    //     for (const op of supportedClass['hydra:supportedOperation']) {
    //       if (op['hydra:method'] === 'PUT') {
    //         hasPut = true
    //         break
    //       }
    //     }
    //     if (!hasPut) {
    //       continue
    //     }
    //
    //     const clsObj = {}
    //     for (const prop of supportedClass['hydra:supportedProperty']) {
    //       clsObj[prop['hydra:property']['rdfs:label']] = {
    //         writable: prop['hydra:writeable'],
    //         readable: prop['hydra:readable'],
    //         required: prop['hydra:required']
    //       }
    //     }
    //     componentDataTemplates[supportedClass['hydra:title']] = clsObj
    //   }
    //   return componentDataTemplates
    // },
    async fetchComponents() {
      const loadedComponents = {}
      this.loadingComponents = true
      const data = await this.$cwa.getApiDocumentation()

      for (const [key, endpoint] of Object.entries(
        data.entrypoint
      ) as string[][]) {
        if (endpoint.startsWith('/component/')) {
          const resourceName = key[0].toUpperCase() + key.slice(1)
          if (!this.getUiComponent(resourceName)) {
            continue
          }
          loadedComponents[resourceName] = {
            resourceName,
            endpoint
          }
        }
      }
      this.loadingComponents = false
      return loadedComponents
    }
  }
}
</script>
