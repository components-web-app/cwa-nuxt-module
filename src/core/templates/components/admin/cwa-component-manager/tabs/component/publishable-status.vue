<template>
  <div class="publishable-status-tab">
    <div class="row">
      <div class="column is-narrow">
        <cwa-admin-toggle
          :id="`component-edit-version-${resource['@id']}`"
          v-model="forceLive"
          label="Edit live version"
        />
      </div>
      <template v-if="!forceLive && !resource._metadata.published">
        <div class="column is-narrow">
          <cm-datepicker
            :id="`component-published-at-${resource['@id']}`"
            :iri="resource['@id']"
            field="publishedAt"
            label="Publish at"
          />
        </div>
        <div class="column is-narrow">
          <cm-button @click="publishNow">Publish Now</cm-button>
          {{ error }}
        </div>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import moment from 'moment'
import ComponentManagerTabMixin from '../../../../../../mixins/ComponentManagerTabMixin'
import CwaAdminToggle from '../../../input/cwa-admin-toggle.vue'
import ApiDateParserMixin from '../../../../../../mixins/ApiDateParserMixin'
import CmDatepicker from '../../input/cm-datepicker.vue'
import CmButton from '../../input/cm-button.vue'
import UpdateResourceMixin from '../../../../../../mixins/UpdateResourceMixin'
import UpdateResourceError from '../../../../../../../inc/update-resource-error'

export default {
  components: { CmButton, CmDatepicker, CwaAdminToggle },
  mixins: [ComponentManagerTabMixin, ApiDateParserMixin, UpdateResourceMixin],
  data() {
    return {
      forceLive: false,
      error: null
    }
  },
  methods: {
    async publishNow() {
      const iri = this.resource['@id']
      try {
        await this.updateResource(
          iri,
          'publishedAt',
          moment.utc().toISOString(),
          this.$cwa.$storage.getCategoryFromIri(iri),
          [],
          'components-manager'
        )
      } catch (error) {
        if (!(error instanceof UpdateResourceError)) {
          throw error
        }
        this.error = error.message
      }
    }
  }
}
</script>

<style lang="sass">
// .publishable-status-tab
</style>
