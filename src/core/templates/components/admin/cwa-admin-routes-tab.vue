<template>
  <div class="columns fields-container admin-routes-tab">
    <transition name="fade">
      <div v-if="isLoading || loadingRedirects" class="cwa-loader-overlay">
        <cwa-loader />
      </div>
    </transition>
    <div class="column">
      <section v-if="routePageShowing === null">
        <div class="cwa-input field">
          <template v-if="!savedComponent || !savedComponent['@id']">
            <div class="not-found">No page route</div>
            <cm-button @click="showEditRoute">Create page route</cm-button>
          </template>
          <template v-else>
            <label class="label">Page route</label>
            <div class="control">
              <div class="columns">
                <span class="column is-narrow nowrap">{{
                  savedComponent.path
                }}</span>
                <div class="column">
                  <a href="#" @click.prevent="showEditRoute">Edit</a>
                </div>
              </div>
            </div>
          </template>
        </div>
        <div v-if="component['@id']" class="cwa-input">
          <div v-if="loadingRedirects">Loading...</div>
          <template v-else-if="!hasRedirects">
            <div class="not-found">You don't have any redirects</div>
            <cm-button @click="showRedirectPage">Create new redirect</cm-button>
          </template>
          <template v-else>
            <div class="label add-title">
              <span>Redirects</span>
              <cwa-add-button @click="showRedirectPage" />
            </div>
            <div class="columns">
              <div class="column">
                <cwa-admin-routes-redirect-tree
                  v-if="routeWithRedirects.redirectedFrom"
                  :routes="routeWithRedirects.redirectedFrom"
                  @reload="reloadRouteRedirects"
                />
              </div>
            </div>
          </template>
        </div>
      </section>
      <section v-if="routePageShowing === 'route'">
        <div class="columns">
          <div class="column is-narrow">
            <a href="#" @click="showRoutePage">&lt; back</a>
          </div>
        </div>
        <cwa-admin-text
          v-model="component.path"
          label="Page route"
          v-bind="inputProps('path')"
        />
        <p>
          When you update a route, a new redirect will automatically be created
          to prevent broken links.
        </p>

        <div class="columns buttons-row">
          <div class="column">
            <button class="button is-cwa-primary" @click="saveRoute">
              {{ isNew ? 'Create' : 'Update' }}
            </button>
          </div>
          <div v-if="!isNew" class="column is-narrow">
            <button
              class="button is-dark is-delete"
              @click="deleteComponent(onDeleteSuccess)"
            >
              Delete
            </button>
          </div>
        </div>

        <section
          v-if="!savedComponent || generatedRoute !== savedComponent.path"
        >
          <div class="cwa-input">
            <label>Recommended page route</label>
            <div class="columns">
              <span class="column">{{ generatedRoute }}</span>
            </div>
          </div>
          <p>
            You can generate a new route based on your page title '{{
              pageComponent.title
            }}'. This is optimal for search engines and relevance. A new
            redirect will also be created from your old route.
          </p>
          <div class="columns buttons-row">
            <div class="column">
              <button class="button is-cwa-primary" @click="generateRoute">
                Generate
              </button>
            </div>
          </div>
        </section>
      </section>
      <section v-if="routePageShowing === 'redirect'">
        <div class="columns">
          <div class="column is-narrow">
            <a href="#" @click="showRoutePage">&lt; back</a>
          </div>
        </div>
        <cwa-admin-text
          v-model="redirect"
          label="Redirect from path"
          v-bind="inputProps('redirect')"
        />
        <p>The path you enter will be redirected to the current route</p>
        <div class="columns buttons-row">
          <div class="column">
            <button class="button is-cwa-primary" @click="createRedirect">
              Create
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import slugify from 'slugify'
import consola from 'consola'
import IriModalMixin from '../../pages/_cwa/IriModalMixin'
import CwaAddButton from '../utils/cwa-add-button.vue'
import CwaLoader from '../utils/cwa-loader.vue'
import CwaAdminText from './input/cwa-admin-text.vue'
import CmButton from './cwa-component-manager/input/cm-button.vue'
import CwaAdminRoutesRedirectTree from './cwa-admin-routes-redirect-tree.vue'

