<script setup lang="ts">
import { computed } from 'vue'
import slugify from 'slugify'
import ModalInfo from '#cwa/runtime/templates/components/core/admin/form/ModalInfo.vue'
import ModalInput from '#cwa/runtime/templates/components/core/admin/form/ModalInput.vue'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'

const { pageResource } = defineProps<{
  disableButtons: boolean
  pageResource: CwaResource
  currentPath: string
}>()

const pathModel = defineModel<string>({ required: true })

defineEmits<{
  save: []
  delete: []
  generate: []
}>()

const recommendedRoute = computed(() => {
  if (!pageResource.title) {
    return
  }
  return '/' + slugify(pageResource.title.toLowerCase())
})

const pageResourceRouteIri = computed(() => pageResource.route)
</script>

<template>
  <div
    class="cwa:flex cwa:flex-col cwa:gap-y-6"
  >
    <div class="cwa:flex cwa:flex-col cwa:gap-y-4">
      <div>
        <ModalInput
          v-model="pathModel"
          label="Route path"
          :placeholder="recommendedRoute"
        />
      </div>
      <div>
        <p class="cwa:text-sm cwa:text-stone-300">
          When updating, we will automatically create a new redirect from the old path.
        </p>
      </div>
      <div class="cwa:flex cwa:justify-between">
        <div>
          <CwaUiFormButton
            color="blue"
            :disabled="disableButtons"
            @click="$emit('save')"
          >
            Save Route
          </CwaUiFormButton>
        </div>
        <div v-if="!!pageResourceRouteIri">
          <CwaUiFormButton
            color="grey"
            :disabled="disableButtons"
            @click="$emit('delete')"
          >
            Delete Route
          </CwaUiFormButton>
        </div>
      </div>
    </div>
    <div
      v-if="recommendedRoute"
      class="cwa:p-4 cwa:bg-dark/80 cwa:rounded-lg cwa:flex cwa:flex-col cwa:gap-y-2 cwa:text-sm"
    >
      <div class="cwa:flex cwa:flex-col cwa:gap-y-4">
        <ModalInfo
          label="SEO recommendation"
          class="cwa:font-bold"
          :content="recommendedRoute"
        />
      </div>
      <div class="cwa:flex cwa:justify-start">
        <CwaUiFormButton
          :color="recommendedRoute === currentPath ? 'grey' : 'blue'"
          :disabled="disableButtons || recommendedRoute === currentPath"
          class="cwa:text-sm"
          @click="$emit('generate')"
        >
          {{ recommendedRoute === currentPath ? 'You are using the recommended route' : 'Apply' }}
        </CwaUiFormButton>
      </div>
      <div class="cwa:text-xs cwa:text-stone-300 cwa:flex cwa:flex-col cwa:gap-y-2">
        <p>Recommended route is based on your page title <b>`{{ pageResource.title }}`</b>.</p>
      </div>
    </div>
  </div>
</template>
