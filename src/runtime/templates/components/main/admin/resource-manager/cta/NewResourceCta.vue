<script lang="ts" setup>
import { computed, ref } from 'vue'
import { consola } from 'consola'
import { type CwaResource } from '#cwa/runtime/resources/resource-utils'
import { useCwa } from '#cwa/runtime/composables/cwa'
import type { ButtonOption, ModelValue } from '#cwa/runtime/templates/components/ui/form/Button.vue'

const props = defineProps<{
  currentIri: string
  resource: CwaResource
}>()

const $cwa = useCwa()

const addingMeta = computed(() => props.resource?._metadata.adding)
const isPublishable = computed(() => addingMeta.value?.isPublishable)
const isAdding = ref(false)

const buttonLabel = computed<'Add Draft'|'Add'>(() => {
  return isPublishable.value ? 'Add Draft' : 'Add'
})

const buttonOptions = computed(() => {
  const ops: (ButtonOption|ButtonOption[])[] = []
  ops.push({ label: 'Discard', value: 'add-discard' })
  if (isPublishable.value) {
    ops.push({ label: 'Add and Publish', value: 'add-publish' })
  }
  return ops
})

async function addResourceAction (publish?: boolean) {
  isAdding.value = true
  try {
    await $cwa.resourcesManager.addResourceAction(publish)
    $cwa.admin.toggleEdit(false)
  } catch (e) {
    consola.error(e)
  }
  isAdding.value = false
}

async function handleManagerCtaClick (value?: ModelValue) {
  if (!value) {
    await addResourceAction(buttonLabel.value !== 'Add Draft')
    return
  }

  if (value === 'add-discard') {
    await $cwa.resourcesManager.confirmDiscardAddingResource()
    $cwa.admin.toggleEdit(false)
    return
  }

  if (value === 'add-publish') {
    await addResourceAction(true)
  }
}
</script>

<template>
  <CwaUiFormButton
    color="grey"
    button-class="cwa-min-w-[100px]"
    :options="buttonOptions"
    :disabled="isAdding"
    @click="handleManagerCtaClick"
  >
    {{ buttonLabel }}
  </CwaUiFormButton>
</template>
