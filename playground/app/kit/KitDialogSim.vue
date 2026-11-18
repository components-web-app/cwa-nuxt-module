<script setup lang="ts">
import { computed, nextTick, ref, shallowRef } from 'vue'
import { CwaUiButton, CwaUiDialog, CwaUiFormSection, CwaUiInput, CwaUiSegmented, CwaUiSelect, CwaUiTextarea, CwaUiToggle } from '#components'
import KitSim from './KitSim.vue'
import KitDemo from './KitDemo.vue'
import KitLoadControls from './KitLoadControls.vue'
import { kitLoader } from './fake-loader'
import { fakeDialogForm } from './fake-dialog-form'
import type { FakeDialogForm } from './fake-dialog-form'
import { kitMia } from './fake-save-server'
import { kitPageTypeOptions } from './kit-data'
import { useCwaConfirm } from '../../../src/runtime/composables/cwa-confirm'

type Kind = 'static' | 'dynamic' | 'data' | 'nested'
type NextSave = 'ok' | 'errors' | 'server' | 'offline' | 'conflict'

const kindOptions = [{ value: 'static', label: 'Static page' }, { value: 'dynamic', label: 'Dynamic template' }, { value: 'data', label: 'Page data' }, { value: 'nested', label: 'Nested page' }]
const modeOptions = [{ value: 'edit', label: 'Editing' }, { value: 'add', label: 'Adding' }]
const nextOptions = [{ value: 'ok', label: 'Succeeds' }, { value: 'errors', label: 'Several errors' }, { value: 'server', label: 'Server error' }, { value: 'offline', label: 'Offline' }, { value: 'conflict', label: 'Mia saved first' }]
const layoutOptions = [{ label: 'Main layout', value: '/_/layouts/main' }, { label: 'Landing layout', value: '/_/layouts/landing' }]
const pageUiOptions = [{ label: 'Default page', value: 'CwaPageDefault' }, { label: 'Two columns', value: 'CwaPageTwoColumns' }]
const templateOptions = [{ label: 'Kitchen template', value: '/_/pages/kitchen' }, { label: 'Bathroom template', value: '/_/pages/bathroom' }]
const depthOptions = [{ label: 'Kitchens', value: '0' }, { label: 'Shaker', value: '1' }, { label: 'Painted', value: '2' }]

const kind = ref<Kind>('static')
const mode = ref<'edit' | 'add'>('edit')
const reachable = ref(false)
const nextSave = ref<NextSave>('ok')
const open = ref(false)
const loading = ref(false)
const tab = ref('details')
const depth = ref('2')
const form = shallowRef<FakeDialogForm>()
const result = ref('')

const isPage = computed(() => kind.value !== 'data')
const adding = computed(() => mode.value === 'add')
const title = computed(() => {
  if (adding.value) {
    return isPage.value ? 'New page' : 'New kitchen'
  }
  return { static: 'Kitchens', dynamic: 'Kitchen template', data: 'Shaker kitchen 17', nested: 'Painted shaker' }[kind.value]
})
const pageFields: Record<string, string> = { reference: 'Reference', title: 'SEO page title', metaDescription: 'SEO meta description', layout: 'Layout' }
const dataFields: Record<string, string> = { title: 'Title', metaDescription: 'SEO meta description', page: 'Dynamic page' }
const tabs = computed(() => [
  { label: 'Details', key: 'details', fields: isPage.value ? pageFields : dataFields },
  { label: 'Routes', key: 'routes', ...(adding.value && { disabled: `Routes open once the ${isPage.value ? 'page' : 'kitchen'} is created. Create it and this tab lets you add its address.` }) },
  { label: 'Info', key: 'info' },
])

function stored() {
  return adding.value
    ? { reference: '', title: '', metaDescription: '', pageType: kind.value === 'dynamic' ? 'template' : 'static', layout: null, uiComponent: null, page: null, isReachableWithoutRoute: reachable.value }
    : { reference: title.value, title: `${title.value} | Hand-built`, metaDescription: 'Hand-built shaker kitchens, made to measure.', pageType: kind.value === 'dynamic' ? 'template' : 'static', layout: '/_/layouts/main', uiComponent: 'CwaPageDefault', page: '/_/pages/kitchen', isReachableWithoutRoute: reachable.value }
}

