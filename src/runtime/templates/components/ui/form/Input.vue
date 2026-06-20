<script setup lang="ts">
const [model, modifiers] = defineModel<string | number | undefined | null>({
  set(value) {
    if (modifiers.nullable) {
      value ||= null
    }
    return value
  },
})
</script>

<template>
  <input
    v-model="model"
    class="cwa:disabled:opacity-50 cwa:disabled:cursor-not-allowed cwa:disabled:pointer-events-none cwa:disabled:select-none cwa:text-light cwa:w-full cwa:dark-blur cwa:border-0 cwa:outline-dotted cwa:outline-1 cwa:outline-stone-700 cwa:[outline-offset:-1px] cwa:hover:outline-stone-400 cwa:focus-visible:ring-0 cwa:focus-visible:[outline-style:solid] cwa:focus-visible:outline-2 cwa:focus-visible:outline-stone-500 cwa:focus-visible:[outline-offset:-2px]"
  >
</template>
