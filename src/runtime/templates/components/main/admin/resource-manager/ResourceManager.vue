<script lang="ts" setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, provide, ref, shallowRef, toRaw, toValue, useId, useTemplateRef, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { consola } from 'consola'
import ResourceLoadingIndicator
  from '../_common/ResourceLoadingIndicator.vue'
import ManagerTabs from './_parts/ManagerTabs.vue'
import CwaAdminResourceManagerContextMenu from './_parts/CwaResourceManagerContextMenu.vue'
import { useCwa } from '#imports'
import { useTransitions } from '#cwa/composables/transitions'
import type { CwaResourceManagerTabOptions } from '#cwa/composables/cwa-resource-manager-tab'
import { CwaUserRoles } from '#cwa/storage/stores/auth/state'
import type { ManagerTab } from '#cwa/types'
import ResourceManagerCtaButton
  from '#cwa/templates/components/main/admin/resource-manager/cta/ResourceManagerCtaButton.vue'
import AddComponentDialog
  from '#cwa/templates/components/main/admin/resource-manager/_parts/AddComponentDialog.vue'
import { useDataResolver } from '#cwa/templates/components/core/useDataResolver'
import { useCloneMode } from '#cwa/admin/clone-mode'
import { CwaResourceTypes, getResourceTypeFromIri } from '#cwa/resources/resource-utils'
import BarSummary from '#cwa/templates/components/core/admin/BarSummary.vue'
import { createAnnouncer } from '#cwa/templates/components/core/ui/field-context'
import { announceKey, managerTabMountedKey } from '#cwa/templates/components/core/ui/field-keys'
import { resourceStackLevels } from '#cwa/templates/components/core/ui/resource-stack'
import { listenForLongPress } from '#cwa/admin/long-press'
import { registerBarFields } from '#cwa/admin/write-violations'
import type { ResourceStackItem } from '#cwa/admin/resource-stack-manager'

const ComponentUsageBadge = defineAsyncComponent(() => import('#cwa/templates/components/main/admin/resource-manager/cta/ComponentUsageBadge.vue'))
const SharedInstancesHighlight = defineAsyncComponent(() => import('#cwa/templates/components/main/admin/resource-manager/SharedInstancesHighlight.vue'))
const PeerOutlines = defineAsyncComponent(() => import('#cwa/templates/components/main/admin/resource-manager/PeerOutlines.vue'))
const ReorderHandles = defineAsyncComponent(() => import('#cwa/templates/components/main/admin/resource-manager/ReorderHandles.vue'))
const ClonePlacementMenu = defineAsyncComponent(() => import('#cwa/templates/components/main/admin/resource-manager/_parts/ClonePlacementMenu.vue'))
const HoverOutline = defineAsyncComponent(() => import('#cwa/templates/components/main/admin/resource-manager/HoverOutline.vue'))
const LinkMenu = defineAsyncComponent(() => import('#cwa/templates/components/main/admin/resource-manager/_parts/LinkMenu.vue'))

const $cwa = useCwa()
const { slideUp } = useTransitions()
const currentStackItem = $cwa.admin.resourceStackManager.currentStackItem
const spacer = useTemplateRef<HTMLElement | null>('spacer')
const managerHolder = useTemplateRef<HTMLElement | null>('managerHolder')
const allTabsMeta = ref<CwaResourceManagerTabOptions[]>([])
const selectedIndex = ref(0)
const tabsId = useId()
const tabsLabel = computed(() => currentStackItem.value?.displayName ? `${currentStackItem.value.displayName} settings` : 'Settings')
const isOpen = ref(false)
const contextPoint = shallowRef<{ x: number, y: number, key: number }>()
let contextKey = 0
const managerTabs = useTemplateRef<typeof ManagerTabs | null>('managerTabs')
const currentManagerTabs = ref<ManagerTab[] | undefined>()
const cachedPosition = { top: 0, left: 0 }
let mousedownTarget: null | EventTarget = null
const cloneMode = useCloneMode($cwa)
type ClickedTarget = { stack: ResourceStackItem[], type: 'page' | 'layout', point: { x: number, y: number }, link?: HTMLAnchorElement, key: number }
const cloneTarget = shallowRef<ClickedTarget>()
const linkTarget = shallowRef<ClickedTarget & { link: HTMLAnchorElement }>()
let clickedTargetKey = 0
const announcer = createAnnouncer()
provide(announceKey, announcer.announce)

type ContextPosition = {
  top: number
  left: number
}

