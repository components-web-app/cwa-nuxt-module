<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowReactive, watch } from 'vue'
import { useRouter } from '#app/composables/router'
import { useCwa } from '#cwa/composables/cwa'
import { useCwaToast } from '#cwa/composables/cwa-toast'
import { failedSaves, forgetFailedSave, onFailedSavesChange } from '#cwa/admin/field-states'
import type { FailedSave } from '#cwa/admin/field-states'
import { instancesOf, onInstancesChange, registeredIriOf } from '#cwa/admin/manageable-instances'

interface Group {
  id: string
  iri: string
  saves: FailedSave[]
  canShow: boolean
}

const $cwa = useCwa()
const toast = useCwaToast()
const router = useRouter()
const saves = failedSaves($cwa)
const currentIri = $cwa.admin.resourceStackManager.currentIri
const pages = shallowReactive(new Map<string, string>())
const changes = ref(0)
const hiding = new Set<string>()
let shown = new Set<string>()
let stopWaiting: (() => void) | undefined

const count = () => {
  changes.value++
}
const stopListening = [onInstancesChange($cwa, count), onFailedSavesChange($cwa, count)]

watch(currentIri, (iri) => {
  iri && pages.set(iri, router.currentRoute.value.fullPath)
}, { immediate: true })

function same(a: string, b: string) {
  return a === b || $cwa.resources.isIriPublishableEquivalent(a, b)
}

function equivalents(iri: string) {
  return new Set([iri, ...$cwa.resources.findAllPublishableIris(iri)])
}

function statusOf(save: FailedSave) {
  for (const iri of equivalents(save.iri)) {
    const state = $cwa.resources.getResource(iri).value?.fieldStates?.[save.field]
    if (state) {
      return state.status
    }
  }
  return undefined
}

function pageOf(iri: string) {
  for (const [selected, path] of pages) {
    if (same(selected, iri)) {
      return path
    }
  }
  return undefined
}

function nameOf(iri: string) {
  for (const each of equivalents(iri)) {
    const type = $cwa.resources.getResource(each).value?.data?.['@type']
    if (type) {
      return $cwa.resourcesConfig?.[type]?.name || type
    }
  }
  return 'Component'
}

function listOf(labels: string[]) {
  return labels.length > 1 ? `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}` : labels[0]
}

const pending = computed(() => {
  void changes.value
  const current = currentIri.value
  const resolved: FailedSave[] = []
  const groups: Group[] = []
  for (const save of saves.values()) {
    const status = statusOf(save)
    if (status !== 'error') {
      status === 'saving' || status === 'pending' || resolved.push(save)
      continue
    }
    if (current && same(current, save.iri)) {
      continue
    }
    const group = groups.find(each => same(each.iri, save.iri))
    if (group) {
      group.saves.push(save)
      continue
    }
    groups.push({ id: `cwa-save-failed-${save.iri}`, iri: save.iri, saves: [save], canShow: !!registeredIriOf($cwa, save.iri) || !!pageOf(save.iri) })
  }
  return { resolved, groups }
})

function hide(id: string) {
  shown.delete(id)
  hiding.add(id)
  toast.dismiss(id)
}

function forget(id: string, forgotten: FailedSave[]) {
  if (hiding.delete(id)) {
    return
  }
  shown.delete(id)
  forgotten.forEach(save => forgetFailedSave($cwa, save))
}

function select(iri: string) {
  const target = registeredIriOf($cwa, iri)
  if (!target) {
    return false
  }
  $cwa.admin.isEditing || $cwa.admin.toggleEdit(true)
  $cwa.admin.eventBus.emit('selectResource', target)
  instancesOf($cwa, target)[0]?.value.find(element => element.nodeType === 1)?.scrollIntoView?.({ block: 'center' })
  return true
}

function stopWaitingToSelect() {
  stopWaiting?.()
  stopWaiting = undefined
}

function showMe(iri: string) {
  stopWaitingToSelect()
  if (select(iri)) {
    return
  }
  const path = pageOf(iri)
  if (!path) {
    return
  }
  stopWaiting = onInstancesChange($cwa, () => {
    if (registeredIriOf($cwa, iri)) {
      stopWaitingToSelect()
      nextTick(() => select(iri))
    }
  })
  const to = router.resolve(path)
  router.push({ path: to.path, query: { ...to.query, cwa_force: 'true' }, hash: to.hash })
}

watch(pending, ({ resolved, groups }) => {
  resolved.forEach(save => forgetFailedSave($cwa, save))
  const next = new Set(groups.map(group => group.id))
  shown.forEach(id => next.has(id) || hide(id))
  shown = next
  for (const group of groups) {
    const labels = [...new Set(group.saves.map(save => save.label()))]
    toast.show({
      id: group.id,
      tone: 'error',
      title: `${nameOf(group.iri)} wasn't saved`,
      description: `Your last edit to ${listOf(labels)} wasn't saved.`,
      actions: [
        ...(group.canShow ? [{ label: 'Show me', primary: true, onClick: () => showMe(group.iri) }] : []),
        { label: 'Retry', onClick: () => group.saves.forEach(save => save.retry()) },
        { label: 'Reset', onClick: () => group.saves.forEach(save => save.reset()) },
      ],
      onClose: () => forget(group.id, group.saves),
    })
  }
}, { immediate: true })

onBeforeUnmount(() => {
  stopListening.forEach(stop => stop())
  stopWaitingToSelect()
  ;[...shown].forEach(hide)
})
</script>

<template>
  <span hidden />
</template>
