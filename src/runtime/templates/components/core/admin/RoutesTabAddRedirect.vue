<script setup lang="ts">
import { computed, ref } from 'vue'
import ModalInput from '#cwa/runtime/templates/components/core/admin/form/ModalInput.vue'

defineProps<{
  disableButtons: boolean
  routePath: string
}>()

defineEmits<{
  create: [path: string]
}>()

const newRedirectPath = ref<string>('')

const finalPath = computed(() => {
  return newRedirectPath.value?.startsWith('/') ? newRedirectPath.value : `/${newRedirectPath.value}`
})
</script>

<template>
  <div class="cwa:flex cwa:flex-col cwa:gap-y-6">
    <div class="cwa:flex cwa:flex-col cwa:gap-y-4">
      <div>
        <ModalInput
          v-model="newRedirectPath"
          label="Redirect from path"
          placeholder="/some-path"
        />
      </div>
      <div class="cwa:text-sm cwa:text-stone-300 cwa:flex cwa:flex-col cwa:gap-y-2 cwa:leading-6">
        <p
          v-if="newRedirectPath"
        >
          <span class="cwa:max-w-full cwa:truncate cwa:inline-block cwa:align-bottom cwa:font-bold cwa:bg-dark cwa:px-2">{{ finalPath }}</span>
          will be redirected to
          <span class="cwa:max-w-full cwa:truncate cwa:inline-block cwa:align-bottom cwa:font-bold cwa:bg-dark cwa:px-2">{{ routePath }}</span>
        </p>
      </div>
    </div>
    <div class="cwa:flex cwa:justify-start">
      <CwaUiFormButton
        color="blue"
        :disabled="disableButtons"
        @click="$emit('create', newRedirectPath)"
      >
        Create Redirect
      </CwaUiFormButton>
    </div>
  </div>
</template>
