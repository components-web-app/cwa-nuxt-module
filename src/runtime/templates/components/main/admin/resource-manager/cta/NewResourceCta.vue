<script lang="ts" setup>
import { computed, ref } from 'vue'
import { consola } from 'consola'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { useCwa } from '#cwa/composables/cwa'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import type { MenuEntry, MenuItem } from '#cwa/templates/components/core/ui/menu-entries'
import { useCwaToast } from '#cwa/composables/cwa-toast'
import { heldFields, moveHeldUploads, sendHeldUpload } from '#cwa/admin/held-uploads'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'

const props = defineProps<{
  currentIri: string
  resource: CwaResource
}>()

const $cwa = useCwa()
const toast = useCwaToast()

const addingMeta = computed(() => props.resource?._metadata.adding)
const isPublishable = computed(() => addingMeta.value?.isPublishable)
const isAdding = ref(false)

const buttonOptions = computed<MenuEntry[]>(() => {
  const ops: MenuEntry[] = []
  if (isPublishable.value) {
    ops.push({ group: null, items: [{ label: 'Add and publish', value: 'add-publish' }] })
  }
  ops.push({ group: null, items: [{ label: 'Discard', value: 'add-discard', tone: 'danger' }] })
  return ops
})

async function addResourceAction(publish?: boolean) {
  isAdding.value = true
  try {
    const fields = heldFields($cwa, NEW_RESOURCE_IRI)
    const publishAfter = !!fields.length && !!publish && !!isPublishable.value
    const draft = !!isPublishable.value
    const created = await $cwa.resourcesManager.addResourceAction(publishAfter ? false : publish, () => addResourceAction(publish))
    if (!created) {
      return
    }
    $cwa.admin.emptyStack()
    if (fields.length) {
      moveHeldUploads($cwa, NEW_RESOURCE_IRI, created['@id'], fields)
      await uploadHeld(created['@id'], fields, publishAfter, draft)
    }
  }
  catch (e) {
    consola.error(e)
  }
  finally {
    isAdding.value = false
  }
}

async function uploadHeld(iri: string, fields: string[], publishAfter: boolean, draft: boolean) {
  const failed: string[] = []
  for (const field of fields) {
    !await sendHeldUpload($cwa, iri, field) && failed.push(field)
  }
  if (!failed.length) {
    publishAfter && await $cwa.resourcesManager.updateResource({ endpoint: iri, data: { publishedAt: 'now' } })
    return
  }
  const one = failed.length === 1
  toast.show({
    tone: 'error',
    title: `${draft ? 'Added as a draft' : 'Added'}, without ${one ? 'its file' : 'some of its files'}`,
    description: `The ${one ? 'file couldn\'t' : 'files couldn\'t'} be uploaded. Retry here, or select the component and use Retry on the ${one ? 'file' : 'files'}.`,
    actions: [{ label: 'Retry', primary: true, onClick: () => uploadHeld(iri, failed, publishAfter, draft) }],
  })
}

async function handleManagerCtaClick() {
  await addResourceAction(!isPublishable.value)
}

async function handleOption({ value }: MenuItem) {
  if (value === 'add-discard') {
    await $cwa.resourcesManager.confirmDiscardAddingResource() && $cwa.admin.emptyStack()
    return
  }

  if (value === 'add-publish') {
    await addResourceAction(true)
  }
}
</script>

<template>
  <CwaUiButton
    :label="isPublishable ? '+ Draft' : '+ Add'"
    :aria-label="isPublishable ? 'Add draft' : 'Add'"
    variant="solid"
    size="sm"
    large-icon
    stretch
    :options="buttonOptions"
    :loading="isAdding"
    @click="handleManagerCtaClick"
    @select="handleOption"
  />
</template>