function showDefaultContext({ top, left }: ContextPosition) {
  const difference = {
    top: Math.abs(top - cachedPosition.top),
    left: Math.abs(left - cachedPosition.left),
  }
  return isOpen.value && difference.top < 10 && difference.left < 10
}

function openContext({ top, left }: ContextPosition) {
  cachedPosition.top = top
  cachedPosition.left = left
  contextPoint.value = { x: left, y: top, key: ++contextKey }
  isOpen.value = true
}

function contextMenuHandler(e: MouseEvent, type: 'page' | 'layout') {
  if (cloneMode.source.value) {
    isOpen.value = false
    $cwa.admin.resourceStackManager.resetStack(true)
    return
  }
  const pos: ContextPosition = {
    top: e.clientY,
    left: e.clientX,
  }
  if (showDefaultContext(pos) || !$cwa.admin.isEditing || !$cwa.admin.resourceStackManager.isContextPopulating.value) {
    isOpen.value = false
    return
  }
  completeStack(e, type, true)
  if (!resourceStackLevels($cwa.admin.resourceStackManager.contextStack.value).length) {
    isOpen.value = false
    return
  }
  e.preventDefault()
  openContext(pos)
}

function closeContextMenu(e: MouseEvent) {
  isOpen.value = false
  completeStack(e, undefined, true)
}

function mousedownHandler(e: MouseEvent) {
  mousedownTarget = e.target
}

function clickedLink(e: MouseEvent) {
  if (!$cwa.admin.isEditing || $cwa.admin.resourceStackManager.isModuleSelect || !(e.target instanceof Element)) {
    return
  }
  const control = e.target.closest('a[href], button, input, select, textarea, summary, [role="button"], [role="tab"]')
  return control instanceof HTMLAnchorElement ? control : undefined
}

function clickPoint(e: MouseEvent, link?: HTMLAnchorElement) {
  if (!link || e.detail) {
    return { x: e.clientX, y: e.clientY }
  }
  const box = link.getBoundingClientRect()
  return { x: box.left, y: box.bottom }
}

async function clickHandler(e: MouseEvent, type: 'page' | 'layout') {
  const link = clickedLink(e)
  link && e.preventDefault()
  // attempt to prevent selecting when dragging mouse over different resources which will not trigger a click on either
  if (e.target !== mousedownTarget && !$cwa.admin.resourceStackManager.isPopulating.value && !(link && !e.detail)) {
    return
  }
  completeStack(e, type)
  const stackManager = $cwa.admin.resourceStackManager
  if (!cloneMode.source.value && !link) {
    stackManager.selectStackIndex(0, false)
    return
  }
  const stack = [...stackManager.resourceStack.value]
  stackManager.restorePreviousStack()
  if (!stack.length && !link) {
    return
  }
  const target = { stack, type, point: clickPoint(e, link), link, key: ++clickedTargetKey }
  if (cloneMode.source.value) {
    cloneTarget.value = target
    return
  }
  if (!link || (stack.length && !await stackManager.switchScope(type))) {
    return
  }
  linkTarget.value = { ...target, link }
}

function completeStack(e: MouseEvent, type: undefined | 'page' | 'layout', isContext: boolean = false) {
  $cwa.admin.resourceStackManager.completeStack({ clickTarget: e.target }, isContext, type)
}

function selectTab(index: number) {
  selectedIndex.value = index
}

const currentFieldStates = computed(() => {
  const iri = currentStackItem.value?.iri
  return iri ? $cwa.resources.getResource(iri).value?.fieldStates : undefined
})

function showTabOf(field: string) {
  const index = allTabsMeta.value.findIndex(meta => (meta as { fields?: string[] } | null)?.fields?.includes(field))
  index > -1 && managerTabs.value?.selectOriginal(index)
}

const unregisterBarFields = registerBarFields($cwa, {
  iri: () => $cwa.admin.resourceStackManager.showManager.value ? $cwa.admin.resourceStackManager.currentIri.value : undefined,
  fields: () => managerTabs.value?.fieldsInOrder() ?? [],
  show: showTabOf,
})

async function showField(field: string) {
  showTabOf(field)
  await nextTick()
  managerHolder.value?.querySelector<HTMLElement>(`[data-cwa-field="${field}"] :is(input, button, [role="switch"])`)?.focus()
}

const showSharedInstances = computed(() => {
  const iri = currentStackItem.value?.iri
  return !!iri
    && $cwa.admin.resourceStackManager.showManager.value
    && !cloneMode.source.value
    && getResourceTypeFromIri(iri) === CwaResourceTypes.COMPONENT
})

