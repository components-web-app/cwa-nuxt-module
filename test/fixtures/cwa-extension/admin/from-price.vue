<template>
  <span data-testid="fixture-from-price">{{ from }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { money } from '../order-format'

const props = defineProps<{ data: Record<string, any> }>()

const from = computed(() => {
  const prices = ((props.data.variants ?? []) as { price?: number }[]).map(variant => variant.price).filter((price): price is number => typeof price === 'number')
  return prices.length ? money(Math.min(...prices)) : undefined
})
</script>
