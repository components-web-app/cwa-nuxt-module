<template>
  <div :class="['publishable-icon', { 'is-scheduled': isScheduled }]">
    <draft-icon v-if="isDraft" />
    <img
      v-else
      src="../../../../assets/images/icon-live.png"
      alt="Live icon"
      title="Published component"
    />
  </div>
</template>

<script>
import DraftIcon from '../../../../assets/images/icon-draft.svg?inline'
export default {
  components: { DraftIcon },
  props: {
    isDraft: {
      type: Boolean,
      required: true
    },
    isScheduled: {
      type: Boolean,
      required: false,
      default: false
    }
  }
}
</script>

<style lang="sass">
$draft-orange: #FFAA00
@keyframes scheduled
  0%
    color: $draft-orange
  50%
    color: $cwa-success
  100%
    color: $draft-orange

.publishable-icon
  color: $draft-orange
  &.is-scheduled
    animation: scheduled 2s infinite
  img,
  svg
    display: block
    width: 20px
</style>
