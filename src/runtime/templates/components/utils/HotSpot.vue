<script setup lang="ts">
import { onMounted } from 'vue'
import { useCwa } from '#cwa/runtime/composables/cwa'

const props = withDefaults(defineProps<{
  screenReaderAction?: string
  iri?: string
  disabled?: boolean
}>(), {
  screenReaderAction: 'Hot Spot Button',
  iri: undefined,
  disabled: false,
})

const $cwa = useCwa()
onMounted(() => {
  if (props.iri) {
    $cwa.admin.eventBus.emit('componentMounted', props.iri + '_placeholder')
  }
})
</script>

<template>
  <button
    class="cwa:relative cwa:rounded-full  cwa:size-6 cwa:m-0 cwa:cursor-pointer"
    :class="[disabled ? 'cwa:bg-stone-600' : 'cwa:bg-blue-600 cwa:hot-spot']"
  >
    <span class="cwa:sr-only">{{ screenReaderAction }}</span>
  </button>
</template>

<style>
@keyframes large-expand {
  0% {
    transform: scale(1.1);
  }
  37% {
    transform: scale(1.8);
  }
  40% {
    transform: scale(1.8);
  }
  100% {
    transform: scale(1.1);
  }
}
@keyframes small-expand {
  12% {
    transform: scale(1);
  }
  45% {
    transform: scale(1.4);
  }
  100% {
    transform: scale(1);
  }
}

.cwa\:hot-spot {
  &:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: inherit;
    border-radius: 100%;
    opacity: .2;
    animation: large-expand 2s infinite;
    z-index: 0;
  }
  &:after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: inherit;
    border-radius: 100%;
    opacity: .45;
    animation: small-expand 2s infinite;
    z-index: 0;
  }
}
</style>
