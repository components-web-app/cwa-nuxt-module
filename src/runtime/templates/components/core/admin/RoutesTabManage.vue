<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import slugify from 'slugify'
import ModalInfo from '#cwa/templates/components/core/admin/form/ModalInfo.vue'
import ModalInput from '#cwa/templates/components/core/admin/form/ModalInput.vue'
import type { CwaResource } from '#cwa/resources/resource-utils'

const { pageResource, parentRoutePrefix, currentPath, disableButtons } = defineProps<{
  disableButtons: boolean
  pageResource: CwaResource
  currentPath: string
  parentRoutePrefix?: string | null
}>()

const pathModel = defineModel<string>({ required: true })

defineEmits<{
  save: []
  delete: []
  generate: []
}>()

function splitPath(fullPath: string, prefix: string | null | undefined): { prefix: string, suffix: string } {
  if (prefix && prefix !== '/' && fullPath.startsWith(prefix)) {
    return { prefix, suffix: fullPath.slice(prefix.length) || '' }
  }
  return { prefix: '/', suffix: fullPath }
}

const initial = splitPath(pathModel.value, parentRoutePrefix)
const localPrefix = ref(initial.prefix)
const localSuffix = ref(initial.suffix)

watch([localPrefix, localSuffix], ([prefix, suffix]) => {
  pathModel.value = prefix === '/' ? suffix : prefix + suffix
})

const recommendedSuffix = computed(() => {
  if (!pageResource.title) {
    return undefined
  }
  return '/' + slugify(pageResource.title.toLowerCase())
})

const fullRecommendedPath = computed(() => {
  if (!recommendedSuffix.value) {
    return undefined
  }
  return localPrefix.value === '/' ? recommendedSuffix.value : localPrefix.value + recommendedSuffix.value
})

const isApplyDisabled = computed(() => disableButtons || fullRecommendedPath.value === currentPath)

const pageResourceRouteIri = computed(() => pageResource.route)
</script>

<template>
  <div
    class="cwa:flex cwa:flex-col cwa:gap-y-6"
  >
    <div class="cwa:flex cwa:flex-col cwa:gap-y-4">
      <div class="cwa:flex cwa:gap-x-2">
        <div class="cwa:flex-none cwa:w-40">
          <ModalInput
            v-model="localPrefix"
            label="Prefix"
          />
        </div>
        <div class="cwa:flex-1">
          <ModalInput
            v-model="localSuffix"
            label="Route suffix"
          />
        </div>
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
      v-if="recommendedSuffix"
      class="cwa:p-4 cwa:bg-dark/80 cwa:rounded-lg cwa:flex cwa:flex-col cwa:gap-y-2 cwa:text-sm"
    >
      <div class="cwa:flex cwa:flex-col cwa:gap-y-4">
        <ModalInfo
          label="SEO recommendation"
          class="cwa:font-bold"
        >
          <span data-recommended-suffix>{{ recommendedSuffix }}</span>
        </ModalInfo>
        <ModalInfo
          v-if="parentRoutePrefix"
          label="Full path preview"
        >
          <span data-recommended-preview>{{ fullRecommendedPath }}</span>
        </ModalInfo>
        <span
          v-else
          data-recommended-preview
          class="cwa:sr-only"
        >{{ fullRecommendedPath }}</span>
      </div>
      <div class="cwa:flex cwa:justify-start">
        <CwaUiFormButton
          data-apply-seo
          :color="isApplyDisabled ? 'grey' : 'blue'"
          :disabled="isApplyDisabled"
          class="cwa:text-sm"
          @click="$emit('generate')"
        >
          {{ fullRecommendedPath === currentPath ? 'You are using the recommended route' : 'Apply' }}
        </CwaUiFormButton>
      </div>
      <div class="cwa:text-xs cwa:text-stone-300 cwa:flex cwa:flex-col cwa:gap-y-2">
        <p>Recommended route is based on your page title <b>`{{ pageResource.title }}`</b>.</p>
      </div>
    </div>
  </div>
</template>
