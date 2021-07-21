<template>
  <div v-if="resource" class="publishable-status-tab">
    <div class="row">
      <div
        v-if="isPublished && !$cwa.findDraftIri(iri)"
        class="column is-narrow"
      >
        This resource is currently live and no modifications have been made yet
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
import ComponentManagerTabMixin from '../../../../../../mixins/ComponentManagerTabMixin'
import CwaAdminToggle from '../../../input/cwa-admin-toggle.vue'
import ApiDateParserMixin from '../../../../../../mixins/ApiDateParserMixin'
import CmDatepicker from '../../input/cm-datepicker.vue'
import CmButton from '../../input/cm-button.vue'
import UpdateResourceMixin from '../../../../../../mixins/UpdateResourceMixin'
import ApiError from '../../../../../../../inc/api-error'
import { COMPONENT_MANAGER_EVENTS } from '../../../../../../events'
import { EVENTS } from '../../../../../../mixins/ComponentManagerMixin'
import UpdateResourceError from '../../../../../../../inc/update-resource-error'

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
        const emitSelectedComponent = (newIri) => {
          this.$cwa.$eventBus.$emit(
            COMPONENT_MANAGER_EVENTS.selectComponent,
            newIri
          )
        }
        let publishableIri = null
        let emitEventImmediate = false
        this.$cwa.$eventBus.$once(EVENTS.componentMounted, () => {
          if (publishableIri) {
            emitSelectedComponent(publishableIri)
          } else {
            emitEventImmediate = true
          }
        })
        const draftIri = this.$cwa.findDraftIri(this.iri) || this.iri
        publishableIri = this.$cwa.togglePublishable(draftIri, showPublished)
        if (emitEventImmediate) {
          emitSelectedComponent(publishableIri)
        }
      }
    }
  },
  methods: {
    async publishNow() {
      const publishedResource = this.$cwa.getPublishedResource(this.resource)
      try {
        await this.updateResource(
          this.iri,
          'publishedAt',
          moment.utc().toISOString(),
          this.$cwa.$storage.getCategoryFromIri(this.iri),
          publishedResource?.componentPositions || null,
          'components-manager'
        )
        this.$emit('close')
      } catch (error) {
        if (!(error instanceof UpdateResourceError)) {
          throw error
        }
      }
    }
  }
})
</script>

<style lang="sass">
// .publishable-status-tab
</style>
