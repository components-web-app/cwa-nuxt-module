<template>
  <div class="collection-info-tab">
    <div class="row">
      <div class="column is-narrow">
        <div class="row">
          <div class="column is-narrow">
            <info :id="inputId('id')" label="id" :value="iri" />
          </div>
          <div class="column">
            <a href="#" class="trash-link" @click.prevent="deletePosition">
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
import {
  CONFIRM_DIALOG_EVENTS,
  ConfirmDialogEvent
} from '@cwa/nuxt-module/core/events'
import Info from '../../input/info.vue'
import ApiDateParserMixin from '../../../../../../mixins/ApiDateParserMixin'
import ComponentManagerTabMixin from '../../../../../../mixins/ComponentManagerTabMixin'

export default Vue.extend({
  components: { Info },
  mixins: [ComponentManagerTabMixin, ApiDateParserMixin],
  methods: {
    deletePosition() {
      const event: ConfirmDialogEvent = {
        id: 'confirm-delete-position',
        title: 'Confirm Delete',
        component: () => import('./dialogs/confirm-delete-position-dialog.vue'),
        componentProps: {
          iri: this.iri
        },
        onSuccess: async () => {
          await this.$cwa.deleteResource(this.iri)
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
