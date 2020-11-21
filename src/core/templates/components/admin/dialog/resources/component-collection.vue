<template>
  <div>
    <cwa-admin-select
      id="component"
      :options="componentOptions"
      v-model="selectedComponent"
    />
    <component v-if="selectedComponentDialogComponent" :is="selectedComponentDialogComponent" />
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import consola from 'consola'
import components from '~/.nuxt/cwa/components'
import CwaAdminSelect from '../../input/cwa-admin-select.vue'

export default {
  data() {
    return {
      loadingComponents: false,
      availableComponents: [],
      selectedComponent: null,
      selectedComponentDialogComponent: null
    }
  },
  components: {CwaAdminSelect},
  async mounted() {
    this.availableComponents = await this.fetchComponents()
  },
  watch: {
    async selectedComponent(newComponent) {
      // get the component for the dialog from the ui component
      const component = await components[newComponent]().component
      console.log(component)
      const componentInstance = new (Vue.extend(component))({
        propsData: {
          iri: 'new'
        }
      })
      this.selectedComponentDialogComponent = componentInstance.adminDialog.component
    }
  },
  computed: {
    componentOptions() {
      return Object.keys(this.availableComponents)
    }
  },
  methods: {
    getUiComponent(resourceName) {
      const uiComponent = components[resourceName]
      if (!uiComponent) {
        consola.error(`UI component not found for API component named ${resourceName}`)
        return
      }
      return components[resourceName]
    },
    async fetchComponents() {
      const loadedComponents = {}
      this.loadingComponents = true
      const data = await this.$cwa.getApiDocumentation()
      for (const [key, endpoint] of Object.entries(data.entrypoint) as string[][]) {
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
