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
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import ComponentManagerTabMixin from '../../../../../../mixins/ComponentManagerTabMixin'
import CwaAdminToggle from '../../../input/cwa-admin-toggle.vue'
import ApiDateParserMixin from '../../../../../../mixins/ApiDateParserMixin'
import CmDatepicker from '../../input/cm-datepicker.vue'

export default {
  components: { CmDatepicker, CwaAdminToggle },
  mixins: [ComponentManagerTabMixin, ApiDateParserMixin],
  data() {
    return {
      forceLive: false
    }
  }
}
</script>

<style lang="sass">
// .publishable-status-tab
</style>
