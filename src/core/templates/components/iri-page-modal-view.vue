<template>
  <cwa-modal class="layout-details-page" @close="$emit('close')">
    <div class="status-bar">
      <status-icon
        :always-show-status="true"
        :show-status-text="false"
        :status="isSaved && routeIsSaved && !addingRedirect ? 1 : 0"
        :category="notificationCategories"
      />
    </div>
    <div class="title-tabs">
      <a
        href="#"
        :class="{ 'is-selected': currentTabIndex === 0 }"
        @click.prevent="changeTab(0)"
        >{{ title }}</a
      >
      <a
        href="#"
        :class="{ 'is-selected': currentTabIndex === 1 }"
        @click.prevent="changeTab(1)"
        >Routes</a
      >
    </div>
    <section v-if="currentTabIndex === 0" class="details-section">
      <div>
        <div class="columns fields-container">
          <div class="column">
            <slot name="left" />
          </div>
          <div class="column">
            <div class="right-column-aligner">
              <div>
                <slot name="right" />
              </div>
              <div v-if="!isNew" class="timestamps">
                <div>
                  Updated:
                  {{ formatDate(parseDateString(component.modifiedAt)) }} UTC
                </div>
                <div>
                  Created:
                  {{ formatDate(parseDateString(component.createdAt)) }} UTC
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="columns buttons-row">
          <div class="column">
            <button class="button is-cwa-primary" @click="$emit('submit')">
              {{ isNew ? 'Create' : 'Save' }}
            </button>
          </div>
          <div v-if="!isNew" class="column is-narrow">
            <button class="button is-dark is-delete" @click="$emit('delete')">
              Delete
            </button>
          </div>
        </div>
      </div>
      <transition name="fade">
        <div v-if="showLoader" class="cwa-loader-overlay">
          <cwa-loader />
        </div>
      </transition>
    </section>
    <section v-if="currentTabIndex === 1" class="details-section">
      <cwa-admin-routes-tab
        v-model="component"
        :notification-categories="notificationCategories"
        @input="inputListener"
        @is-saved="handleRouteIsSaved"
        @adding-redirect="handleAddingRedirect"
      />
    </section>
  </cwa-modal>
</template>

<script lang="ts">
import Vue from 'vue'
import IriModalView from './iri-modal-view.vue'
import CwaAdminRoutesTab from './admin/cwa-admin-routes-tab.vue'
export default Vue.extend({
  components: { CwaAdminRoutesTab },
  mixins: [IriModalView],
  data() {
    return {
      currentTabIndex: 0,
      routeIsSaved: true,
      addingRedirect: false
    }
  },
  methods: {
    changeTab(newIndex) {
      this.currentTabIndex = newIndex
    },
    inputListener(resource) {
      this.$emit('input', resource)
    },
    handleRouteIsSaved(routeSaved) {
      this.routeIsSaved = routeSaved
    },
    handleAddingRedirect(addingRedirect) {
      this.addingRedirect = addingRedirect
    }
  }
})
</script>

<style lang="sass">
.status-bar
  padding: .25rem
</style>
