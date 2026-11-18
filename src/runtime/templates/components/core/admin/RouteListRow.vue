<template>
  <ListRow
    :to="linkTo"
    :view="linkTo ? data.path : undefined"
    actions
    :title="data.path"
    :sub="subLine"
  >
    <template #phone>
      <RouteStatusBadge
        :publication="routePublication"
        :now="now"
      />
      <span class="cwa:truncate">{{ subLine }}</span>
    </template>
    <ListCell>
      <RouteStatusBadge
        :publication="routePublication"
        :now="now"
      />
    </ListCell>
    <template #actions>
      <CwaUiButton
        v-if="!relatedResource && !data.redirect"
        variant="ghost"
        tone="danger"
        icon-only
        :icon="BinIcon"
        :label="`Delete the route ${data.path}`"
        data-testid="route-delete"
        @click="$emit('delete', data['@id'])"
      />
    </template>
  </ListRow>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { computed } from 'vue'
import ListRow from '#cwa/templates/components/core/admin/ListRow.vue'
import ListCell from '#cwa/templates/components/core/admin/ListCell.vue'
import RouteStatusBadge from '#cwa/templates/components/core/admin/RouteStatusBadge.vue'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import BinIcon from '#cwa/templates/components/ui/icon/BinIcon.vue'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { routePublicationFromResource } from '#cwa/resources/route-publication'

const props = defineProps<{
  data: CwaResource
  linkFn: (iri: string, routeName?: string, hash?: string, params?: { [key: string]: string }) => RouteLocationRaw
  now?: Date
  associatedResources?: {
    redirect?: string
    page?: string
    pageData?: string
    pageDataType?: string
  }
}>()

defineEmits<{
  delete: [string]
}>()

const routePublication = computed(() => routePublicationFromResource(props.data))

const linkTo = computed(() => {
  const target = props.associatedResources?.pageData ? props.data.pageData : (props.associatedResources?.page ? props.data.page : undefined)
  return target ? props.linkFn(target, '_cwa-routes', '#routes') : undefined
})

const relatedResource = computed(() => props.associatedResources?.redirect || props.associatedResources?.pageData || props.associatedResources?.page)

const subLine = computed(() => {
  const related = props.associatedResources
  if (related?.redirect) {
    return `Redirects to ${related.redirect}`
  }
  if (related?.pageData) {
    return `${related.pageDataType ? `${related.pageDataType.split('\\').pop()}: ` : ''}${related.pageData}`
  }
  if (related?.page) {
    return `Page: ${related.page}`
  }
  return 'Nothing uses this route, so it can be deleted.'
})
</script>
