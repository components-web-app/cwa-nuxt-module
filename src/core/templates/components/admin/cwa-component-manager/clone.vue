<template>
  <div class="clone-info">
    <div class="row row-no-padding row-center">
      <div class="column is-narrow cloning-label">Cloning:</div>
      <div class="column">
        <button
          class="button button-cwa clone-component-button"
          @click="() => {}"
        >
          <resource-locations
            :name="cloneComponent.data.name"
            :iri="cloneComponent.iri"
          />
        </button>
      </div>
      <div v-if="cloneComponent && cloneDestination" class="column is-narrow">
        <cm-button
          class="clone-button"
          :alt-options="cloneButtonOptions"
          @click="handleCloneClick"
        >
          {{ cloneDestinationIsCollection ? 'Clone Here' : 'Clone After' }}
        </cm-button>
      </div>
      <div class="column is-narrow">
        <button class="button button-cwa" @click="cancelClone">Cancel</button>
      </div>
    </div>
    <div class="bottom-content row">
      <div class="column is-narrow">
        <cwa-admin-toggle
          id="cwa-cm-clone-navigate"
          v-model="cloneNavigate"
          label="Enable links"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import CwaAdminToggle from '../input/cwa-admin-toggle.vue'
import CloneComponentMixin from '../../../../mixins/CloneComponentMixin'
import ResourceLocations from './resource-locations.vue'
import CmButton from '@cwa/nuxt-module/core/templates/components/admin/cwa-component-manager/input/cm-button.vue'

export default Vue.extend({
  components: { CmButton, ResourceLocations, CwaAdminToggle },
  mixins: [CloneComponentMixin],
  computed: {
    cloneButtonOptions() {
      if (this.cloneDestinationIsCollection) {
        return null
      }
      return [
        {
          key: 'before',
          label: 'Clone Before'
        }
      ]
    }
  },
  methods: {
    handleCloneClick(clickKey) {
      clickKey = clickKey || 'default'
      this.clone(clickKey === 'before')
    }
  }
})
</script>

<style lang="sass">
.clone-info
  .cloning-label,
  .clone-component-button
    font-size: .9em
  .clone-component-button
    border-radius: 25px
    margin-left: .75rem
  .bottom-content
    padding: 1.5rem 2rem 0.75rem
    min-height: 60px
  .clone-button
    margin-right: .75rem
</style>
