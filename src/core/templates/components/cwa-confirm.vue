<template>
  <div v-if="dialogs.length > 0" class="cwa-confirm">
    <cwa-confirm-dialog
      v-for="(dialog, index) of dialogs"
      :key="`cwa-dialoag-${index}`"
      :dialog-event="dialog"
      @close="closeModal(dialog)"
    />
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { ConfirmDialogEvent, CONFIRM_DIALOG_EVENTS } from '../../events'
import CwaConfirmDialog from './cwa-confirm-dialog.vue'

export default Vue.extend({
  components: { CwaConfirmDialog },
  data() {
    return {
      dialogs: []
    } as {
      dialogs: ConfirmDialogEvent[]
    }
  },
  mounted() {
    this.$cwa.$eventBus.$on(
      CONFIRM_DIALOG_EVENTS.confirm,
      this.handleConfirmEvent
    )
  },
  beforeDestroy() {
    this.$cwa.$eventBus.$off(
      CONFIRM_DIALOG_EVENTS.confirm,
      this.handleConfirmEvent
    )
  },
  methods: {
    closeModal({ id }) {
      const index = this.dialogs.findIndex((dialog) => dialog.id === id)
      if (index !== -1) {
        this.dialogs.splice(index, 1)
      }
    },
    handleConfirmEvent(event: ConfirmDialogEvent) {
      this.dialogs.push(event)
    }
  }
})
</script>