const dialogKind = computed(() => {
  if (isPage.value) {
    return { tone: form.value?.local.pageType === 'template' ? 'dynamic' as const : 'static' as const }
  }
  return reachable.value ? { tone: 'success' as const, label: 'Reachable' } : { tone: 'warning' as const, label: 'Not reachable' }
})

const confirm = useCwaConfirm()

async function deletePage() {
  const go = await confirm({ title: `Delete ${title.value}?`, description: 'Its route is kept, and visitors to it get “Page not found”.', keep: 'Keep it', go: 'Delete page', tone: 'danger' })
  result.value = go ? 'Delete confirmed (nothing deleted in the kit)' : 'Delete cancelled'
}

function armNextSave(target: FakeDialogForm) {
  const firstField = isPage.value ? 'reference' : 'title'
  if (nextSave.value === 'errors') {
    target.failNext({ [firstField]: 'This is already used by another page.', metaDescription: 'Keep it under 160 characters.', ...(isPage.value ? { layout: 'Choose a layout.' } : { page: 'Choose a template.' }) })
  }
  if (nextSave.value === 'server') {
    target.failNext({}, 'The server could not save this page. Try again in a moment.')
  }
  if (nextSave.value === 'offline') {
    target.failNext({}, 'You are offline, so nothing was saved. Your changes are kept.')
  }
  if (nextSave.value === 'conflict') {
    target.conflictNext({ title: `${title.value} | Made to measure`, metaDescription: 'Mia wrote this description.' })
  }
}

async function openDialog(onTab = 'details') {
  form.value = fakeDialogForm(stored(), { title: [kitMia] }, () => new Promise(resolve => setTimeout(resolve, 600)))
  tab.value = onTab
  open.value = true
  loading.value = true
  await kitLoader.wait()
  loading.value = false
}

function changeThree() {
  if (!form.value) {
    return
  }
  const local = form.value.local
  local.title = `${String(local.title || title.value)} (edited)`
  local.metaDescription = 'Changed by the workbench.'
  local[isPage.value ? 'reference' : 'page'] = isPage.value ? `${String(local.reference || 'Page')} 2` : '/_/pages/bathroom'
}

async function save() {
  if (!form.value) {
    return
  }
  armNextSave(form.value)
  nextSave.value = 'ok'
  const failuresBefore = form.value.failures
  await form.value.save()
  result.value = form.value.failures > failuresBefore ? 'Save failed' : 'Saved'
}

async function saveFromInfoAndFail() {
  await openDialog('info')
  changeThree()
  nextSave.value = 'errors'
  await nextTick()
  await save()
}

async function openChanged() {
  await openDialog()
  changeThree()
}
</script>

