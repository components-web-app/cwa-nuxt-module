<template>
  <cwa-modal class="layout-details-page" @close="$emit('close')">
    <div class="status-bar">
      <status-icon
        :always-show-status="true"
        :show-status-text="false"
        :status="isSaved ? 1 : 0"
        :category="notificationCategories"
      />
    </div>
    <div class="title-tabs">
      <h2>{{ title }}</h2>
    </div>
    <section class="details-section">
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
  </cwa-modal>
</template>

<script lang="ts">
import Vue from 'vue'
import ApiDateParserMixin from '../../mixins/ApiDateParserMixin'
import CwaLoader from './utils/cwa-loader.vue'
import CwaModal from './utils/cwa-modal.vue'
import StatusIcon from './admin/status-icon.vue'
import IriModalPropsMixin from './IriModalPropsMixin'

export default Vue.extend({
  components: { StatusIcon, CwaModal, CwaLoader },
  mixins: [ApiDateParserMixin, IriModalPropsMixin],
  props: {
    title: {
      type: String,
      required: true
    },
    value: {
      type: Object,
      required: true,
      default: null
    }
  },
  data() {
    return {
      component: this.value
    }
  },
  watch: {
    component: {
      handler(newValue) {
        this.$emit('input', newValue)
      },
      deep: true
    },
    value: {
      handler(newValue) {
        this.component = newValue
      },
      immediate: true
    }
  }
})
</script>

<style lang="sass">
.layout-details-page
  .status-bar
    position: absolute
    top: 1rem
    left: 1rem
    display: flex
    z-index: 201
  .title-tabs
    display: flex
    margin-bottom: 1rem
    a
      color: $white
      font-size: $size-3
      font-weight: $weight-normal
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
      font-size: .9rem
      justify-self: end
  .buttons-row
    margin-top: 1rem
    button.is-delete
      &:hover,
      &:focus
        border-color: $cwa-danger
        background: $cwa-danger
        color: $white
  .details-section
    position: relative
</style>
