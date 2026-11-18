<script setup lang="ts">
import { computed } from 'vue'
import CwaUiBadge from '#cwa/templates/components/ui/Badge.vue'
import RouteStatusBadge from '#cwa/templates/components/core/admin/RouteStatusBadge.vue'
import { routePublicationFromResource } from '#cwa/resources/route-publication'
import type { CwaResource } from '#cwa/resources/resource-utils'

const { resource, route, known, now } = defineProps<{
  resource: CwaResource
  route?: CwaResource
  known: boolean
  now?: Date
}>()

const templateText = computed(() => {
  const count = resource._metadata?.pageDataCount
  if (typeof count !== 'number') {
    return 'Template'
  }
  return count ? `Template · ${count} ${count === 1 ? 'page' : 'pages'}` : 'Template · unused'
})
</script>

<template>
  <CwaUiBadge
    v-if="resource.isTemplate"
    data-testid="page-status-template"
  >
    {{ templateText }}
  </CwaUiBadge>
  <CwaUiBadge
    v-else-if="!resource.route && resource.isReachableWithoutRoute"
    tone="success"
    dot
    data-testid="page-status-public"
  >
    Public without a route
  </CwaUiBadge>
  <CwaUiBadge
    v-else-if="!resource.route"
    dot
    data-testid="page-status-no-route"
  >
    No route
  </CwaUiBadge>
  <RouteStatusBadge
    v-else-if="known && route"
    :publication="routePublicationFromResource(route)"
    :now="now"
  />
</template>
