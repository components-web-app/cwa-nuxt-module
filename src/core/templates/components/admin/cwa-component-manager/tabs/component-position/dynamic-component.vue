<template>
  <div class="dynamic-component-tab">
    <div class="columns">
      <div class="column is-narrow">
        <cm-select
          :id="`page-data-prop-${iri}`"
          :iri="iri"
          field="pageDataProperty"
          label="Component reference"
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
            class="button cm-button-button"
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
import ComponentManagerTabMixin from '../../../../../../mixins/ComponentManagerTabMixin'
import CmSelect from '../../input/cm-select.vue'
import Info from '../../input/info.vue'
import { EVENTS } from '@cwa/nuxt-module/core/mixins/ComponentManagerMixin'
import {
  CONFIRM_DIALOG_EVENTS,
  ConfirmDialogEvent
} from '@cwa/nuxt-module/core/events'
import LoadPageDataMetadataMixin from '@cwa/nuxt-module/core/mixins/LoadPageDataMetadataMixin'

export default Vue.extend({
  components: { CmSelect, Info },
  mixins: [ComponentManagerTabMixin, LoadPageDataMetadataMixin],
  computed: {
    dynamicComponentIri() {
      return this.pageResource[this.resource.pageDataProperty]
    },
    pageResource() {
      return this.$cwa.getResource(this.$cwa.loadedPage)
    }
  },
  async mounted() {
    await this.loadPageDataMetadata()
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