export default Vue.extend({
  components: {
    CwaAdminRoutesRedirectTree,
    CwaLoader,
    CmButton,
    CwaAddButton,
    CwaAdminText
  },
  mixins: [IriModalMixin],
  props: {
    value: {
      required: false,
      type: Object,
      default: null
    }
  },
  data() {
    // @ts-ignore
    const pageIri = this.$cwa.loadedPage
    const pageComponent = this.value
    // shorthand I cannot ts-ignore..
    // annoying we are ignoring a type error that does not exist...
    // still don't know  why $cwa is not allowed here...
    let iri
    if (pageComponent) {
      iri = pageComponent.route
    } else {
      // @ts-ignore
      iri = this.$cwa.getResource(pageIri).route
    }
    if (!iri) {
      iri = 'add'
    }
    return {
      iri,
      routePageShowing: null,
      pageComponent,
      routeWithRedirects: null,
      postEndpoint: '/_/routes',
      component: {},
      redirect: null,
      loadingRedirects: false,
      fieldNameMap: {
        path: 'Page route'
      }
    } as {
      iri: string
      routePageShowing: string
      routeWithRedirects: Object
      postEndpoint: string
      redirect: string
      loadingRedirects: boolean
    }
  },
  computed: {
    hasRedirects() {
      return this.routeWithRedirects?.redirectedFrom?.length || null
    },
    generatedRoute() {
      return `/${slugify(this.pageComponent.title).toLowerCase()}`
    },
    addingRedirect() {
      // this is to determine whether we show the icon as saved or not
      return this.routePageShowing === 'redirect'
      // (
      //   this.routePageShowing === 'redirect' &&
      //   this.redirect !== null &&
      //   this.redirect !== ''
      // )
    },
    routePageData() {
      return {
        page:
          this.component?.page?.['@id'] ||
          this.component.page ||
          this.pageComponent?.['@id'] ||
          null,
        pageData:
          this.component?.pageData?.['@id'] || this.component.pageData || null
      }
    }
  },
  watch: {
    async iri() {
      await Promise.all([this.findIriResource(), this.reloadRouteRedirects()])
    },
    addingRedirect(newValue) {
      this.$emit('adding-redirect', newValue)
    }
  },
  async mounted() {
    if (this.isNew || !this.iri) {
      this.isLoading = false
      return
    }
    await Promise.all([this.findIriResource(), this.reloadRouteRedirects()])
  },
  methods: {
    async onDeleteSuccess() {
      this.showRoutePage()
      await this.refreshPageResource()
      this.iri = 'add'
    },
    async refreshPageResource() {
      if (this.pageComponent) {
        this.pageComponent = await this.$cwa.refreshResource(
          this.pageComponent['@id']
        )
        this.$emit('input', this.pageComponent)
        this.iri = this.pageComponent.route
      }
    },
    async reloadRouteRedirects() {
      if (this.isNew || !this.iri) {
        this.routeWithRedirects = null
        return
      }
      this.loadingRedirects = true
      this.routeWithRedirects = await this.$axios.$get(`${this.iri}/redirects`)
      this.loadingRedirects = false
    },
    showEditRoute() {
      this.routePageShowing = 'route'
    },
    showRoutePage() {
      this.routePageShowing = null
    },
    showRedirectPage() {
      this.routePageShowing = 'redirect'
    },
    async saveRoute() {
      this.clearAllViolationNotifications()
      const data = this.isNew
        ? Object.assign({}, this.component, this.routePageData, {
            name: this.component.path || null
          })
        : { path: this.component.path }
      if (await this.sendRequest(data)) {
        this.showRoutePage()
        await this.reloadRouteRedirects()
      }
    },
    async generateRoute() {
      this.isLoading = true
      try {
        const newRoute = await this.$axios.$post(
          `/_/routes/generate`,
          this.routePageData
        )
        this.$cwa.saveResource(newRoute)
        await this.refreshPageResource()
        this.showRoutePage()
        await this.reloadRouteRedirects()
      } catch (error) {
        consola.error(error)
      }

      this.isLoading = false
    },
    async createRedirect() {
      const endpoint = '/_/routes'
      const data = {
        name: this.redirect,
        path: this.redirect,
        redirect: this.component['@id']
      }
      try {
        await this.$cwa.createResource(endpoint, data)
        this.showRoutePage()
        this.redirect = null
        await this.reloadRouteRedirects()
      } catch (error) {
        this.handleResourceRequestError(error, endpoint)
      }
    }
  }
})
</script>

<style lang="sass">
.admin-routes-tab
  .add-title
    display: flex
    align-items: center
  .cwa-input
    color: $white
    .not-found
      color: $cwa-color-text-light
      font-weight: $weight-semibold
      font-size: $size-5
      opacity: .6
      margin: 0 0 1rem
</style>