const reorderGroupIri = computed(() => {
  const iri = currentStackItem.value?.iri
  if (!iri || !$cwa.admin.isEditing || cloneMode.source.value || getResourceTypeFromIri(iri) !== CwaResourceTypes.COMPONENT_GROUP || !$cwa.admin.resourceStackManager.getState('reordering')) {
    return
  }
  return iri
})

const showAdmin = computed(() => {
  return $cwa.auth.hasRole(CwaUserRoles.ADMIN)
})

const showSpacer = computed(() => {
  return ($cwa.admin.resourceStackManager.showManager.value && !!currentStackItem)
})

const selectedTab = computed(() => {
  if (allTabsMeta.value.includes(undefined as never)) {
    return
  }
  const tab = currentStackItem.value?.managerTabs?.[selectedIndex.value]
  return tab ? toRaw(tab) : tab
})

const shownTab = useTemplateRef<ComponentPublicInstance>('shownTab')
const tabHolder = useTemplateRef<HTMLElement>('tabHolder')
if (import.meta.env.DEV) {
  const kitRows = new Set<HTMLElement>()
  provide(managerTabMountedKey, (row) => {
    kitRows.add(row)
    return () => kitRows.delete(row)
  })
  const warned = new Set<unknown>()
  watch(shownTab, async () => {
    await nextTick()
    const instance = shownTab.value
    const tab = selectedTab.value
    const holder = tabHolder.value
    if (!instance || !tab || warned.has(tab) || !holder?.firstElementChild || [...kitRows].some(row => holder.contains(row))) {
      return
    }
    warned.add(tab)
    const name = allTabsMeta.value[selectedIndex.value]?.name ?? instance.$.type.name ?? instance.$.type.__name
    consola.warn(`The manager tab "${name}" should render CwaUiManagerTab at its root, so its fields sit in the manager bar's one row and \`field="…"\` binds to the selected resource.`)
  }, { flush: 'post' })
}

watch([spacer, managerHolder, currentStackItem, selectedIndex, allTabsMeta], () => {
  if (!spacer.value || !managerHolder.value || !currentStackItem.value) {
    return
  }
  const newHeight = managerHolder.value.clientHeight
  spacer.value.style.height = `${newHeight}px`
  nextTick().then(() => ($cwa.admin.emitRedraw()))
}, {
  flush: 'post',
})

const resolverIri = computed(() => currentStackItem.value?.iri)
const resolverProps = computed(() => {
  return {
    iri: resolverIri.value,
  }
})

useDataResolver(allTabsMeta, {
  components: currentManagerTabs,
  props: resolverProps,
  propsValidator: (props: typeof resolverProps.value) => {
    return !!props.iri
  },
})

watch(currentStackItem, (newCurrent, oldCurrent) => {
  if (oldCurrent && newCurrent && $cwa.resources.isIriPublishableEquivalent(oldCurrent.iri, newCurrent.iri)) {
    return
  }
  allTabsMeta.value = []
  managerTabs.value?.resetTabs()
  currentManagerTabs.value = newCurrent?.managerTabs
})

let stopLongPress: (() => void) | undefined

function onPaneKey(e: KeyboardEvent) {
  if (e.key !== 'F6' || e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || !$cwa.admin.isEditing || !currentStackItem.value) {
    return
  }
  const inBar = !!managerHolder.value?.contains(document.activeElement)
  const target = inBar
    ? toValue(currentStackItem.value.domElements)?.find(el => el.hasAttribute('tabindex'))
    : document.getElementById(`${tabsId}-tab-${selectedIndex.value}`)
  if (!target) {
    return
  }
  e.preventDefault()
  target.focus()
}

onMounted(() => {
  window.addEventListener('mousedown', mousedownHandler)
  window.addEventListener('resize', $cwa.admin.emitRedraw, false)
  document.addEventListener('keydown', onPaneKey)
  watch(() => $cwa.admin.isEditing, (editing) => {
    stopLongPress?.()
    stopLongPress = editing ? listenForLongPress(document) : undefined
  }, { immediate: true })
})

onBeforeUnmount(() => {
  unregisterBarFields()
  window.removeEventListener('resize', $cwa.admin.emitRedraw)
  document.removeEventListener('keydown', onPaneKey)
  stopLongPress?.()
  stopLongPress = undefined
})

defineExpose({
  clickHandler,
  contextMenuHandler,
  closeContextMenu,
})
</script>

