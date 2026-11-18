<script setup lang="ts">
import { computed } from 'vue'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import CwaUiInput from '#cwa/templates/components/ui/Input.vue'
import CwaUiTree from '#cwa/templates/components/ui/Tree.vue'
import type { TreeAction, TreeNode } from '#cwa/templates/components/ui/Tree.vue'
import CwaUiPlusIcon from '#cwa/templates/components/ui/icon/PlusIcon.vue'
import BinIcon from '#cwa/templates/components/ui/icon/BinIcon.vue'
import RouteSubStatus from '#cwa/templates/components/core/admin/RouteSubStatus.vue'
import type { CwaResource } from '#cwa/resources/resource-utils'

const { redirects = [], path, form = false, error, status, busy = false } = defineProps<{
  redirects?: CwaResource[]
  path: string
  form?: boolean
  error?: string
  status?: string
  busy?: boolean
}>()

const oldAddress = defineModel<string>({ default: '' })

const emit = defineEmits<{
  start: []
  delete: [redirect: CwaResource]
}>()

const byKey = computed(() => {
  const map = new Map<string, CwaResource>()
  const walk = (list: CwaResource[]) => list.forEach((redirect) => {
    map.set(redirect['@id'], redirect)
    redirect.redirectedFrom?.length && walk(redirect.redirectedFrom)
  })
  walk(redirects)
  return map
})

function toNodes(list: CwaResource[]): TreeNode[] {
  return list.map(redirect => ({
    key: redirect['@id'],
    label: redirect.path,
    children: redirect.redirectedFrom?.length ? toNodes(redirect.redirectedFrom) : undefined,
  }))
}

const nodes = computed(() => toNodes(redirects))

function actions(node: TreeNode): TreeAction[] {
  return [{
    label: `Delete the redirect from ${node.label}`,
    icon: BinIcon,
    danger: true,
    delete: true,
    run: () => {
      const redirect = byKey.value.get(node.key)
      !busy && redirect && emit('delete', redirect)
    },
  }]
}

const preview = computed(() => oldAddress.value.trim())
</script>

<template>
  <div
    data-testid="route-redirects"
    class="cwa:flex cwa:flex-col cwa:gap-stack"
  >
    <RouteSubStatus :text="status" />
    <template v-if="form">
      <CwaUiInput
        v-model="oldAddress"
        label="Old address"
        placeholder="/old-path"
        width="full"
        :invalid="error"
        description="A path on this site, starting with /."
        data-testid="route-redirect-input"
      />
      <p
        v-if="preview"
        data-testid="route-redirect-preview"
        class="cwa:m-0 cwa:text-control cwa:text-fg"
      >
        <span class="cwa:font-mono">{{ preview }}</span><span aria-hidden="true"> → </span><span class="cwa:sr-only"> will redirect to </span>this page <span class="cwa:font-mono cwa:text-fg-muted">({{ path }})</span>
      </p>
    </template>
    <template v-else>
      <p class="cwa:m-0 cwa:text-helper cwa:text-fg-muted">
        Old addresses that send visitors here. One that sends visitors to another is shown under it.
      </p>
      <div>
        <CwaUiButton
          :icon="CwaUiPlusIcon"
          label="Add"
          aria-label="Add an old address"
          :disabled="busy"
          data-testid="route-redirect-add"
          @click="emit('start')"
        />
      </div>
      <div :aria-busy="busy ? 'true' : undefined">
        <CwaUiTree
          label="Redirected from"
          :nodes="nodes"
          :actions="actions"
          empty="No old addresses send visitors here."
        >
          <template #label="{ node, parent }">
            <span class="cwa:font-mono">{{ node.label }}</span><span
              aria-hidden="true"
              class="cwa:text-fg-muted"
            > → </span><span class="cwa:sr-only"> redirects to </span><span
              v-if="parent"
              class="cwa:font-mono cwa:text-fg-muted"
            >{{ parent.label }}</span><span
              v-else
              class="cwa:text-fg-muted"
            >this page</span>
          </template>
        </CwaUiTree>
      </div>
    </template>
  </div>
</template>
