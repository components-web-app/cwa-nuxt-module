import Vue from 'vue'
import consola from 'consola'
import ClientOnly from 'vue-client-only'
import { StoreCategories } from '../storage'
// @ts-ignore
import CloneComponentMixin from '../mixins/CloneComponentMixin'
import ResourceComponentLoader from './resource-component-loader'
// @ts-ignore
import CwaConfirm from './components/cwa-confirm'
// @ts-ignore
import components from '~/.nuxt/cwa/pages'

export default Vue.extend({
  auth: false,
  components: {
    ResourceComponentLoader,
    CwaConfirm,
    ClientOnly,
    ...components
  },
  mixins: [CloneComponentMixin],
  layout({ $cwa }) {
    return $cwa.layoutUiComponent
  },
  head() {
    if (!this.currentPageMetadata) {
      return {}
    }
    return {
      title: this.currentPageMetadata.title,
      meta: [
        {
          hid: 'description',
          name: 'description',
          content: this.currentPageMetadata.metaDescription
        }
      ]
    }
  },
  computed: {
    resources() {
      return this.$cwa.resources
    },
    currentRoute() {
      if (
        this.resources.Route === undefined ||
        this.resources.Route.current === undefined
      ) {
        consola.error('Current route is undefined')
        return null
      }
      const route = this.resources.Route.byId[this.resources.Route.current]
      if (route === undefined) {
        consola.error(
          `Cannot find route with ID ${this.resources.Route.current}`
        )
        return null
      }
      return route
    },
    currentPageMetadata() {
      if (!this.currentRoute) {
        return
      }
      if (this.currentRoute.pageData) {
        const resourceType = this.$cwa.$storage.getTypeFromIri(
          this.currentRoute.pageData,
          StoreCategories.PageData
        )
        if (!resourceType) {
          return null
        }
        return this.resources[resourceType].byId[this.currentRoute.pageData]
      }
      return this.resources.Page?.byId[this.currentRoute.page]
    },
    currentPageTemplateIri() {
      if (!this.currentRoute || !this.currentPageMetadata) {
        return
      }
      return this.currentRoute.pageData
        ? this.currentPageMetadata.page
        : this.currentRoute.page
    },
    currentPageTemplateResource() {
      return this.resources?.Page?.byId[this.currentPageTemplateIri]
    },
    resourceComponentLoaderProps() {
      return {
        component: `CwaPages${this.currentPageTemplateResource?.uiComponent}`,
        iri: this.currentPageTemplateIri
      }
    }
  },
  render(h) {
    return h('div', {}, [
      h(this.$options.components.ResourceComponentLoader, {
        props: this.resourceComponentLoaderProps,
        class: 'cwa-page'
      }),
      h(this.$options.components.CwaConfirm, {})
    ])
  }
})
