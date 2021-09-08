<template>
  <div class="row fields-container">
    <transition name="fade">
      <div v-if="isLoading" class="loader-overlay">
        <cwa-loader />
      </div>
    </transition>
    <div class="column">
      <template v-if="routePageShowing === null">
        <div class="cwa-input">
          <template v-if="!component">
            <div class="not-found">No page route</div>
            <cm-button @click="showEditRoute">Create page route</cm-button>
          </template>
          <template v-else>
            <label>Page route</label>
            <div class="row">
              <span class="column is-narrow nowrap">{{ component.path }}</span>
              <div class="column">
                <a href="#" @click.prevent="showEditRoute">Edit</a>
              </div>
            </div>
          </template>
        </div>
        <div v-if="component" class="cwa-input">
          <template v-if="!hasRedirects">
            <div class="not-found">You don't have any redirects</div>
            <cm-button @click="showEditRoute">Create new redirect</cm-button>
          </template>
          <template v-else>
            <label>Redirects <cwa-add-button /></label>
            <div class="row">
              <div class="column">
                <pre>{{ component.redirectedFrom }}</pre>
              </div>
            </div>
          </template>
        </div>
      </template>
      <div v-if="routePageShowing === 'route'">
        <div class="row">
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

        <div class="row buttons-row">
          <div class="column">
            <button @click="saveRoute">
              {{ isNew ? 'Create' : 'Update' }}
            </button>
          </div>
          <div v-if="!isNew" class="column is-narrow">
            <button class="is-dark is-delete" @click="deleteComponent">
              Delete
            </button>
          </div>
        </div>

        <section v-if="generatedRoute !== savedComponent.path">
          <div class="cwa-input">
            <label>Recommended page route</label>
            <div class="row">
              <span class="column">{{ generatedRoute }}</span>
            </div>
          </div>
          <p>
            You can generate a new route based on your page title '{{
              pageComponent.title
            }}'. This is optimal for search engines and relevance. A new
            redirect will also be created from your old route.
          </p>
          <div class="row buttons-row">
            <div class="column">
              <button @click="generateRoute">Generate</button>
            </div>
          </div>
        </section>
      </div>
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

export default Vue.extend({
  components: {
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
    const pageIri = this.$cwa.currentPageIri
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
    return {
      iri,
      routePageShowing: null,
      pageComponent
    } as {
      iri: string
      routePageShowing: string
    }
  },
  computed: {
    hasRedirects() {
      return this.component.redirectedFrom?.length || null
    },
    generatedRoute() {
      return `/${slugify(this.pageComponent.title).toLowerCase()}`
    }
  },
  methods: {
    showEditRoute() {
      this.routePageShowing = 'route'
    },
    showRoutePage() {
      this.routePageShowing = null
    },
    async saveRoute() {
      await this.sendRequest(this.component)
    },
    async generateRoute() {
      this.isLoading = true
      try {
        const newRoute = await this.$axios.$post(`/_/routes/generate`, {
          pageData: this.component.pageData,
          page: this.component.page
        })
        this.$cwa.saveResource(newRoute)
        if (this.pageComponent) {
          this.pageComponent = await this.$cwa.refreshResource(
            this.pageComponent['@id']
          )
          this.$emit('input', this.pageComponent)
          this.iri = this.pageComponent.route
        }
      } catch (error) {
        consola.error(error)
      }

      this.isLoading = false
    }
  }
})
</script>

<style lang="sass">
.cwa-input
  color: $white
  .not-found
    color: $cwa-color-text-light
    font-weight: $font-weight-semi-bold
    font-size: $size-h3
    opacity: .6
    margin: 1.5rem 0 .5rem
</style>
