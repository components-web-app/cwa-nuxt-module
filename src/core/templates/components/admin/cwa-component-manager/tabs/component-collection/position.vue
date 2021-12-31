<template>
  <div>
    <div class="row">
      <div class="column is-narrow">
        <cwa-admin-select
          id="page-data-property"
          v-model="pageDataProperty"
          label="Page data property"
          :options="pageDataPropertyOptions"
          :wrapper="wrapperComponent"
        />
      </div>
      <div class="column is-narrow">
        <cm-button
          :disabled="!pageDataProperty || submitting"
          @click="addPosition"
        >
          Add Position
        </cm-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import ApiErrorNotificationsMixin from '../../../../../../mixins/ApiErrorNotificationsMixin'
import CmButton from '../../input/cm-button.vue'
import ComponentManagerTabMixin from '../../../../../../mixins/ComponentManagerTabMixin'
import CwaAdminSelect from '../../../input/cwa-admin-select.vue'
import { EVENTS } from '../../../../../../mixins/ComponentManagerMixin'
import LoadPageDataMetadataMixin from '@cwa/nuxt-module/core/mixins/LoadPageDataMetadataMixin'

export default Vue.extend({
  components: { CmButton, CwaAdminSelect },
  mixins: [
    ComponentManagerTabMixin,
    ApiErrorNotificationsMixin,
    LoadPageDataMetadataMixin
  ],
  data() {
    return {
      wrapperComponent: async () => await import('../../input/wrapper.vue'),
      pageDataProperty: null,
      submitting: false
    }
  },
  async mounted() {
    await this.loadPageDataMetadata()
  },
  methods: {
    async addPosition() {
      this.submitting = true
      const endpoint = '/_/component_positions'
      try {
        const newPosition = await this.$cwa.createResource(
          endpoint,
          {
            componentCollection: this.resource['@id'],
            pageDataProperty: this.pageDataProperty
          },
          null,
          [this.resource['@id']]
        )
        this.$cwa.$eventBus.$emit(EVENTS.selectComponent, newPosition['@id'])
      } catch (error) {
        this.handleResourceRequestError(error, endpoint)
      } finally {
        this.submitting = false
      }
    }
  }
})
</script>