<template>
  <div
    v-if="showSpacer"
    id="cwa-manager-spacer"
    ref="spacer"
    class="cwa:relative"
  />
  <Transition v-bind="slideUp">
    <div
      v-if="$cwa.admin.resourceStackManager.showManager.value"
      class="cwa:@container cwa:fixed cwa:bottom-0 cwa:z-manager cwa:w-full cwa:bg-surface cwa:text-fg cwa:shadow-[0_-8px_24px_rgb(0_0_0/0.18)] cwa:pointer-coarse:[--cwa-spacing-manager:7rem]"
      data-testid="manager-bar"
      @click.stop
    >
      <div
        v-if="allTabsMeta.length"
        ref="managerHolder"
        class="cwa:relative cwa:grid cwa:min-h-manager cwa:grid-cols-[minmax(0,1fr)_auto] cwa:grid-rows-[var(--cwa-spacing-manager-tabs)_minmax(var(--cwa-spacing-manager-row),auto)] cwa:[--cwa-spacing-manager-tabs:calc(var(--cwa-spacing-control)+2*var(--cwa-spacing-cta-inset)+1px)] cwa:pointer-coarse:[--cwa-spacing-manager-tabs:calc(var(--cwa-spacing-hit)+1px)] cwa:[--cwa-spacing-manager-row:calc(var(--cwa-spacing-manager)-var(--cwa-spacing-manager-tabs))] cwa:pointer-coarse:[--cwa-spacing-cta-inset:0px] cwa:@max-[40rem]:[--cwa-spacing-cta-inset:0px]"
      >
        <ResourceLoadingIndicator
          class="cwa:absolute cwa:bottom-full cwa:left-0 cwa:z-notifications"
          data-testid="manager-saving-line"
        />
        <div class="cwa:min-w-0 cwa:shadow-[inset_0_-1px_0_var(--cwa-color-line)]">
          <ManagerTabs
            ref="managerTabs"
            class="cwa:box-border cwa:pt-cta-inset cwa:pb-[calc(var(--cwa-spacing-cta-inset)+1px)]"
            :tabs="allTabsMeta"
            :field-states="currentFieldStates"
            :id-prefix="tabsId"
            :label="tabsLabel"
            @click="selectTab"
          />
        </div>
        <div
          class="cwa:flex cwa:h-manager-tabs cwa:items-center cwa:gap-cta-inset cwa:pt-cta-inset cwa:pr-cta-inset cwa:pb-[calc(var(--cwa-spacing-cta-inset)+1px)] cwa:pl-[calc(1px+var(--cwa-spacing-cta-inset))] cwa:shadow-[inset_1px_0_0_var(--cwa-color-line),inset_0_-1px_0_var(--cwa-color-line)]"
          data-testid="manager-pin"
        >
          <BarSummary
            :message="announcer.message.value"
            @show="showField"
          />
          <ComponentUsageBadge />
          <ResourceManagerCtaButton />
        </div>
        <div
          :id="`${tabsId}-panel`"
          ref="tabHolder"
          role="tabpanel"
          :aria-labelledby="`${tabsId}-tab-${selectedIndex}`"
          data-testid="manager-tab-panel"
          class="cwa:col-span-2 cwa:grid cwa:min-w-0"
        >
          <component
            :is="selectedTab"
            v-if="selectedTab"
            ref="shownTab"
            class="cwa:flex cwa:w-full cwa:min-w-0 cwa:items-center cwa:px-row-x"
          />
        </div>
      </div>
    </div>
  </Transition>
  <CwaAdminResourceManagerContextMenu
    v-if="showAdmin"
    v-model="isOpen"
    :point="contextPoint"
  />
  <AddComponentDialog />
  <SharedInstancesHighlight v-if="showSharedInstances" />
  <ReorderHandles
    v-if="reorderGroupIri"
    :group-iri="reorderGroupIri"
  />
  <PeerOutlines v-if="$cwa.admin.isEditing && !cloneMode.source.value" />
  <HoverOutline v-if="$cwa.admin.isEditing" />
  <ClonePlacementMenu
    v-if="cloneTarget"
    :key="cloneTarget.key"
    :stack="cloneTarget.stack"
    :type="cloneTarget.type"
    :point="cloneTarget.point"
    :link="cloneTarget.link"
    @close="cloneTarget = undefined"
  />
  <LinkMenu
    v-if="linkTarget"
    :key="linkTarget.key"
    :stack="linkTarget.stack"
    :type="linkTarget.type"
    :point="linkTarget.point"
    :link="linkTarget.link"
    @close="linkTarget = undefined"
  />
</template>
