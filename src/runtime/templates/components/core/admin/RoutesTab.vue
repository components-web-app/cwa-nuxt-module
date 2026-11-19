<template>
  <CwaUiSubView
    :open="!!sub"
    :title="subTitle"
    back-label="Routes"
    :padded="!!dialog"
    :return-focus="returnFocus"
    @back="back"
  >
    <template #main>
      <RoutesTabView
        ref="view"
        :resource="hasRoute ? resource : undefined"
        :is-loading="isLoadingRoute"
        :parent-has-no-route="parentHasNoRoute && !hasRoute"
        :parent-name="parentName"
        :forward-to-path="forwardToPath"
        :redirect-count="redirectCount"
        :child-count="childCount"
        :recommended-path="recommendedPath"
        :recommended-from="pageResource.title || undefined"
        :noun="noun"
        :status="status?.where === 'route' ? status.text : undefined"
        @open="open"
        @open-parent="parentIri && emit('openPage', parentIri)"
      />
    </template>
    <div
      ref="subBody"
      class="cwa:flex cwa:flex-col cwa:gap-stack"
    >
      <CwaUiAlert
        v-if="failure"
        ref="failureAlert"
        tone="danger"
        :title="failure.title"
        data-testid="routes-failure"
      >
        {{ failure.text }}
        <ul
          v-if="failure.reasons?.length"
          class="cwa:m-0 cwa:mt-2 cwa:list-disc cwa:ps-5"
        >
          <li
            v-for="reason in failure.reasons"
            :key="reason"
            data-testid="routes-failure-reason"
          >
            {{ reason }}
          </li>
        </ul>
        <template #actions>
          <CwaUiButton
            label="Retry"
            data-testid="routes-retry"
            @click="failure.retry()"
          />
        </template>
      </CwaUiAlert>
      <CwaUiAlert
        v-if="sub === 'route' && pathChanged && childRoutesState === 'failed'"
        tone="warning"
        title="Couldn't check child routes"
        data-testid="routes-children-failed"
      >
        Saving a new path offers to change the child routes under it, so it waits until they load.
        <template #actions>
          <CwaUiButton
            label="Retry"
            @click="loadChildRoutes()"
          />
        </template>
      </CwaUiAlert>
      <RoutesTabManage
        v-if="sub === 'route' && localResourceData"
        v-model="localResourceData.path"
        v-model:live-at="localResourceData.liveAt"
        v-model:cascade="cascade"
        v-model:awaiting-date="awaitingDate"
        :current-path="hasRoute ? resource?.path ?? '' : ''"
        :parent-route-prefix="parentRoutePrefix"
        :route-publication="routePublication"
        :recommended-path="recommendedPath"
        :recommended-from="pageResource.title || undefined"
        :child-paths="childPaths"
        :redirect-count="redirectCount"
        :path-error="routeForm?.fieldErrors?.path"
        :noun="noun"
        :deleting="deleting"
        @delete="handleDeleteRoute"
      />
      <RoutesTabForwardTo
        v-else-if="sub === 'to' && resource"
        v-model="forwardPick"
        :path="resource.path"
        :forward-to-path="forwardToPath"
        :form="formOpen"
        :current-route-iri="resource['@id']"
        :removing="removingForward"
        :status="status?.where === 'to' ? status.text : undefined"
        :picked-path="pathOfRouteIri(forwardPick)"
        @start="startForm"
        @remove="handleRemoveForwardTo"
      />
      <RoutesTabRedirects
        v-else-if="sub === 'from'"
        v-model="newRedirect"
        :redirects="resource?.redirectedFrom"
        :path="resource?.path ?? ''"
        :form="formOpen"
        :error="redirectError"
        :busy="submitting"
        :add-disabled-reason="hasRoute ? undefined : 'Add a route first: old addresses send visitors to it.'"
        :status="status?.where === 'from' ? status.text : undefined"
        @start="startForm"
        @delete="handleDeleteRedirect"
      />
      <RoutesTabChildRoutes
        v-else-if="sub === 'kids'"
        :children="childRoutes"
        :details="childDetails"
        @edit="emit('openPage', $event)"
        @go="emit('goTo', $event)"
        @shown="showChildRoutes"
        @retry="retryChildDetail"
      />
      <div
        v-if="!dialog && subFooter && subFooter !== 'none'"
        class="cwa:flex cwa:justify-end cwa:gap-actions"
      >
        <CwaUiButton
          label="Cancel"
          data-testid="dialog-sub-cancel"
          @click="subFooter.cancel()"
        />
        <CwaUiButton
          variant="solid"
          :label="subFooter.saveLabel"
          :loading="subFooter.saving"
          :disabled="!!subFooter.disabledReason"
          :disabled-reason="subFooter.disabledReason"
          data-testid="dialog-sub-save"
          @click="subFooter.save()"
        />
      </div>
    </div>
  </CwaUiSubView>
