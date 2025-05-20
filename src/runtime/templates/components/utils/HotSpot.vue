<script setup lang="ts">
import { onMounted } from 'vue'
import { useCwa } from '#cwa/runtime/composables/cwa'

const props = withDefaults(defineProps<{
  screenReaderAction?: string
  iri?: string
}>(), {
  screenReaderAction: 'Hot Spot Button',
  iri: undefined,
})

const $cwa = useCwa()
onMounted(() => {
  if (props.iri) {
    $cwa.admin.eventBus.emit('componentMounted', props.iri + '_placeholder')
  }
})
</script>

<template>
  <button class="cwa-hot-spot cwa:relative cwa:rounded-full cwa:bg-magenta cwa:w-10 cwa:h-10 cwa:m-4 cwa:outline-magenta cwa:cursor-pointer">
    <span class="cwa:sr-only">{{ screenReaderAction }}</span>
  </button>
</template>

<style>
@keyframes large-expand {
  0% {
    transform: scale(1.1);
  }
  37% {
    transform: scale(1.5);
  }
  40% {
    transform: scale(1.5);
  }
  100% {
    transform: scale(1.1);
  }
}
@keyframes small-expand {
  12% {
    transform: scale(1);
  }
  40% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

.cwa-hot-spot {
  &:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: inherit;
    border-radius: 100%;
    opacity: .16;
    animation: large-expand 2s infinite;
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
    opacity: .38;
    animation: small-expand 2s infinite;
  }
}
</style>
