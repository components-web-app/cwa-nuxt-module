<template>
  <li :class="['notification', getClassByLevel(notification.level), {highlighted: isHighlighted} ]">
    <p class="message">{{ notification.message }}</p>
    <div class="timestamp">
      <div v-if="notification.endpoint" class="endpoint">{{ notification.endpoint }}</div>
      <timestamp  :timestamp="notification.timestamp" />
      <a href="#" @click="$emit('remove')" class="clear-notification">remove</a>
    </div>

  </li>
</template>

<script lang="ts">
import {Notification, NotificationLevels} from "./types";
import { PropType } from 'vue'
import Timestamp from "../../timestamp.vue";

export default {
  components: { Timestamp },
  props: {
    notification: {
      type: Object as PropType<Notification>,
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
      switch(level) {
        case NotificationLevels.ERROR:
          return 'error'
        case NotificationLevels.WARNING:
          return 'warning'
      }
      return 'info'
    }
  }
}
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
    font-weight: $font-weight-normal
  .timestamp
    color: $cwa-color-text-light
    font-weight: $font-weight-bold
    font-size: .8em
    .clear-notification
      margin-left: 1rem
</style>
