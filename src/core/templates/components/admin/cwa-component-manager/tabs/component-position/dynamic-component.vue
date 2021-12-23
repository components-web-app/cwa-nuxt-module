<template>
  <div class="dynamic-component-tab">
    <div class="row">
      <div class="column">
        <p>
          If a page data property is defined, when this page is loaded via page
          data, it will look for that property and populate this position with
          that component if it exists.
        </p>
      </div>
    </div>
    <div class="row">
      <div class="column is-narrow">
        <cm-select
          :id="`page-data-prop-${iri}`"
          :iri="iri"
          field="pageDataProperty"
          label="Page data property"
          :options="pageDataPropertyOptions"
        />
      </div>
    </div>
    <template v-if="dynamicComponentIri">
      <div class="row">
        <div class="column is-narrow">
          <div class="row">
            <div class="column is-narrow">
              <info
                :id="inputId('dynamic-iri')"
                label="Component"
                :value="dynamicComponentIri"
              />
            </div>
            <div class="column">
              <a href="#" class="trash-link" @click.prevent="deleteComponent">
                <img
                  src="../../../../../../assets/images/icon-trash.svg"
                  alt="Trash Icon"
                />
              </a>
            </div>
          </div>
        </div>
      </div>
      <div class="row">
        <div class="column is-narrow cm-button">
          <button
            type="button"
            class="cm-button-button"
            @click="selectDynamicComponent"
          >
            Select component
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { EVENTS } from '@cwa/nuxt-module/core/mixins/ComponentManagerMixin'
import {
  CONFIRM_DIALOG_EVENTS,
  ConfirmDialogEvent
} from '@cwa/nuxt-module/core/events'
import ComponentManagerTabMixin from '../../../../../../mixins/ComponentManagerTabMixin'
import CmSelect from '../../input/cm-select.vue'
import Info from '../../input/info.vue'

export default Vue.extend({
  components: { CmSelect, Info },
  mixins: [ComponentManagerTabMixin],
  data() {
    return {
      loadingProperties: false,
      pageMetadatas: null
    }
  },
  computed: {
    dynamicComponentIri() {
      return this.pageResource[this.resource.pageDataProperty]
    },
    pageResource() {
      return this.$cwa.getResource(this.$cwa.currentPageIri)
    },
    pageDataPropertyOptions() {
      if (!this.pageMetadatas) {
        return []
      }
      const ops = [
        {
          value: null,
          label: 'None'
        }
      ]
      for (const pageData of this.pageMetadatas['hydra:member']) {
        for (const propertyMetadata of pageData.properties) {
          ops.push({
            value: propertyMetadata.property,
            label: propertyMetadata.property
          })
        }
      }
      return ops
    }
  },
  async mounted() {
    this.loadingProperties = true
    this.pageMetadatas = await this.$axios.$get('/_/page_data_metadatas')
    this.loadingProperties = true
  },
  methods: {
    selectDynamicComponent() {
      this.$cwa.$eventBus.$emit(
        EVENTS.selectComponent,
        this.dynamicComponentIri
      )
    },
    deleteComponent() {
      const event: ConfirmDialogEvent = {
        id: 'confirm-delete-component',
        title: 'Confirm Delete',
        component: () =>
          import('./dialogs/confirm-delete-component-dialog.vue'),
        componentProps: {
          iri: this.iri
        },
        onSuccess: async () => {
          await this.$cwa.deleteResource(this.dynamicComponentIri)
        },
        confirmButtonText: 'Delete'
      }
      this.$cwa.$eventBus.$emit(CONFIRM_DIALOG_EVENTS.confirm, event)
    }
  }
})
</script>

<style lang="sass">
// .dynamic-component-tab
</style>
