<template>
  <div class="clone-info cwa-manager-tabs columns is-gapless">
    <div class="main column">
      <div class="main-manager-section">
        <div class="columns tabs-top">
          <div class="column is-narrow cloning-label">Cloning:</div>
          <div class="column">
            <button
              class="button is-cwa clone-component-button"
              type="button"
              @click="goToCloneFromPath"
            >
              <resource-locations
                :name="cloneComponent.data.name"
                :iri="cloneComponent.iri"
              />
            </button>
          </div>
          <div
            v-if="cloneComponent && cloneDestination"
            class="column is-narrow"
          >
            <cm-button
              class="clone-button is-primary"
              :alt-options="cloneButtonOptions"
              @click="handleCloneClick"
            >
              {{ cloneDestinationIsCollection ? 'Clone Here' : 'Clone After' }}
            </cm-button>
          </div>
          <div class="column is-narrow">
            <button class="button is-cwa" @click="cancelClone">Cancel</button>
          </div>
        </div>
        <div class="tab-content-container">
          <div class="tab-content">
            <div class="columns tab-row is-vcentered">
              <div class="column is-narrow">
                <cwa-admin-toggle
                  id="cwa-cm-clone-navigate"
                  v-model="cloneNavigate"
                  label="Enable links"
                />
              </div>
              <div class="column is-narrow">
                <cwa-nuxt-link to="/_cwa/pages" class="button">
                  View All Pages
                </cwa-nuxt-link>
              </div>
            </div>
          </div>
        </div>
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
    },
    goToCloneFromPath() {
      this.$router.push(this.cloneFromPath)
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
</style>
