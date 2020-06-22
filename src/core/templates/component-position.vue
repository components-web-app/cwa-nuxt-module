<template>
  <resource-component-loader v-if="component" :component="component.uiComponent || component['@type']" :iri="componentPosition.component" />
</template>

<script>
import { StoreCategories } from "@cwa/nuxt-module/core/storage"
import ResourceComponentLoader from './resource-component-loader'
import components from '~/.nuxt/cwa/components'

export default {
  components: {
    ResourceComponentLoader,
    ...components
  },
  props: {
    iri: {
      type: String,
      required: true
    }
  },
  computed: {
    componentPosition() {
      return this.$cwa.resources.ComponentPosition.byId[this.iri]
    },
    component() {
      if (!this.componentPosition) {
        return null
      }
      const componentType = this.$cwa.$storage.getTypeFromIri(this.componentPosition.component, StoreCategories.Component)
      if (!componentType) {
        return null
      }
      return this.$cwa.resources[componentType].byId[this.componentPosition.component]
    }
  }
}
</script>
