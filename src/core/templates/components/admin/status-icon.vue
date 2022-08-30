<template>
  <div
    class="columns is-centered is-vcentered is-gapless status-icon-container"
  >
    <span
      v-if="showStatusText && autoStatus <= 0"
      class="column is-narrow not-saved-text"
    >
      Not saved...
    </span>
    <div v-if="alwaysShowStatus || !errorsShowing" class="column is-narrow">
      <div :class="['status-icon', className]" />
    </div>
    <div v-show="errorsShowing" class="column is-narrow">
      <error-notifications
        :listen-categories="categoriesAsArray"
        :show-above="showAbove"
        @showing="handleErrorsShowing"
      />
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { STATUS_EVENTS, StatusEvent, ResetStatusEvent } from '../../../events'
import ErrorNotifications from './error-notifications.vue'

export default Vue.extend({
  components: { ErrorNotifications },
  props: {
    alwaysShowStatus: {
      type: Boolean,
      default: false
    },
    showStatusText: {
      type: Boolean,
      default: true
    },
    status: {
      type: Number,
      required: false,
      default: 99
    },
    category: {
      type: [String, Array],
      required: false,
      default: null
    },
    showAbove: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      fieldStatuses: {},
      errorsShowing: false
    }
  },
  computed: {
    className() {
      if (this.autoStatus === 1) {
        return 'is-success'
      }
      if (this.autoStatus === -1) {
        return 'is-error'
      }
      if (this.autoStatus === 0) {
        return 'is-warning'
      }
      return null
    },
    objectFieldStatus() {
      let status = 99
      for (const fieldStatus of Object.values(
        this.fieldStatuses
      ) as Array<number>) {
        if (fieldStatus < status) {
          status = fieldStatus
        }
      }
      return status
    },
    autoStatus() {
      return Math.min(this.objectFieldStatus, this.status)
    },
    categoriesAsArray() {
      if (Array.isArray(this.category)) {
        return this.category
      }
      return [this.category]
    }
  },
  mounted() {
    this.$cwa.$eventBus.$on(STATUS_EVENTS.change, this.handleStatusNotification)
    this.$cwa.$eventBus.$on(STATUS_EVENTS.reset, this.resetStatus)
  },
  beforeDestroy() {
    this.$cwa.$eventBus.$off(
      STATUS_EVENTS.change,
      this.handleStatusNotification
    )
    this.$cwa.$eventBus.$off(STATUS_EVENTS.reset, this.resetStatus)
  },
  methods: {
    handleErrorsShowing(newValue) {
      this.errorsShowing = newValue
      this.$emit('errorsShowing', newValue)
    },
    handleStatusNotification(event: StatusEvent) {
      if (!this.category) {
        return
      }
      if (this.categoriesAsArray.includes(event.category)) {
        this.$set(this.fieldStatuses, event.field, event.status)
      }
    },
    resetStatus(event: ResetStatusEvent) {
      if (this.category === event.category) {
        this.fieldStatuses = {}
      }
    }
  }
})
</script>

<style lang="sass">
.status-icon-container
  > .column:not(:last-child)
    padding-right: .5rem !important
  .not-saved-text
    color: $cwa-color-text-light
.status-icon
  width: 20px
  height: 20px
  border-radius: 50%
  background-clip: content-box
  border: 3px solid transparent
  background-color: $cwa-color-text-light
  box-shadow: 0 0 0 1px $cwa-color-text-light
  &.is-success
    background-color: $cwa-success
    box-shadow: 0 0 0 1px $cwa-success
  &.is-warning
    background-color: $cwa-warning
    box-shadow: 0 0 0 1px $cwa-warning
  &.is-error
    background-color: $cwa-danger
    box-shadow: 0 0 0 1px $cwa-danger
</style>
