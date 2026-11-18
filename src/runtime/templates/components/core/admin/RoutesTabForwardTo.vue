<script setup lang="ts">
import { computed } from 'vue'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import CwaUiAlert from '#cwa/templates/components/ui/Alert.vue'
import CwaUiResourceSearch from '#cwa/templates/components/ui/ResourceSearch.vue'
import RouteSubStatus from '#cwa/templates/components/core/admin/RouteSubStatus.vue'
import type { CwaResource } from '#cwa/resources/resource-utils'

const { path, forwardToPath, form = false, currentRouteIri, removing = false, status, pickedPath } = defineProps<{
  path: string
  forwardToPath?: string
  form?: boolean
  currentRouteIri: string
  removing?: boolean
  status?: string
  pickedPath?: string
}>()

const pick = defineModel<string | null | undefined>()

defineEmits<{
  start: []
  remove: []
}>()

const isSelf = computed(() => !!pick.value && pick.value === currentRouteIri)

const labelOf = (resource: CwaResource) => resource.path ?? resource['@id']
</script>

<template>
  <div
    data-testid="route-forward"
    class="cwa:flex cwa:flex-col cwa:gap-stack"
  >
    <RouteSubStatus :text="status" />
    <p class="cwa:m-0 cwa:text-helper cwa:text-fg-muted">
      Sends visitors from this page's address to another page instead.
    </p>
    <template v-if="form">
      <CwaUiResourceSearch
        v-model="pick"
        label="Send visitors to"
        endpoint="/_/routes"
        :search-params="['search', 'path']"
        noun="routes"
        width="full"
        :label-of="labelOf"
        :info="isSelf ? undefined : 'Any page on this site.'"
        data-testid="route-forward-search"
      />
      <CwaUiAlert
        v-if="isSelf"
        tone="danger"
        title="A route cannot redirect to itself."
        data-testid="route-forward-self"
      >
        Choose another page.
      </CwaUiAlert>
      <CwaUiAlert
        v-else-if="pick"
        tone="warning"
        title="Visitors will no longer see this page."
        data-testid="route-forward-warning"
      >
        Visitors to <span class="cwa:font-mono">{{ path }}</span> will be sent to <span class="cwa:font-mono">{{ pickedPath ?? 'the page you chose' }}</span>.
      </CwaUiAlert>
    </template>
    <div
      v-else-if="forwardToPath"
      class="cwa:flex cwa:flex-col cwa:gap-3"
    >
      <p
        data-testid="route-forward-direction"
        class="cwa:m-0 cwa:text-control cwa:text-fg"
      >
        <span class="cwa:font-mono">{{ path }}</span><span aria-hidden="true"> → </span><span class="cwa:sr-only"> redirects to </span><span class="cwa:font-mono">{{ forwardToPath }}</span>
      </p>
      <p class="cwa:m-0 cwa:text-helper cwa:text-fg-muted">
        Visitors never see this page.
      </p>
      <div class="cwa:flex cwa:flex-wrap cwa:gap-actions">
        <CwaUiButton
          label="Change"
          data-edit-forward
          :disabled="removing"
          @click="$emit('start')"
        />
        <CwaUiButton
          tone="danger"
          :label="removing ? 'Removing…' : 'Remove'"
          :loading="removing"
          data-remove-forward
          @click="$emit('remove')"
        />
      </div>
    </div>
    <div
      v-else
      class="cwa:flex cwa:flex-col cwa:gap-3"
    >
      <p
        data-testid="route-forward-off"
        class="cwa:m-0 cwa:text-control cwa:text-fg"
      >
        Not redirecting. Visitors to <span class="cwa:font-mono">{{ path }}</span> see this page.
      </p>
      <div>
        <CwaUiButton
          label="Redirect to another page"
          data-set-forward
          @click="$emit('start')"
        />
      </div>
    </div>
  </div>
</template>
