<template>
  <div v-if="resource" class="publishable-status-tab">
    <div class="row">
      <div
        v-if="isPublished && !$cwa.findDraftIri(iri)"
        class="column is-narrow"
      >
        <div class="column is-narrow">
          <cwa-admin-toggle
            :id="`component-edit-version-${iri}`"
            v-model="forceNoDraft"
            label="Edit live version"
          />
        </div>
      </div>
      <template v-else>
        <div class="column is-narrow">
          <cwa-admin-toggle
            :id="`component-edit-version-${iri}`"
            v-model="isPublished"
            label="Edit live version"
          />
        </div>
        <template v-if="!isPublished">
          <div class="column is-narrow">
            <cm-datepicker
              :id="`component-published-at-${iri}`"
              :iri="iri"
              field="publishedAt"
              label="Publish at"
            />
          </div>
          <div class="column is-narrow">
            <cm-button @click="publishNow">Publish Now</cm-button>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import moment from 'moment'
import consola from 'consola'
import ComponentManagerTabMixin from '../../../../../../mixins/ComponentManagerTabMixin'
import CwaAdminToggle from '../../../input/cwa-admin-toggle.vue'
import ApiDateParserMixin from '../../../../../../mixins/ApiDateParserMixin'
import CmDatepicker from '../../input/cm-datepicker.vue'
import CmButton from '../../input/cm-button.vue'
import UpdateResourceMixin from '../../../../../../mixins/UpdateResourceMixin'
import UpdateResourceError from '../../../../../../../inc/update-resource-error'
import { EVENTS } from '../../../../../../mixins/ComponentManagerMixin'

export default Vue.extend({
  components: { CmButton, CmDatepicker, CwaAdminToggle },
  mixins: [ComponentManagerTabMixin, ApiDateParserMixin, UpdateResourceMixin],
  data() {
    return {
      error: null
    }
  },
  computed: {
    isPublished: {
      get() {
        return this.resource._metadata.published
      },
      set(showPublished) {
        const draftIri = this.$cwa.findDraftIri(this.iri) || this.iri
        this.$cwa.togglePublishable(draftIri, showPublished)
      }
    },
    forceNoDraft: {
      get() {
        return this.$cwa.$storage.isIriMappedToPublished(this.iri)
      },
      set(showPublished) {
        this.$cwa.togglePublishable(this.iri, showPublished)
      }
    }
  },
  methods: {
    async publishNow() {
      const publishedResource = this.$cwa.getPublishedResource(this.resource)
      try {
        // this.$emit('close', true)
        const resource = await this.updateResource(
          this.iri,
          'publishedAt',
          moment.utc().toISOString(),
          this.$cwa.$storage.getCategoryFromIri(this.iri),
          publishedResource?.componentPositions || null,
          'components-manager'
        )
        this.$cwa.$eventBus.$emit(EVENTS.selectComponent, resource['@id'])
      } catch (error) {
        if (!(error instanceof UpdateResourceError)) {
          throw error
        }
        consola.error(error)
        this.$emit('close')
      }
    }
  }
})
</script>

<style lang="sass">
// .publishable-status-tab
</style>
