<script setup lang="ts">
import { computed } from 'vue'
import { useCwa } from '#imports'
import { getPublishedResourceState } from '#cwa/runtime/resources/resource-utils'
const $cwa = useCwa()

const currentIri = $cwa.admin.componentManager.currentStackItem

const isLive = computed((): undefined|boolean => {
  if (!currentIri.value) {
    return
  }
  const resource = $cwa.resources.getResource(currentIri.value.iri).value
  if (!resource) {
    return
  }
  return getPublishedResourceState(resource)
})
</script>

<template>
  <svg
    v-if="isLive === true"
    width="13px"
    height="20px"
    viewBox="0 0 13 20"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
      <g transform="translate(-4.000000, 0.000000)" fill="#9CDD05" fill-rule="nonzero">
        <g transform="translate(4.000000, 0.000000)">
          <path d="M4.8672367,19.8951529 L12.9398782,6.61217947 C13.1226376,6.31143717 12.863439,5.94135892 12.5028254,5.98823393 L7.13310939,6.68569512 L8.4161038,0.248895968 C8.45935126,0.0319037034 8.16659292,-0.092432278 8.02704015,0.0836224717 L0.0898637309,10.0957354 C-0.14133442,10.3873371 0.103475645,10.8019856 0.484200465,10.7637044 L6.40427929,10.1681963 L4.46349835,19.7505435 C4.41669462,19.9816764 4.74350318,20.0987467 4.8672367,19.8951529 Z" />
        </g>
      </g>
    </g>
  </svg>
  <svg
    v-else-if="isLive === false"
    width="20px"
    height="20px"
    viewBox="0 0 20 20"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
      <g fill="#FFAA00" fill-rule="nonzero">
        <path d="M20,3.87088785 L15.3998598,0.0493925234 L14.1001402,1.5882243 L18.7002336,5.40920561 L20,3.87088785 Z M5.85009346,1.53827103 L4.54981308,0 L0,3.87088785 L1.29971963,5.40915888 L5.85009346,1.53827103 Z M10.5000467,6.10411215 L9,6.10411215 L9,12.0595327 L13.7499533,14.8884579 L14.5,13.6476636 L10.5,11.3150935 L10.5,6.10411215 L10.5000467,6.10411215 Z M10,2.1338785 C5,2.1338785 0.999953271,6.1535514 0.999953271,11.0668692 C0.999953271,15.9803738 5,20 10,20 C14.9502804,20 19.0000467,15.9803738 19.0000467,11.0668692 C19.0000467,6.15359813 14.9502804,2.1338785 10,2.1338785 Z M10,18.0149533 C6.14985981,18.0149533 3,14.8885047 3,11.0669159 C3,7.24556075 6.14985981,4.11906542 10,4.11906542 C13.8501869,4.11906542 17,7.24551402 17,11.0669159 C17,14.9378972 13.8501869,18.0149533 10,18.0149533 Z" />
      </g>
    </g>
  </svg>
</template>
