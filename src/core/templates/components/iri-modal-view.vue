<template>
  <cwa-modal class="layout-details-page" @close="$emit('close')">
    <div class="status-bar">
      <status-icon :status="isSaved ? 1 : 0" />
      <error-notifications :listen-categories="notificationCategories" />
    </div>
    <div class="title-tabs">
      <h2>{{ title }}</h2>
    </div>
    <section class="details-section">
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
  </cwa-modal>
</template>

<script lang="ts">
import Vue from 'vue'
import ApiDateParserMixin from '../../mixins/ApiDateParserMixin'
import CwaLoader from './utils/cwa-loader.vue'
import CwaModal from './utils/cwa-modal.vue'
import StatusIcon from './admin/status-icon.vue'
import ErrorNotifications from './admin/error-notifications.vue'
import IriModalPropsMixin from './IriModalPropsMixin'

export default Vue.extend({
  components: { ErrorNotifications, StatusIcon, CwaModal, CwaLoader },
  mixins: [ApiDateParserMixin, IriModalPropsMixin],
  props: {
    title: {
      type: String,
      required: true
    },
    component: {
      type: Object,
      required: true
    }
  }
})
</script>

<style lang="sass">
.layout-details-page
  .status-bar
    position: absolute
    top: 2rem
    left: 2rem
    display: flex
  .title-tabs
    display: flex
    a
      color: $white
      font-size: $size-h2
      font-weight: $font-weight-light
      opacity: .6
      &:not(:last-child)
        margin-right: 1.25rem
      &:hover,
      &.is-selected
        opacity: 1
        color: $white
  .fields-container
    .right-column-aligner
      display: flex
      flex-direction: column
      height: 100%
      justify-content: space-between
    .timestamps
      margin-top: 1rem
      text-align: right
      color: $cwa-color-text-light
      font-size: 1.3rem
      justify-self: end
  .buttons-row
    margin-top: 2.5rem
    button.is-delete
      &:hover,
      &:focus
        border-color: $cwa-danger
        background: $cwa-danger
        color: $white
  .details-section
    position: relative
</style>
