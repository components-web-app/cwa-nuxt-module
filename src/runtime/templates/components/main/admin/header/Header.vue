<template>
  <div ref="spacer" />
  <div ref="header" class="cwa-section cwa-border-0 cwa-border-b-2 cwa-fixed cwa-z-50 cwa-w-full cwa-h-18 cwa-top-0 cwa-dark-blur" :class="[highlightClass]" @click.stop>
    <div class="cwa-flex cwa-justify-between cwa-items-center">
      <div class="cwa-absolute cwa-left-1/2 cwa-top-1/2 -cwa-translate-x-1/2 -cwa-translate-y-1/2 cwa-text-center cwa-text-gray-300 cwa-z-20">
        <CwaUiFormButton v-if="!$cwa.admin.isEditing && $cwa.resources?.page?.value?.data" color="dark" class="cwa-min-w-[120px]">
          {{ $cwa.resources.page.value.data?.reference }}
        </CwaUiFormButton>
        <path-selector v-else-if="$cwa.admin.resourceManager.showManager.value" />
      </div>
      <div class="cwa-flex cwa-justify-start cwa-space-x-4">
        <CwaUiFormButton class="cwa-min-w-[100px]" color="blue" @click="$cwa.admin.toggleEdit()">
          {{ $cwa.admin.isEditing ? 'Done' : 'Edit' }}
        </CwaUiFormButton>
        <!-- this will be used when cloning a component only -->
        <CwaUiFormToggle v-if="false && $cwa.admin.isEditing" v-model="isNavEnabled" label="Enable Navigation" />
      </div>
      <div v-if="$cwa.admin.isEditing" class="flex cwa-space-x-4 cwa-items-center">
        <SpinnerTick :is-loading="isLoading" :is-pending="!!$cwa.admin.resourceManager.addResourceEvent.value?.resource" />
      </div>
    </div>
    <OutdatedContentNotice class="cwa-absolute cwa-top-full cwa-mt-1.5 cwa-left-1/2 -cwa-translate-x-1/2 cwa-z-20" />
    <ResourceLoadingIndicator class="cwa-absolute cwa-top-full cwa-left-0 cwa-z-10" />
  </div>
  <RequestErrors />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ResourceLoadingIndicator from '../_common/ResourceLoadingIndicator.vue'
import SpinnerTick from '../../../utils/SpinnerTick.vue'
import PathSelector from './_parts/PathSelector.vue'
import RequestErrors from './_parts/RequestErrors.vue'
import { useCwa } from '#imports'
import OutdatedContentNotice from '#cwa/runtime/templates/components/main/admin/header/_parts/OutdatedContentNotice.vue'

const $cwa = useCwa()

const header = ref<undefined|HTMLElement>()
const spacer = ref<undefined|HTMLElement>()

const isNavEnabled = computed({
  get: () => {
    return $cwa.admin.navigationGuardDisabled
  },
  set: (newValue: boolean) => {
    $cwa.admin.setNavigationGuardDisabled(newValue)
  }
})

const isLoading = computed(() => $cwa.resourcesManager.requestCount.value > 0)

const highlightClass = computed(() => {
  if (!$cwa.resources.isDynamicPage.value) {
    return
  }
  return 'before:cwa-content-[""] before:cwa-absolute before:cwa-top-0 before:cwa-left-0 before:cwa-w-full before:cwa-h-0.5 before:cwa-bg-yellow'
})

onMounted(() => {
  if (header.value && spacer.value) {
    spacer.value.style.height = `${header.value.clientHeight}px`
  }
})
</script>
