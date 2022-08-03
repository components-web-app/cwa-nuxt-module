<template>
  <cwa-modal class="cwa-confirm-dialog" :hide-close="true">
    <div v-if="isLoading" class="loader-overlay">
      <cwa-loader />
    </div>
    <h2>{{ dialogEvent.title || 'Confirm' }}</h2>
    <component
      :is="dialogEvent.component"
      v-if="dialogEvent.component"
      v-model="data"
      v-bind="dialogInnerData"
      @submit="handleConfirm"
    />
    <div v-if="dialogEvent.html" v-html="dialogEvent.html"></div>
    <div class="controls-bar">
      <div class="columns">
        <div class="column">
          <button class="is-dark is-delete" @click="cancel">
            {{ dialogEvent.cancelButtonText || 'Cancel' }}
          </button>
        </div>
        <div class="is-narrow">
          <button
            :class="{ 'is-loading': runningConfirmFn }"
            @click="handleConfirm"
          >
            {{ dialogEvent.confirmButtonText || 'Confirm' }}
          </button>
        </div>
      </div>
    </div>
    <transition name="fade">
      <div v-if="runningConfirmFn" class="loader-overlay">
        <cwa-loader />
      </div>
    </transition>
  </cwa-modal>
</template>

<script lang="ts">
import Vue from 'vue'
import type { PropType } from 'vue'
import { ConfirmDialogEvent } from '../../events'
import CwaModal from './utils/cwa-modal.vue'
import CwaLoader from './utils/cwa-loader.vue'

export default Vue.extend({
  components: {
    CwaLoader,
    CwaModal
  },
  props: {
    dialogEvent: {
      type: Object as PropType<ConfirmDialogEvent>,
      required: true
    }
  },
  data() {
    return {
      runningConfirmFn: false,
      data: {},
      asyncData: null,
      isLoading: false
    }
  },
  computed: {
    dialogInnerData() {
      if (!this.asyncData && !this.dialogEvent.componentProps) {
        return null
      }
      return Object.assign(
        {},
        this.dialogEvent.componentProps || {},
        this.asyncData || {}
      )
    }
  },
  async mounted() {
    if (this.dialogEvent.asyncData) {
      this.isLoading = true
      this.asyncData = await this.dialogEvent.asyncData()
      this.isLoading = false
    }
  },
  methods: {
    async handleConfirm() {
      if (this.dialogEvent.onSuccess) {
        this.runningConfirmFn = true
        await this.dialogEvent.onSuccess(this.data)
        this.runningConfirmFn = false
      }
      this.close()
    },
    async cancel() {
      if (this.dialogEvent.onCancel) {
        this.runningConfirmFn = true
        await this.dialogEvent.onCancel(this.data)
        this.runningConfirmFn = false
      }
      this.close()
    },
    close() {
      this.$emit('close')
    }
  }
})
</script>

<style lang="sass">
.cwa-confirm-dialog
  .controls-bar
    border-top: 1px solid $cwa-grid-item-border-color
    padding: 3rem 3rem 0
    margin-left: -3rem
    margin-right: -3rem
  &.cwa-modal .modal-content
    max-width: 600px
    box-shadow: 0 0 35px 8px rgba($cwa-danger, .6)
    .modal-card
      padding-top: 3rem
      .close-bar
        display: none
      .modal-card-inner
        max-width: 100%
        margin-bottom: 3rem
        b,
        strong,
        .warning
          color: $white
        .warning
          display: flex
          align-content: center
          align-items: center
</style>
