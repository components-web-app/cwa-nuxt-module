<template>
  <li
    :class="[
      'notification',
      getClassByLevel(notification.level),
      { highlighted: isHighlighted }
    ]"
  >
    <p class="message">
      {{ notification.message }}
    </p>
    <div class="timestamp">
      <div v-if="notification.endpoint" class="endpoint">
        {{ notification.endpoint }}
      </div>
      <timestamp :timestamp="notification.timestamp" />
      <a href="#" class="clear-notification" @click="$emit('remove')">remove</a>
    </div>
  </li>
</template>

<script lang="ts">
import Vue from 'vue'
import type { PropType } from 'vue'

import Timestamp from '../utils/timestamp.vue'
import { TimestampedNotification, NotificationLevels } from './types'

export default Vue.extend({
  components: { Timestamp },
  props: {
    notification: {
      type: Object as PropType<TimestampedNotification>,
      required: true
    }
  },
  data() {
    return {
      isHighlighted: true
    }
  },
  mounted() {
    this.$nextTick(() => {
      setTimeout(() => {
        this.isHighlighted = false
      }, 500)
    })
  },
  methods: {
    getClassByLevel(level) {
      switch (level) {
        case NotificationLevels.ERROR:
          return 'error'
        case NotificationLevels.WARNING:
          return 'warning'
      }
      return 'info'
    }
  }
})
</script>

<style lang="sass" scoped>
li.notification
  position: relative
  border-left: 4px solid $cwa-color-primary
  padding-left: 1rem
  transition: all 1.2s
  overflow: hidden
  &.highlighted
    background: $cwa-color-primary
    color: $white
  &.error
    border-color: $color-danger
    &.highlighted
      background: $color-danger
  &.warning
    border-color: $color-warning
    &.highlighted
      background: $color-danger
  .message
    margin: 0 0 .5rem
  .endpoint
    font-weight: $weight-normal
  .timestamp
    color: $cwa-color-text-light
    font-weight: $weight-bold
    font-size: .8em
    .clear-notification
      margin-left: 1rem
</style>
