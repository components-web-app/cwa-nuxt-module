<template>
  <div
    v-if="body"
    class="cwa:flex cwa:items-center cwa:gap-x-4"
  >
    <CwaUiFormButton
      :disabled="purging"
      @click="purge"
    >
      {{ purging ? 'Purging…' : 'Purge this page\'s cache' }}
    </CwaUiFormButton>
    <span
      v-if="result"
      class="cwa:text-sm cwa:font-bold"
      :class="{ 'cwa:text-danger': !result.success }"
    >{{ result.message }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCwa, useNuxtApp } from '#imports'
import { createConfirmDialog } from '#cwa/admin/confirm-dialog'
import { pageCachePurgeBody } from '#cwa/admin/page-cache-purge'
import ConfirmDialog from '#cwa/templates/components/core/ConfirmDialog.vue'

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
  const dialog = await createConfirmDialog(vueApp, ConfirmDialog)
  const { isCanceled } = await dialog.reveal({
    title: 'Purge this page\'s cache?',
    content: '<p>This page\'s cached copy and the API data it is built from will be dropped and rebuilt on its next visit. Pages sharing its layout or components are rebuilt too. No content will be lost.</p>',
  })
  if (isCanceled || !body.value) {
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
