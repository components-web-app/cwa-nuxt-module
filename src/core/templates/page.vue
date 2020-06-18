<template>
  <resource-component-loader
    v-if="currentPageTemplateResource"
    :component="currentPageTemplateResource.uiComponent"
    :iri="currentPageTemplateIri"
  />
</template>

<script>
  import consola from 'consola'
  import { StoreCategories } from "@cwa/nuxt-module/core/storage"
  import components from '~/.nuxt/cwa/pages'
  import ResourceComponentLoader from './resource-component-loader'

  export default {
    auth: false,
    layout({ $cwa }) {
      return $cwa.layout
    },
    components: {
      ResourceComponentLoader,
      ...components
    },
    computed: {
      resources () {
        return this.$cwa.resources
      },
      currentRoute() {
        if (this.resources.Route === undefined || this.resources.Route.current === undefined) {
          consola.error(`Current route is undefined`)
          return null
        }
        const route = this.resources.Route.byId[this.resources.Route.current]
        if (route === undefined) {
          consola.error(`Cannot find route with ID ${this.resources.Route.current}`)
          return null
        }
        return route
      },
      currentPageMetadata() {
        if (!this.currentRoute) {
          return
        }
        if (this.currentRoute.pageData) {
          const resourceType = this.$cwa.$storage.getTypeFromIri(this.currentRoute.pageData, StoreCategories.PageData)
          if (!resourceType) {
            return null
          }
          return this.resources[resourceType].byId[this.currentRoute.pageData]
        }
        return this.resources.Page.byId[this.currentRoute.page]
      },
      currentPageTemplateIri() {
        if (!this.currentRoute || !this.currentPageMetadata) {
          return
        }
        return this.currentRoute.pageData ? this.currentPageMetadata.page : this.currentRoute.page
      },
      currentPageTemplateResource() {
        return this.resources.Page.byId[this.currentPageTemplateIri]
      }
    },
    head() {
      if (!this.currentPageMetadata) {
        return {}
      }
      return {
        title: this.currentPageMetadata.title,
        meta: [
          { hid: 'description', name: 'description', content: this.currentPageMetadata.metaDescription }
        ]
      }
    }
  }
</script>

<style lang="sass" scoped>
.row .column
  display: flex
  flex-direction: column
  > *
    display: flex
  > h5
    flex-grow: 0
    margin: 0
  > pre
    flex-grow: 1
</style>
