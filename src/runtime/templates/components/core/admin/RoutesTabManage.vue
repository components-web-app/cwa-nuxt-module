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
    <template v-if="recommendedRoute && recommendedRoute !== currentPath">
      <div class="cwa:w-full cwa:border-b cwa:border-b-stone-600" />
      <div class="cwa:flex cwa:flex-col cwa:gap-y-4">
        <ModalInfo
          label="Recommended route path"
          :content="recommendedRoute"
        />
      </div>
      <div class="cwa:text-sm cwa:text-stone-300 cwa:flex cwa:flex-col cwa:gap-y-2">
        <p>Your current route <span>{{ currentPath }} is not recommended based on your page title <b>`{{ pageResource.title }}`</b>.</span></p>
        <p>It is optimal for search engines to increase the relevance of the page to the title provided.</p>
      </div>
      <div class="cwa:flex cwa:justify-start">
        <CwaUiFormButton
          color="blue"
          :disabled="disableButtons"
          @click="$emit('generate')"
        >
          Use Recommended Route
        </CwaUiFormButton>
      </div>
    </template>
  </div>
</template>
