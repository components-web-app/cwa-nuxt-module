<template>
  <resource-component-loader
    v-if="component"
    :component="`CwaComponents${component.uiComponent || component['@type']}`"
    :iri="componentPosition.component"
    @deleted="$emit('deleted')"
  />
  <div v-else-if="componentPosition.pageDataProperty">
    The property [{{ componentPosition.pageDataProperty }}] will be added here
    from page data
  </div>
</template>

<script>
import { StoreCategories } from '@cwa/nuxt-module/core/storage'
import ResourceComponentLoader from '../../resource-component-loader'
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
  data() {
    return {
      componentLoadFailed: false
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
      const componentType = this.$cwa.$storage.getTypeFromIri(
        this.componentPosition.component,
        StoreCategories.Component
      )
      if (!componentType) {
        return null
      }
      return this.$cwa.resources[componentType].byId[
        this.componentPosition.component
      ]
    }
  },
  async mounted() {
    if (!this.component) {
      // check if no published version, only a draft
      if (this.$cwa.user && this.componentPosition.component) {
        await this.$cwa.fetcher.fetchComponent(this.componentPosition.component)
      }
      if (!this.component) {
        if (!this.componentPosition.pageDataProperty && this.$cwa.isAdmin) {
          await this.$cwa.fetcher.fetchComponent(this.componentPosition['@id'])
        }
        this.componentLoadFailed = true
      }
    }
  }
}
</script>