</template>

<script lang="ts" setup>
import { computed, inject, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { useItemPage } from '#cwa-layer/_composables/useItemPage'
import { normaliseRoutePath, routePathProblem } from '#cwa/resources/route-path'
import { routePublicationFromResource } from '#cwa/resources/route-publication'
import { useCwa, navigateTo, useRoute } from '#imports'
import CwaUiSubView from '#cwa/templates/components/ui/SubView.vue'
import CwaUiAlert from '#cwa/templates/components/ui/Alert.vue'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import RoutesTabView from '#cwa/templates/components/core/admin/RoutesTabView.vue'
import type { RouteSubView } from '#cwa/templates/components/core/admin/RoutesTabView.vue'
import RoutesTabManage from '#cwa/templates/components/core/admin/RoutesTabManage.vue'
import RoutesTabForwardTo from '#cwa/templates/components/core/admin/RoutesTabForwardTo.vue'
import RoutesTabRedirects from '#cwa/templates/components/core/admin/RoutesTabRedirects.vue'
import RoutesTabChildRoutes from '#cwa/templates/components/core/admin/RoutesTabChildRoutes.vue'
import type { ChildRouteDetail, RouteHierarchyNodeData } from '#cwa/templates/components/core/admin/RoutesTabChildRoutes.vue'
import { dialogSubViewKey } from '#cwa/templates/components/core/ui/field-keys'
import type { DialogSubFooter } from '#cwa/templates/components/core/ui/field-keys'
import { useCwaConfirm } from '#cwa/composables/cwa-confirm'
import { useCwaResourceRoute } from '#cwa/composables/useCwaResourceRoute'
import { pathOfRouteIri, useRouteDefaults } from '#cwa/templates/components/core/admin/route-defaults'
import { CwaResourceApiStatuses } from '#cwa/storage/stores/resources/state'

const OLD_ADDRESS = /^\//
const NOT_SAVED = 'The server couldn\'t save it. Nothing changed, and what you typed is still here.'
const NOT_DELETED = 'The server couldn\'t delete it. Nothing changed.'
const DETAILS_AT_ONCE = 6
const FIELD_LABELS: Record<string, string> = { path: 'Route path', name: 'Route path', liveAt: 'Go live' }

const props = withDefaults(defineProps<{
  pageResource: CwaResource
  noun?: string
}>(), {
  noun: 'page',
})

const emit = defineEmits<{
  close: []
  reload: []
  openPage: [iri: string]
  goTo: [path: string]
}>()

const $cwa = useCwa()
const route = useRoute()
const confirm = useCwaConfirm()
const { getInternalResourceLink } = useCwaResourceRoute()
const dialog = inject(dialogSubViewKey, undefined)
const view = useTemplateRef<InstanceType<typeof RoutesTabView>>('view')
const subBody = useTemplateRef<HTMLElement>('subBody')
const failureAlert = useTemplateRef<InstanceType<typeof CwaUiAlert>>('failureAlert')

const { parentIri, parentName, parentRoutePrefix, parentHasNoRoute, recommendedPath } = useRouteDefaults(() => props.pageResource)

const redirectIri = computed<string | undefined>(() => {
  const r = resource.value?.redirect
  if (!r) return undefined
  return typeof r === 'object' ? (r as any)['@id'] : (r as string)
})

const forwardToPath = computed(() => pathOfRouteIri(redirectIri.value))

const routeIriFromPage = computed(() => (props.pageResource.route))
const hasRoute = computed(() => !!routeIriFromPage.value)
const endpoint = computed(() => routeIriFromPage.value ? `${routeIriFromPage.value}/redirects` : 'add')

const submitting = ref(false)
const removingForward = ref(false)
const deleting = ref(false)
const childRoutes = ref<RouteHierarchyNodeData[]>([])
const childRoutesState = ref<'loading' | 'loaded' | 'failed'>('loaded')
const childDetails = ref<Record<string, ChildRouteDetail>>({})

const sub = ref<RouteSubView | null>(null)
const formOpen = ref(false)
const cascade = ref(true)
const awaitingDate = ref(false)
const forwardPick = ref<string | null | undefined>()
const newRedirect = ref('')
const redirectError = ref<string>()
const status = ref<{ where: 'route' | 'to' | 'from', text: string }>()
const failure = ref<{ title: string, text: string, reasons?: string[], retry: () => void }>()
let focusStatusOnReturn = false

function countNodes(nodes: { children?: unknown[] | null }[] | undefined): number {
  return (nodes ?? []).reduce((total, node) => total + 1 + countNodes(node.children as { children?: unknown[] }[]), 0)
}

function countRedirects(list: CwaResource[] | undefined): number {
  return (list ?? []).reduce((total, redirect) => total + 1 + countRedirects(redirect.redirectedFrom), 0)
}

const redirectCount = computed(() => countRedirects(resource.value?.redirectedFrom))
const childCount = computed(() => countNodes(childRoutes.value))

function flattenRouteNodes(nodes: RouteHierarchyNodeData[]): RouteHierarchyNodeData[] {
  return nodes.flatMap(node => [node, ...flattenRouteNodes(node.children)])
}

const childPaths = computed(() => flattenRouteNodes(childRoutes.value).map(node => node.path))

let childRoutesRequest = 0

async function loadChildRoutes() {
  const iri = routeIriFromPage.value
  const request = ++childRoutesRequest
  if (!iri) {
    childRoutes.value = []
    childRoutesState.value = 'loaded'
    return
  }
  childRoutesState.value = 'loading'
  try {
    const { response } = $cwa.fetch({ path: `${iri}/children` })
    const { _data: data } = await response
    if (request === childRoutesRequest) {
      childRoutes.value = data?.children ?? []
      childRoutesState.value = 'loaded'
    }
  }
  catch {
    if (request === childRoutesRequest) {
      childRoutes.value = []
      childRoutesState.value = 'failed'
    }
  }
}

function iriOf(value: unknown) {
  return typeof value === 'object' && value ? (value as { '@id'?: string })['@id'] : (value as string | undefined) || undefined
}

let detailQueue: string[] = []
let detailsInFlight = 0
let detailsGeneration = 0

function setChildDetail(route: string, detail: ChildRouteDetail | undefined) {
  const { [route]: _previous, ...rest } = childDetails.value
  childDetails.value = detail ? { ...rest, [route]: detail } : rest
}

async function loadChildDetail(route: string) {
  let detail: ChildRouteDetail = { state: 'failed' }
  try {
    const { response } = $cwa.fetch({ path: route })
    const { _data: data } = await response
    if (data) {
      detail = { state: 'loaded', publication: routePublicationFromResource(data), page: iriOf(data.page) ?? iriOf(data.pageData) }
    }
  }
  catch {
    detail = { state: 'failed' }
  }
  return detail
}

function pumpChildDetails() {
  while (detailsInFlight < DETAILS_AT_ONCE && detailQueue.length) {
    const route = detailQueue.shift()!
    const generation = detailsGeneration
    detailsInFlight++
    loadChildDetail(route).then((detail) => {
      if (generation !== detailsGeneration) {
        return
      }
      detailsInFlight--
      setChildDetail(route, detail)
      pumpChildDetails()
    })
  }
}

function showChildRoutes(routes: string[]) {
  const shown = new Set(routes)
  detailQueue.filter(route => !shown.has(route)).forEach(route => setChildDetail(route, undefined))
  detailQueue = detailQueue.filter(route => shown.has(route))
  for (const route of routes) {
    if (!childDetails.value[route]) {
      setChildDetail(route, { state: 'loading' })
      detailQueue.push(route)
    }
  }
  pumpChildDetails()
}

function retryChildDetail(route: string) {
  if (childDetails.value[route]?.state !== 'failed') {
    return
  }
  setChildDetail(route, { state: 'loading' })
  detailQueue.push(route)
  pumpChildDetails()
}

function forgetChildDetails() {
  detailsGeneration++
  detailsInFlight = 0
  detailQueue = []
  childDetails.value = {}
}

const subTitle = computed(() => ({
  route: hasRoute.value ? 'Edit route' : 'Add a route',
  to: 'Redirect to',
  from: 'Redirected from',
  kids: 'Child routes',
}[sub.value ?? 'route']))

const routeUnsaved = computed(() => {
  const local = localResourceData.value
  if (!local) {
    return []
  }
  if (!hasRoute.value) {
    return local.path ? [FIELD_LABELS.path!] : []
  }
  return [
    ...(local.path !== resource.value?.path ? [FIELD_LABELS.path!] : []),
    ...((local.liveAt ?? null) !== (resource.value?.liveAt ?? null) ? [FIELD_LABELS.liveAt!] : []),
  ]
})

const routeDirty = computed(() => routeUnsaved.value.length > 0)
const pathChanged = computed(() => hasRoute.value && !!localResourceData.value && localResourceData.value.path !== resource.value?.path)

const unsaved = computed(() => {
  if (sub.value === 'route') {
    return routeUnsaved.value
  }
  if (sub.value === 'to' && formOpen.value) {
    return (forwardPick.value ?? null) !== (redirectIri.value ?? null) ? ['Send visitors to'] : []
  }
  if (sub.value === 'from' && formOpen.value) {
    return newRedirect.value.trim() ? ['Old address'] : []
  }
  return []
})

const dirty = computed(() => unsaved.value.length > 0)

const busy = computed(() => submitting.value || deleting.value || removingForward.value || isUpdating.value)

const routeDisabledReason = computed(() => {
  if (!localResourceData.value?.path) {
    return 'Type a path first.'
  }
  const pathProblem = routePathProblem(localResourceData.value.path)
  if (pathProblem) {
    return pathProblem
  }
  if (awaitingDate.value) {
    return 'Choose when the route goes live.'
  }
  if (pathChanged.value && childRoutesState.value === 'loading') {
    return 'Checking the child routes under this path…'
  }
  if (pathChanged.value && childRoutesState.value === 'failed') {
    return 'Couldn\'t check the child routes under this path.'
  }
  return routeDirty.value ? undefined : 'Nothing has changed.'
})

const forwardDisabledReason = computed(() => {
  if (!forwardPick.value) {
    return 'Choose a page first.'
  }
  if (forwardPick.value === resource.value?.['@id']) {
    return 'A route cannot redirect to itself.'
  }
  return forwardPick.value === redirectIri.value ? 'It already redirects there.' : undefined
})

const subFooter = computed<DialogSubFooter | 'none' | undefined>(() => {
  if (!sub.value) {
    return undefined
  }
  if (sub.value === 'route') {
    return { saveLabel: hasRoute.value ? 'Save route' : 'Add route', saving: isUpdating.value, disabledReason: deleting.value ? 'Deleting the route.' : routeDisabledReason.value, cancel: back, save: handleSaveRoute }
  }
  if (sub.value === 'to' && formOpen.value) {
    return { saveLabel: 'Redirect', saving: submitting.value, disabledReason: forwardDisabledReason.value, cancel: cancelForm, save: handleSetForwardTo }
  }
  if (sub.value === 'from' && formOpen.value) {
    return { saveLabel: 'Add', saving: submitting.value, disabledReason: newRedirect.value.trim() ? routePathProblem(newRedirect.value) : 'Type an old address first.', cancel: cancelForm, save: handleCreateRedirect }
  }
  return 'none'
})

const releases = dialog
  ? [dialog.footer(() => subFooter.value), dialog.guard({ unsaved: () => unsaved.value, leave: () => sub.value && closeSub() })]
  : []
onBeforeUnmount(() => releases.forEach(release => release()))

function askDiscard() {
  return confirm({
    title: 'Discard your route changes?',
    description: 'What you changed here will be lost. Changes on the other tabs are kept.',
    keep: 'Keep editing',
    go: 'Discard',
  })
}

function resetDrafts() {
  awaitingDate.value = false
  failure.value = undefined
  redirectError.value = undefined
  newRedirect.value = ''
  forwardPick.value = redirectIri.value
  cascade.value = true
  if (hasRoute.value) {
    resetResource()
  }
  else if (localResourceData.value) {
    localResourceData.value.path = ''
  }
}

function open(view: RouteSubView, recommended = false) {
  status.value = undefined
  resetDrafts()
  formOpen.value = false
  if (view === 'route' && recommended && localResourceData.value && recommendedPath.value) {
    localResourceData.value.path = recommendedPath.value
  }
  focusStatusOnReturn = false
  sub.value = view
}

function closeSub(focusStatus = false) {
  focusStatusOnReturn = focusStatus
  resetDrafts()
  formOpen.value = false
  sub.value = null
}

const returnFocus = () => (focusStatusOnReturn ? view.value?.statusElement() : null) ?? null

async function back() {
  if (busy.value || (dirty.value && !await askDiscard())) {
    return
  }
  closeSub()
}

async function focusInSub(selector: string) {
  await nextTick()
  subBody.value?.querySelector<HTMLElement>(selector)?.focus()
}

function startForm() {
  if (sub.value === 'from' && !hasRoute.value) {
    return
  }
  status.value = undefined
  resetDrafts()
  formOpen.value = true
  focusInSub('input')
}

async function cancelForm() {
  if (busy.value || (dirty.value && !await askDiscard())) {
    return
  }
  resetDrafts()
  formOpen.value = false
  focusInSub(sub.value === 'to' ? '[data-set-forward], [data-edit-forward]' : '[data-testid="route-redirect-add"]')
}

async function showFailure(title: string, retry: () => void, text = NOT_SAVED, reasons?: string[]) {
  failure.value = { title, text, reasons, retry }
  await nextTick()
  failureAlert.value?.focus()
}

async function endFormWith(where: 'to' | 'from', text: string) {
  resetDrafts()
  formOpen.value = false
  status.value = { where, text }
  focusInSub('[data-testid="routes-status"]')
}

async function handleCreateRedirect() {
  const target = props.pageResource.route
  if (!target || busy.value) {
    return
  }
  const path = normaliseRoutePath(newRedirect.value)
  if (!OLD_ADDRESS.test(path)) {
    redirectError.value = 'Start with /, for example /old-kitchens.'
    focusInSub('input')
    return
  }
  redirectError.value = undefined
  failure.value = undefined
  submitting.value = true
  const newResource = await $cwa.resourcesManager.createResource({
    endpoint: '/_/routes',
    data: {
      name: path,
      path,
      redirect: target,
    },
  })
  submitting.value = false
  if (!newResource) {
    showFailure('The old address wasn\'t added.', handleCreateRedirect)
    return
  }
  await loadResource()
  endFormWith('from', `${path} now redirects here.`)
}

async function handleSaveRoute() {
  if (busy.value || routeDisabledReason.value) {
    return
  }
  failure.value = undefined
  const adding = !hasRoute.value
  const oldPath = resource.value?.path as string | undefined
  const newPath = localResourceData.value?.path as string
  const moved = !adding && newPath !== oldPath
  const childrenUnder = childPaths.value.some(path => path.startsWith(`${oldPath}/`))
  const cascadeData = moved && childrenUnder && cascade.value ? { cascadeChildPaths: true } : undefined

  const savedResource = await saveResource(false, cascadeData)
  if (!savedResource) {
    const reasons = serverReasons()
    showFailure(adding ? 'The route wasn\'t added.' : 'The route wasn\'t saved.', handleSaveRoute, reasons.length ? 'What you typed is still here.' : NOT_SAVED, reasons)
    return
  }
  status.value = {
    where: 'route',
    text: adding ? `Route added: ${newPath}.` : moved ? `Route changed to ${newPath}. ${oldPath} now redirects here.` : 'Route saved.',
  }
  isLoadingRoute.value = true
  emit('reload')
  closeSub(true)

  if (routeIriFromPage.value === savedResource['@id']) {
    await loadResource()
  }
  await loadChildRoutes()
}

function serverReasons() {
  const fieldReasons = Object.entries(routeForm?.fieldErrors ?? {}).map(([field, message]) => `${FIELD_LABELS[field] ?? field}: ${message}`)
  return [...new Set([...(routeForm?.formError ? [routeForm.formError] : []), ...fieldReasons])]
}

function navigateFromDeleted(path: string | undefined) {
  if (path === route.path) {
    const iri = $cwa.resources.isDataPage.value ? $cwa.resources.pageDataIri.value : $cwa.resources.pageIri.value
    iri && navigateTo(getInternalResourceLink(iri))
  }
}

async function editingNoticeFor(iri: string | undefined) {
  return iri ? import('#cwa/admin/resource-confirm').then(({ editingNotice }) => editingNotice($cwa, iri)).catch(() => undefined) : undefined
}

async function handleDeleteRoute() {
  const deletingPath = resource.value?.path as string | undefined
  if (!deletingPath || busy.value) {
    return
  }
  const notice = await editingNoticeFor(resource.value?.['@id'])
  const lines = [...(notice ? [{ text: notice }] : []), { text: `Visitors to ${deletingPath} get “Page not found”.` }]
  redirectCount.value && lines.push({ text: `Its ${redirectCount.value} old ${redirectCount.value === 1 ? 'address goes' : 'addresses go'} too.` })
  childCount.value && lines.push({ text: `The ${childCount.value} child ${childCount.value === 1 ? 'route keeps its path' : 'routes keep their paths'}.` })
  const confirmed = await confirm({
    title: `Delete the route ${deletingPath}?`,
    lines,
    keep: 'Don\'t delete',
    go: 'Delete route',
    typed: redirectCount.value || childCount.value ? { noun: 'path', value: deletingPath } : undefined,
  })
  if (!confirmed) {
    return
  }
  failure.value = undefined
  deleting.value = true
  const deleted = await deleteResource(undefined, () => navigateFromDeleted(deletingPath), true)
  deleting.value = false
  if (!deleted) {
    showFailure('The route wasn\'t deleted.', handleDeleteRoute, NOT_DELETED)
    return
  }
  status.value = { where: 'route', text: `Route ${deletingPath} deleted.` }
  closeSub(true)
}

async function handleDeleteRedirect(redirect: CwaResource) {
  const nested = countRedirects(redirect.redirectedFrom)
  const notice = await editingNoticeFor(redirect['@id'])
  const confirmed = await confirm({
    title: `Delete the old address ${redirect.path}?`,
    lines: [
      ...(notice ? [{ text: notice }] : []),
      nested ? { text: `Its ${nested} old ${nested === 1 ? 'address goes' : 'addresses go'} too.` } : { text: `Visitors to ${redirect.path} get “Page not found”.` },
    ],
    keep: 'Don\'t delete',
    go: 'Delete',
    typed: nested ? { noun: 'old address', value: redirect.path } : undefined,
  })
  if (!confirmed) {
    return
  }
  failure.value = undefined
  submitting.value = true
  await $cwa.resourcesManager.deleteResource({
    endpoint: redirect['@id'],
    requestCompleteFn: () => navigateFromDeleted(redirect.path),
  }, true)
  await loadResource()
  submitting.value = false
  if (hasRedirect(resource.value?.redirectedFrom, redirect['@id'])) {
    showFailure('The old address wasn\'t deleted.', () => handleDeleteRedirect(redirect), NOT_DELETED)
    return
  }
  status.value = { where: 'from', text: `${redirect.path} no longer redirects here.` }
  focusInSub('[data-testid="routes-status"]')
}

function hasRedirect(list: CwaResource[] | undefined, iri: string): boolean {
  return (list ?? []).some(redirect => redirect['@id'] === iri || hasRedirect(redirect.redirectedFrom, iri))
}

async function handleSetForwardTo() {
  const targetIri = forwardPick.value
  if (!targetIri || forwardDisabledReason.value || busy.value) {
    return
  }
  failure.value = undefined
  submitting.value = true
  const saved = await $cwa.resourcesManager.updateResource({
    endpoint: resource.value?.['@id'],
    data: { redirect: targetIri },
  })
  submitting.value = false
  if (!saved) {
    showFailure('The redirect wasn\'t saved.', handleSetForwardTo)
    return
  }
  await loadResource()
  endFormWith('to', `Visitors to ${resource.value?.path} are now sent to ${pathOfRouteIri(targetIri)}.`)
}

async function handleRemoveForwardTo() {
  if (busy.value) {
    return
  }
  const confirmed = await confirm({
    title: 'Stop redirecting?',
    description: `Visitors to ${resource.value?.path} will see this ${props.noun} again.`,
    keep: 'Keep redirecting',
    go: 'Stop redirecting',
  })
  if (!confirmed) {
    return
  }
  failure.value = undefined
  removingForward.value = true
  const saved = await $cwa.resourcesManager.updateResource({
    endpoint: resource.value?.['@id'],
    data: { redirect: null },
  })
  removingForward.value = false
  if (!saved) {
    showFailure('The redirect wasn\'t removed.', handleRemoveForwardTo, 'The server couldn\'t save it. Nothing changed.')
    return
  }
  await loadResource()
  status.value = { where: 'to', text: `Not redirecting any more. Visitors to ${resource.value?.path} see this ${props.noun}.` }
  focusInSub('[data-testid="routes-status"]')
}

watch(routeIriFromPage, async () => {
  await loadResource()
})

watch(() => props.pageResource['@id'], () => {
  closeSub()
  status.value = undefined
  forgetChildDetails()
  if (!routeIriFromPage.value) {
    loadResource()
  }
})

const defaultResource = computed(() => {
  const obj: {
    path: string
    pageData?: string
    page?: string
  } = {
    path: '',
  }
  if (props.pageResource['@type'] === 'Page') {
    obj.page = props.pageResource['@id']
  }
  else {
    obj.pageData = props.pageResource['@id']
  }
  return obj
})

const { isLoading: isLoadingRoute, isUpdating, resource, localResourceData, loadResource, deleteResource, saveResource, resetResource, apiState, form: routeForm } = useItemPage({
  createEndpoint: '/_/routes',
  emit,
  resourceType: 'Route',
  defaultResource,
  validate(data) {
    data.name = data.path
    return true
  },
  endpoint,
  iri: routeIriFromPage,
  excludeFields: ['redirectedFrom', 'redirect'],
  dismissStoredErrors: true,
  openCreated: false,
})

const routePublication = computed(() => routePublicationFromResource(resource.value))

watch(resource, (res) => {
  if (res?.['@id']) {
    loadChildRoutes()
  }
  else {
    childRoutes.value = []
  }
}, { immediate: true })

watch(apiState, (newState) => {
  if (newState?.status === CwaResourceApiStatuses.SUCCESS && !newState?.path?.endsWith('/redirects')) {
    isLoadingRoute.value = true
    loadResource()
  }
})
</script>