<template>
  <KitSim
    id="kit-sim-dialogs"
    title="Simulation: dialogs and admin pages"
    intro="CwaUiDialog with a fakeDialogForm, laid out as the page settings modal is. Choose the kind of page, adding or editing, and how the next Save answers, then open it. Closing with changes asks to discard. The header line is the page type (static or dynamic, following the select) or, for page data, Reachable or Not reachable. Delete page asks through the kit confirm. The real PageResourceAdminModal is in the In practice tab."
  >
    <template #controls>
      <CwaUiSegmented
        v-model="kind"
        label="Page"
        :options="kindOptions"
        data-testid="kit-sim-dialogs-kind"
      />
      <CwaUiSegmented
        v-model="mode"
        label="Mode"
        :options="modeOptions"
        data-testid="kit-sim-dialogs-mode"
      />
      <CwaUiToggle
        v-model="reachable"
        label="Reachable without a route"
        :disabled="isPage"
      />
      <CwaUiSegmented
        v-model="nextSave"
        label="Next Save"
        :options="nextOptions"
        data-testid="kit-sim-dialogs-next"
      />
      <KitLoadControls />
      <CwaUiButton
        label="Open"
        size="sm"
        variant="solid"
        data-testid="kit-sim-dialogs-open"
        @click="openDialog()"
      />
      <CwaUiButton
        label="Change three fields"
        size="sm"
        data-testid="kit-sim-dialogs-change"
        @click="openChanged"
      />
      <CwaUiButton
        label="Save from the Info tab, and it fails"
        size="sm"
        data-testid="kit-sim-dialogs-info-fail"
        @click="saveFromInfoAndFail"
      />
    </template>
    <KitDemo
      component="CwaUiDialog"
      :state="`${kindOptions.find(option => option.value === kind)!.label}, ${adding ? 'adding' : 'editing'}${!isPage ? `, ${reachable ? 'reachable' : 'not reachable'} without a route` : ''}, next Save ${nextSave}${result ? `; last: ${result}` : ''}`"
      wide
    >
      <span class="kit-dialog-note">{{ open ? 'Open' : 'Closed' }}</span>
    </KitDemo>
    <CwaUiDialog
      v-if="open && form"
      v-model:tab="tab"
      :title="title"
      :tabs="tabs"
      :form="form"
      :loading="loading"
      :create-noun="adding ? (isPage ? 'page' : 'kitchen') : undefined"
      placement="right"
      :kind="dialogKind"
      data-testid="kit-sim-dialogs-dialog"
      @close="open = false"
      @save="save"
    >
      <template
        v-if="isPage"
        #header-actions
      >
        <CwaUiSelect
          field="pageType"
          label="Page type"
          label-hidden
          width="xs"
          :options="kitPageTypeOptions"
          data-testid="kit-sim-dialogs-page-type"
        />
      </template>
      <template #details>
        <CwaUiFormSection v-if="kind === 'nested'">
          <CwaUiSegmented
            v-model="depth"
            label="Editing"
            :options="depthOptions"
          />
        </CwaUiFormSection>
        <CwaUiFormSection>
          <CwaUiInput
            v-if="isPage"
            field="reference"
            label="Reference"
            description="Only admins see this. It names the page in lists."
          />
          <CwaUiInput
            v-else
            field="title"
            label="Title"
          />
        </CwaUiFormSection>
        <CwaUiFormSection
          v-if="isPage"
          title="Appearance"
          :columns="2"
        >
          <CwaUiSelect
            field="layout"
            label="Layout"
            :options="layoutOptions"
          />
          <CwaUiSelect
            field="uiComponent"
            label="Page UI"
            :options="pageUiOptions"
          />
        </CwaUiFormSection>
        <CwaUiFormSection
          title="Search engines"
          description="What people see in search results."
        >
          <CwaUiInput
            v-if="isPage"
            field="title"
            label="SEO page title"
            optional
          />
          <CwaUiTextarea
            field="metaDescription"
            label="SEO meta description"
            optional
            counter
            :maxlength="160"
          />
        </CwaUiFormSection>
        <CwaUiFormSection
          v-if="!isPage"
          title="Template"
        >
          <CwaUiSelect
            field="page"
            label="Dynamic page"
            :options="templateOptions"
          />
          <CwaUiToggle
            field="isReachableWithoutRoute"
            label="Public without a route"
          />
        </CwaUiFormSection>
      </template>
      <template #routes>
        <CwaUiFormSection
          title="Routes"
          description="Route actions save at once. Try them in the failures simulation."
        />
      </template>
      <template #info>
        <CwaUiFormSection
          title="Delete this page"
          description="Its route is kept, and visitors to it get “Page not found”."
        >
          <div>
            <CwaUiButton
              tone="danger"
              label="Delete page"
              data-testid="kit-sim-dialogs-delete"
              @click="deletePage"
            />
          </div>
        </CwaUiFormSection>
      </template>
    </CwaUiDialog>
  </KitSim>
</template>

<style scoped>
.kit-dialog-note {
  color: var(--cwa-color-fg-muted);
}
</style>
