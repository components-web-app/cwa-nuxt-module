<template>
  <div>
    <cwa-admin-select
      id="component"
      v-model="selectedComponent"
      :options="componentOptions"
    />
    <component
      :is="selectedComponentDialogComponent"
      v-if="selectedComponentDialogComponent"
      :component-collection="resource['@id']"
    />
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import consola from 'consola'
import CwaAdminSelect from '../../input/cwa-admin-select.vue'
import components from '~/.nuxt/cwa/components'

export default {
  components: { CwaAdminSelect },
  props: {
    resource: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      loadingComponents: false,
      availableComponents: [],
      selectedComponent: null,
      selectedComponentDialogComponent: null
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
      const component = await components[newComponent]().component
      const componentInstance = new (Vue.extend(component))({
        propsData: {
          iri: 'new'
        }
      })
      this.selectedComponentDialogComponent =
        componentInstance.adminDialog?.component
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
