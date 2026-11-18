<script setup lang="ts">
import { ref } from 'vue'
import { CwaUiButton, CwaUiDialog, CwaUiFormSection, CwaUiImageAlt, CwaUiImageSlots, CwaUiManagerTab } from '#components'
import { createFakeSaveServer, liveFieldModel } from './fake-save-server'
import { kitFieldSet } from './kit-field-set'

const set = kitFieldSet(createFakeSaveServer())
const alt = liveFieldModel<string>(createFakeSaveServer(), 'alt', '')
const dialogOpen = ref(false)
</script>

<template>
  <div class="kit-image-alt">
    <div
      class="kit-image-alt-bar"
      data-testid="kit-image-alt-bar"
    >
      <CwaUiManagerTab>
        <CwaUiImageAlt
          label="Image"
          :upload="set.upload"
          :alt="alt"
        />
        <CwaUiImageSlots
          label="Images"
          :slots="[{ label: 'Desktop', upload: set.upload }, { label: 'Mobile', upload: set.upload }]"
        />
        <CwaUiButton
          label="Crop"
          size="sm"
        />
      </CwaUiManagerTab>
    </div>
    <CwaUiButton
      label="Open the image dialog"
      size="sm"
      data-testid="kit-image-alt-dialog-open"
      @click="dialogOpen = true"
    />
    <CwaUiDialog
      v-if="dialogOpen"
      title="Image"
      size="md"
      data-testid="kit-image-alt-dialog"
      @close="dialogOpen = false"
    >
      <CwaUiFormSection title="Image">
        <CwaUiImageAlt
          label="Image"
          :upload="set.upload"
          :alt="alt"
        />
      </CwaUiFormSection>
    </CwaUiDialog>
  </div>
</template>

<style scoped>
.kit-image-alt {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1rem;
}

.kit-image-alt-bar {
  max-width: 100%;
  background: var(--cwa-color-surface);
  box-shadow: inset 0 0 0 1px var(--cwa-color-line);
}
</style>
