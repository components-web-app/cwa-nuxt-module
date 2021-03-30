<template>
  <div :class="['status-icon', className]" />
</template>

<script lang="ts">
import { STATUS_EVENTS, StatusEvent, ResetStatusEvent } from '../../../events'

export default {
  props: {
    status: {
      type: Number,
      required: false,
      default: 99
    },
    category: {
      type: String,
      required: false,
      default: null
    }
  },
  data() {
    return {
      fieldStatuses: {}
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
    handleStatusNotification(event: StatusEvent) {
      if (!this.category) {
        return
      }
      if (this.category === event.category) {
        this.$set(this.fieldStatuses, event.field, event.status)
      }
    },
    resetStatus(event: ResetStatusEvent) {
      if (this.category === event.category) {
        this.fieldStatuses = {}
      }
    }
  }
}
</script>

<style lang="sass">
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
