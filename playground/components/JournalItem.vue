<script lang="ts" setup>
import { DateFormatter, getLocalTimeZone, parseDate } from '@internationalized/date'
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'

const df = new DateFormatter('en-GB', {
  dateStyle: 'medium',
})

const { item } = defineProps<{
  item: CwaResource
  route: RouteLocationRaw
}>()

const currentDateObject = computed(() => {
  if (!item.date) {
    return
  }
  return parseDate(item.date.split('T')[0])
})

const displayDateParts = computed(() => {
  if (!currentDateObject.value) {
    return []
  }
  return df.formatToParts(currentDateObject.value.toDate(getLocalTimeZone()))
})

const nthNumber = (number: number) => {
  if (number > 3 && number < 21) return `${number}th`
  const remainder = number % 10
  switch (remainder) {
    case 1:
      return `${number}st`
    case 2:
      return `${number}nd`
    case 3:
      return `${number}rd`
    default:
      return `${number}th`
  }
}

const formattedDate = computed(() => {
  const copy = [...displayDateParts.value]
  const date = copy.shift()
  if (!date?.value) {
    return 'Unknown'
  }
  return nthNumber(Number(date.value)) + copy.map(o => o.value).join('')
})
</script>

<template>
  <CwaLink
    :to="route"
    class="relative p-6 h-full group"
    :class="[item.routePath ? 'bg-stone-500' : 'bg-stone-500/50 hover:bg-stone-500/90 transtition duration-500']"
    itemscope
    itemtype="http://schema.org/BlogPosting"
  >
    <div
      v-if="!item.routePath"
      class="animate-pulse flex gap-x-3 absolute z-10 items-center bottom-2 left-3"
    >
      <div class="size-3 cwa:bg-orange rounded-full outline-2 outline-offset-2 cwa:outline-orange" /><span class="font-bold text-stone-700">No public route</span>
    </div>
    <div
      :class="{ 'opacity-60 group-hover:opacity-100 transition duration-500': !item.routePath }"
    >
      <div
        class="bg-stone-500 w-full aspect-square relative"
      >
        <div
          v-if="!item.image"
          class="absolute inset-0 h-full w-full text-black/50 flex justify-center items-center font-bold bg-stone-100/30"
        >
          No Image
        </div>
        <CollectionImage
          v-else
          :iri="item.image"
          class="absolute inset-0 h-full w-full object-cover"
        />
        <NuxtImg
          v-if="item.imageSrc"
          itemprop="sharedContent"
          class="min-w-full"
          provider="cloudinary"
          :alt="`Kitchen image for journal '${item.title}'`"
          :src="item.imageSrc"
          sizes="100vw sm:100vw md:50vw lg:800px"
          densities="x1 x2"
          format="webp"
          loading="lazy"
          :modifiers="{ aspectRatio: '1:1', gravity: 'face:center' }"
          fit="fill"
        />
      </div>
      <span class="block pt-4 pb-6">
        <data
          v-if="displayDateParts"
          :value="currentDateObject?.toString()"
          itemprop="dateCreated"
        >
          <time
            :datetime="item.createdAt"
            class="mr-8"
          >{{ formattedDate }}</time>
        </data>
        <span
          itemprop="headline"
          class="block font-bold"
        >{{ item.title }}</span>
      </span>
    </div>
  </CwaLink>
</template>
