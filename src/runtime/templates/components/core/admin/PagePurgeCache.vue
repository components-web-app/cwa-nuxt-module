<template>
  <div
    v-if="body"
    class="cwa:flex cwa:flex-wrap cwa:items-center cwa:gap-x-4 cwa:gap-y-2"
  >
    <CwaUiButton
      label="Purge this page's cache"
      :loading="purging"
      @click="purge"
    />
    <span
      role="status"
      data-testid="page-purge-result"
      class="cwa:text-helper"
      :class="result && !result.success ? 'cwa:text-danger-fg' : 'cwa:text-fg-muted'"
    >{{ result?.message }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCwa, useNuxtApp } from '#imports'
import { pageCachePurgeBody } from '#cwa/admin/page-cache-purge'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'

const $cwa = useCwa()
const vueApp = useNuxtApp().vueApp

const body = computed(() => pageCachePurgeBody($cwa.resources.displayResourceTree))
const purging = ref(false)
const result = ref<{ success: boolean, message: string }>()

function failureMessage(error: unknown) {
  const statusCode = (error as { statusCode?: number } | undefined)?.statusCode
  if (statusCode === 401 || statusCode === 403) {
    return 'This page\'s cache could not be purged: your account does not have permission to do this.'
  }
  if (statusCode === 501) {
    return 'Nothing was purged. This deployment\'s cache cannot purge single pages.'
  }
  if (statusCode === 422) {
    return 'Nothing was purged. The API did not accept this page\'s cache tags.'
  }
  return `This page's cache could not be purged (${statusCode || 'network error'}). Please try again.`
}

async function purge() {
  if (purging.value) {
    return
  }
  const { confirmResourceAction } = await import('#cwa/admin/resource-confirm')
  const confirmed = await confirmResourceAction(vueApp, {
    title: 'Purge this page\'s cache?',
    description: 'This page\'s cached copy and the API data it is built from will be dropped and rebuilt on its next visit. Pages sharing its layout or components are rebuilt too. No content will be lost.',
    keep: 'Cancel',
    go: 'Purge cache',
    tone: 'accent',
  })
  if (!confirmed || !body.value) {
    return
  }
  result.value = undefined
  purging.value = true
  try {
    await $cwa.siteConfig.purgeHttpCache(body.value)
    result.value = { success: true, message: 'This page\'s cache has been purged. It will be rebuilt on its next visit.' }
  }
  catch (error) {
    result.value = { success: false, message: failureMessage(error) }
  }
  finally {
    purging.value = false
  }
}
</script>
