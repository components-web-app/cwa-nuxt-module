<template>
  <div>
    <resource-component-loader :component="component.uiComponent || component['@type']" :iri="componentPosition.component" />
  </div>
</template>

<script>
import { StoreCategories } from "@cwa/nuxt-module/core/storage.ts"
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
      const componentType = this.$cwa.$storage.getTypeFromIri(this.componentPosition.component, StoreCategories.Component)
      if (!componentType) {
        return null
      }
      return this.$cwa.resources[componentType].byId[this.componentPosition.component]
    }
  }
}
</script>
