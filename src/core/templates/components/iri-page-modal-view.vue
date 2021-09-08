<template>
  <cwa-modal class="layout-details-page" @close="$emit('close')">
    <div class="status-bar">
      <status-icon :status="isSaved ? 1 : 0" />
      <error-notifications :listen-categories="notificationCategories" />
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
      <div class="row fields-container">
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
      <div class="row buttons-row">
        <div class="column">
          <button @click="$emit('submit')">
            {{ isNew ? 'Create' : 'Save' }}
          </button>
        </div>
        <div v-if="!isNew" class="column is-narrow">
          <button class="is-dark is-delete" @click="$emit('delete')">
            Delete
          </button>
        </div>
      </div>
      <transition name="fade">
        <div v-if="showLoader" class="loader-overlay">
          <cwa-loader />
        </div>
      </transition>
    </section>
    <section v-if="currentTabIndex === 1" class="details-section">
      <cwa-admin-routes-tab
        v-model="component"
        :notification-categories="notificationCategories"
        @input="inputListener"
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
  extends: IriModalView,
  props: {
    value: {
      type: Object,
      required: true,
      default: null
    }
  },
  data() {
    return {
      currentTabIndex: 0
    }
  },
  methods: {
    changeTab(newIndex) {
      this.currentTabIndex = newIndex
    },
    inputListener(resource) {
      this.$emit('input', resource)
    }
  }
})
</script>
