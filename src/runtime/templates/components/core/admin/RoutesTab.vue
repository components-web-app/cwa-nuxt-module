<template>
  <div>
    <div v-if="isViewing">
      <CwaUiFormButton @click="goToEditRoute">
        Edit
      </CwaUiFormButton>
    </div>
    <div v-else>
      <div>
        <button @click="goBackToViewing">
          &lt; Back to Routes
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'

const isViewing = ref(true)

function goToEditRoute () {
  isViewing.value = false
}
function goBackToViewing () {
  isViewing.value = true
}
</script>
