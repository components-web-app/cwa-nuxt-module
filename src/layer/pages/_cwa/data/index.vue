<template>
  <ListHeading title="Data Page Types" :hide-add="true" />
  <ListContainer>
    <ul class="cwa-my-6 cwa-flex cwa-flex-col cwa-space-y-4">
      <li v-for="pageData of dataTypes" :key="pageData['@id']">
        <div class="cwa-flex cwa-p-4 cwa-border cwa-border-stone-700 cwa-py-6 cwa-space-x-4 cwa-items-center cwa-bg-dark/80 hover:cwa-bg-dark cwa-cursor-pointer cwa-transition-colors">
          <div class="cwa-grow cwa-flex cwa-flex-col cwa-space-y-1">
            <div class="cwa-flex cwa-items-center cwa-space-x-3">
              <span class="cwa-text-xl">{{ pageData.resourceClass }}</span>
            </div>
          </div>
          <div class="cwa-flex cwa-space-x-2">
            <CwaUiFormButton>
              <CwaUiIconArrowIcon class="cwa-w-5 -cwa-rotate-90 cwa-my-2" />
              <span class="cwa-sr-only">View</span>
            </CwaUiFormButton>
          </div>
        </div>
      </li>
    </ul>
  </ListContainer>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ListHeading from '#cwa/runtime/templates/components/core/admin/ListHeading.vue'
import ListContainer from '#cwa/runtime/templates/components/core/admin/ListContainer.vue'
import { useCwa } from '#imports'
import type { PageDataMetadataResource } from '#cwa/runtime/storage/stores/api-documentation/state'

const $cwa = useCwa()
const dataTypes = ref<PageDataMetadataResource[]>([])

onMounted(async () => {
  if (!$cwa.auth.user?.['@id']) {
    return
  }
  // need to fetch a resource to get the docs from link header if not set - user should always be there as we are logged in
  await $cwa.fetchResource({
    path: $cwa.auth.user?.['@id']
  })
  const docs = await $cwa.getApiDocumentation()
  const datas = docs?.pageDataMetadata?.['hydra:member']
  if (!datas) {
    return
  }
  dataTypes.value = datas.filter(data => (!data.resourceClass.endsWith('\\AbstractPageData')))
})

</script>
