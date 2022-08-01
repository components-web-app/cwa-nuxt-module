<template>
  <div class="collection-info-tab">
    <div class="row tab-row">
      <div class="column is-narrow">
        <div class="row">
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
          const clearComponentFromPosition = async () => {
            const loadFallback =
              this.isDynamicPage && positionResource._metadata?.static_component
            const component = loadFallback
              ? positionResource._metadata?.static_component
              : null
            if (loadFallback) {
              await this.$cwa.refreshResource(component)
            }
            const overwriteObj: any = {
              component
            }
            if (
              positionResource.component ===
              positionResource._metadata.static_component
            ) {
              overwriteObj._metadata = Object.assign(
                {},
                positionResource._metadata,
                {
                  static_component: null
                }
              )
            }
            const resource = Object.assign({}, positionResource, overwriteObj)
            await this.$cwa.$storage.setResource({
              resource
            })
          }

          if (deleteAll) {
            const refreshPageData =
              this.isDynamicPage &&
              this.getDynamicComponentIri(positionResource.pageDataProperty) ===
                this.iri

            await this.$cwa.deleteResource(this.iri)
            // refresh page data if required - so we do not have an IRI for a component that no longer exists
            if (refreshPageData) {
              await this.$cwa.refreshResource(this.$cwa.loadedPage)
            }

            if (positionResource.pageDataProperty) {
              // refresh as metadata and fallback may be available
              await clearComponentFromPosition()
            } else {
              // the API will have deleted the position
              this.$cwa.$storage.deleteResource(position)
            }
          } else if (!positionResource.pageDataProperty) {
            await this.$cwa.deleteResource(position)
          } else {
            await clearComponentFromPosition()
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
  font-size: 1.2rem
</style>
