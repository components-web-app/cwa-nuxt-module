<template>
  <div class="static-component-tab">
    <div class="columns">
      <div class="column is-narrow">
        <!-- IF A DYNAMIC PAGE -->
        <div v-if="isDynamicPage">
          <template v-if="staticComponentIri">
            <template v-if="resource.component !== staticComponentIri">
              <p>
                A default component exists and will be loaded if page data does
                not exist
              </p>
            </template>
            <template v-else>
              <p>
                The static component is loaded. No dynamic component is
                overriding it.
              </p>
              <div>
                <button
                  type="button"
                  class="button"
                  @click="selectStaticComponent"
                >
                  Select component
                </button>
              </div>
            </template>
          </template>
          <p v-else>No static component is defined.</p>
          <nuxt-link
            class="button"
            :to="{
              name: '_cwa_page_iri',
              params: { iri: pageResource.page, cwa_force: true }
            }"
          >
            Go to page template
          </nuxt-link>
        </div>
        <!-- IF A TEMPLATE PAGE -->
        <div v-else>
          <div v-if="staticComponentIri" class="columns is-vcentered">
            <div class="column is-narrow">
              <button
                type="button"
                class="button"
                @click="selectStaticComponent"
              >
                Select component
              </button>
            </div>
            <div class="column is-narrow">
              <span class="fallback">
                *A component already exists in this position
              </span>
            </div>
          </div>
          <template v-else>
            <cwa-admin-select
              id="component"
              v-model="selectedComponent"
              label="Add"
              :options="componentOptions"
              :wrapper="wrapperComponent"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { EVENTS } from '../../../../../../mixins/ComponentManagerMixin'
import CreateNewComponentEventMixin from '../../../../../../mixins/CreateNewComponentEventMixin'
import ComponentManagerTabMixin from '../../../../../../mixins/ComponentManagerTabMixin'
import FetchComponentsMixin from '../../../../../../mixins/FetchComponentsMixin'
import CwaAdminSelect from '../../../input/cwa-admin-select.vue'
import PageResourceUtilsMixin from '../../../../../../mixins/PageResourceUtilsMixin'
import { COMPONENT_MANAGER_EVENTS } from '@cwa/nuxt-module/core/events'

export default Vue.extend({
  components: { CwaAdminSelect },
  mixins: [
    ComponentManagerTabMixin,
    FetchComponentsMixin,
    CreateNewComponentEventMixin,
    PageResourceUtilsMixin
  ],
  data() {
    return {
      selectedComponent: null,
      wrapperComponent: async () => await import('../../input/wrapper.vue')
    }
  },
  computed: {
    componentOptions() {
      if (!this.availableComponents) {
        return []
      }
      return Object.keys(this.availableComponents)
    },
    staticComponentIri() {
      return this.$cwa.getPublishableIri(
        this.resource._metadata.staticComponent
      )
    },
    dynamicComponentIri() {
      return this.pageResource[this.resource.pageDataProperty]
    },
    isDynamicLoaded() {
      return this.dynamicComponentIri === this.resource.component
    }
  },
  watch: {
    async selectedComponent(newComponent: string) {
      if (!newComponent) {
        return
      }
      const event = await this.createNewComponentEvent(
        newComponent,
        null,
        this.resource['@id']
      )
      this.$cwa.$eventBus.$emit(COMPONENT_MANAGER_EVENTS.newComponent, event)
      this.selectedComponent = null
      // select 1st tab again
    }
  },
  methods: {
    selectStaticComponent() {
      this.$cwa.$eventBus.$emit(EVENTS.selectComponent, this.staticComponentIri)
      this.$emit('showTab', 0)
    }
  }
})
</script>

<style lang="sass">
.static-component-tab
 .fallback
   font-size: .8em
</style>
