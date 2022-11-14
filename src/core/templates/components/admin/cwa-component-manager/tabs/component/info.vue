<template>
  <div class="collection-info-tab">
    <div class="columns tab-row">
      <div class="column is-narrow">
        <div class="columns">
          <div class="column is-narrow">
            <info :id="inputId('id')" label="id" :value="iri" />
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
      <div v-if="resource.createdAt || resource.modifiedAt" class="column">
        <info
          v-if="resource.createdAt"
          :id="inputId('createdAt')"
          label="created"
          :value="formatDate(parseDateString(resource.createdAt))"
        />
        <info
          v-if="resource.modifiedAt"
          :id="inputId('modifiedAt')"
          label="modified"
          :value="formatDate(parseDateString(resource.modifiedAt))"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import Info from '../../input/info.vue'
import ApiDateParserMixin from '../../../../../../mixins/ApiDateParserMixin'
import ComponentManagerTabMixin from '../../../../../../mixins/ComponentManagerTabMixin'
import PageResourceUtilsMixin from '../../../../../../mixins/PageResourceUtilsMixin'
import {
  CONFIRM_DIALOG_EVENTS,
  ConfirmDialogEvent
} from '@cwa/nuxt-module/core/events'

export default Vue.extend({
  name: 'CwaComponentInfo',
  components: { Info },
  mixins: [
    ComponentManagerTabMixin,
    ApiDateParserMixin,
    PageResourceUtilsMixin
  ],
  methods: {
    deleteComponent() {
      const event: ConfirmDialogEvent = {
        id: 'confirm-delete-component',
        title: 'Confirm Delete',
        component: () =>
          import('./dialogs/confirm-delete-component-dialog.vue'),
        componentProps: {
          iri: this.iri
        },
        asyncData: async () => {
          const usageMetadata = await this.$axios.$get(this.iri + '/usage')
          return {
            usageMetadata
          }
        },
        onSuccess: async ({ deleteAll }) => {
          const position = this.context.componentPosition
          const positionResource = this.$cwa.getResource(position)

          if (!deleteAll) {
            if (
              !positionResource.pageDataProperty &&
              !this.resource.publishedResource
            ) {
              // delete position with API
              await this.$cwa.deleteResource(position)
              return
            }
            await this.$cwa.refreshPositionsForComponent(this.iri)
            return
          }

          const refreshPageData =
            this.isDynamicPage &&
            this.getDynamicComponentIri(positionResource.pageDataProperty) ===
              this.iri

          await this.$cwa.deleteResource(this.iri)
          // refresh page data if required - so we do not have an IRI for a component that no longer exists
          if (refreshPageData) {
            await this.$cwa.refreshResource(this.$cwa.loadedPage)
          }

          if (
            positionResource.pageDataProperty ||
            !!this.resource.publishedResource
          ) {
            // refresh as metadata and fallback may be available
            await this.$cwa.refreshPositionsForComponent(this.iri)
          } else {
            // the API will have deleted the position
            this.$cwa.$storage.deleteResource(position)
          }
        },
        confirmButtonText: 'Delete'
      }

      this.$cwa.$eventBus.$emit(CONFIRM_DIALOG_EVENTS.confirm, event)
    }
  }
})
</script>

<style lang="sass">
.collection-info-tab
  font-size: .75rem
</style>
