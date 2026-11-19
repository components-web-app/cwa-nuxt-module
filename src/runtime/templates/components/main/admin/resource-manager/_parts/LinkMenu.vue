<template>
  <CwaUiMenu
    v-model:open="menuOpen"
    :items="items"
    label="Link"
    :at="point"
    side="bottom"
    align="start"
    data-testid="link-menu"
    @open-auto-focus="focusFirstItem"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CwaUiMenu from '#cwa/templates/components/ui/Menu.vue'
import type { MenuItem } from '#cwa/templates/components/core/ui/menu-entries'
import { useCwa } from '#cwa/composables/cwa'
import { useRouter } from '#app/composables/router'
import type { ResourceStackItem } from '#cwa/admin/resource-stack-manager'
import { followPageLink, pageLinkLabel, pageLinkOf } from '#cwa/admin/page-link'

const props = defineProps<{
  stack: ResourceStackItem[]
  type: 'page' | 'layout'
  point: { x: number, y: number }
  link: HTMLAnchorElement
}>()

const emit = defineEmits<{
  close: []
}>()

const $cwa = useCwa()
const router = useRouter()
const menuOpen = ref(true)

const pageLink = pageLinkOf(props.link, router.options.history.base)

const items = computed<MenuItem[]>(() => {
  const list: MenuItem[] = []
  const selected = props.stack[0]
  if (selected) {
    list.push({
      label: selected.displayName ? `Edit ${selected.displayName}` : 'Edit',
      testId: 'link-menu-edit',
      onSelect: () => $cwa.admin.resourceStackManager.selectStack(props.stack, props.type),
    })
  }
  list.push({
    label: pageLinkLabel(pageLink),
    testId: 'link-menu-visit',
    onSelect: () => followPageLink($cwa, router, pageLink),
  })
  return list
})

function focusFirstItem(event: Event) {
  const item = (event.target as HTMLElement | null)?.querySelector<HTMLElement>('[role="menuitem"]')
  if (item) {
    event.preventDefault()
    item.focus()
  }
}

watch(menuOpen, (isOpen) => {
  !isOpen && emit('close')
})
</script>
