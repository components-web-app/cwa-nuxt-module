<template>
  <div class="publishable-status-tab">
    <div class="columns tab-row">
      <!--
      live exists, no draft,
      Draft exists, no live,
      Live exists and draft exists

      Draft should show the ability for a publish date
      Draft will be showing by default, should be a way to edit the live version instead is it exists
      -->
      <div v-if="isPublished && $cwa.findDraftIri(iri) === null">
        Published component. No draft available.
      </div>
      <template v-else>
        <div
          v-if="$cwa.findPublishedIri(iri) && $cwa.findDraftIri(iri)"
          class="column is-narrow"
        >
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
              :refresh-endpoints="refreshEndpoints"
              field="publishedAt"
              label="Publish at"
            />
          </div>
          <div class="column is-narrow">
            <cm-button @click="publishIri">Publish Now</cm-button>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import ComponentManagerTabMixin from '../../../../../../mixins/ComponentManagerTabMixin'
import CwaAdminToggle from '../../../input/cwa-admin-toggle.vue'
import ApiDateParserMixin from '../../../../../../mixins/ApiDateParserMixin'
import CmDatepicker from '../../input/cm-datepicker.vue'
import CmButton from '../../input/cm-button.vue'
import UpdateResourceMixin from '../../../../../../mixins/UpdateResourceMixin'

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
        return this.resource._metadata.publishable?.published || false
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
    },
    refreshEndpoints() {
      const publishedResource = this.$cwa.getPublishedResource(this.resource)
      return publishedResource?.componentPositions || null
    }
  },
  methods: {
    publishIri() {
      this.publishNow(this.iri)
    }
  }
})
</script>

<style lang="sass">
// .publishable-status-tab
</style>
