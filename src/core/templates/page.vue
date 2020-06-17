<template>
  <div class="container">
    <div class="row">
      <div class="column column-33">
        <h5>Route</h5>
        <pre>{{ currentRoute }}</pre>
      </div>
      <div class="column column-33">
        <h5>Page Metadata Object</h5>
        <pre>{{ currentPageMetadata }}</pre>
      </div>
      <div class="column column-33">
        <h5>Page Template Object (same as Metadata if static)</h5>
        <pre>{{ currentPageTemplate }}</pre>
      </div>
    </div>
    <h3 v-if="currentPageTemplate">Page Template UI Component To Load: {{ currentPageTemplate.uiComponent }}</h3>
    <PrimaryPageTemplate /> 
  </div>
</template>

<script>
  import { StoreCategories } from "@cwa/core/storage";

  export default {
    auth: false,
    layout: 'cwa-layout',
    computed: {
      state () {
        return this.$cwa.$state.resources.current
      },
      currentRoute() {
        if (this.state.Route === undefined || this.state.Route.current === undefined) {
          console.error(`Current route is undefined`)
          return null
        }
        const route = this.state.Route.byId[this.state.Route.current]
        if (route === undefined) {
          console.error(`Cannot find route with ID ${this.state.Route.current}`)
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
          return this.state[resourceType].byId[this.currentRoute.pageData]
        }
        return this.state.Page.byId[this.currentRoute.page]
      },
      currentPageTemplate() {
        if (!this.currentRoute || !this.currentPageMetadata) {
          return
        }
        if (this.currentRoute.pageData) {
          return this.state.Page.byId[this.currentPageMetadata.page]
        }
        return this.currentPageMetadata
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
