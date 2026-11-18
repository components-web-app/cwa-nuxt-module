<script lang="ts" setup>
import { computed, ref } from 'vue'
import { consola } from 'consola'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { useCwa } from '#cwa/composables/cwa'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import type { MenuEntry, MenuItem } from '#cwa/templates/components/core/ui/menu-entries'

const props = defineProps<{
  currentIri: string
  resource: CwaResource
}>()

const $cwa = useCwa()

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
    await $cwa.resourcesManager.addResourceAction(publish)
    $cwa.admin.emptyStack()
  }
  catch (e) {
    consola.error(e)
  }
  isAdding.value = false
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
