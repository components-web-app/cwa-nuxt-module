<template>
  <div class="pb-20 flex flex-col space-y-2">
    <CollectionSearch />
    <div v-if="resource?.data?.collection?.['hydra:member']" class="flex flex-wrap -mx-4">
      <article v-for="post of resource.data.collection['hydra:member']" :key="post['@id']" class="mx-4 my-4 w-[calc(25%-2rem)] relative isolate flex flex-col justify-end overflow-hidden rounded-2xl bg-gray-900 px-8 pb-8 pt-80 sm:pt-48 lg:pt-60">
        <img v-if="post.image" :src="post.image" alt="" class="absolute inset-0 -z-10 h-full w-full object-cover">
        <div v-else class="absolute inset-0 -z-10 h-full w-full text-white flex justify-center items-center font-bold">
          No Image
        </div>
        <div class="absolute inset-0 -z-10 bg-gradient-to-t from-gray-900 via-gray-900/40" />
        <div class="absolute inset-0 -z-10 rounded-2xl ring-1 ring-inset ring-gray-900/10" />
        <div class="flex flex-wrap items-center gap-y-1 overflow-hidden text-sm leading-3 text-gray-300">
          <time :datetime="post.createdAt" class="mr-8">{{ formatDate(post.createdAt) }}</time>
        </div>
        <h3 class="mt-3 text-lg font-semibold leading-6 text-white">
          <NuxtLink :to="post.routePath">
            <span class="absolute inset-0" />
            {{ post.title }}
          </NuxtLink>
        </h3>
      </article>
    </div>
    <CollectionPagination class="w-full" />
  </div>
</template>

<script setup lang="ts">
import type { IriProp } from '#cwa/runtime/composables/cwa-resource'
import { toRef } from 'vue'
import dayjs from 'dayjs'
import { useCwaResource } from '#imports'

const props = defineProps<IriProp>()

const { getResource, exposeMeta } = useCwaResource(toRef(props, 'iri'))
const resource = getResource()

function formatDate (dateStr:string) {
  return dayjs(dateStr).format('DD/MM/YY')
}

defineExpose(exposeMeta)
</script>
