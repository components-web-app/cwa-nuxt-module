<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import slugify from 'slugify'
import ModalInfo from '#cwa/templates/components/core/admin/form/ModalInfo.vue'
import ModalInput from '#cwa/templates/components/core/admin/form/ModalInput.vue'
import ModalSelect from '#cwa/templates/components/core/admin/form/ModalSelect.vue'
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
  if (prefix && prefix !== '/') {
    if (!fullPath) {
      return { prefix, suffix: '' }
    }
    if (fullPath.startsWith(prefix)) {
      return { prefix, suffix: fullPath.slice(prefix.length) || '' }
    }
  }
  return { prefix: '/', suffix: fullPath }
}

const initial = splitPath(pathModel.value, parentRoutePrefix)
const localPrefix = ref(initial.prefix)
const localSuffix = ref(initial.suffix)

watch([localPrefix, localSuffix], ([prefix, suffix]) => {
  suffix = suffix.trim()
  if (prefix === '/') {
    pathModel.value = suffix.startsWith('/') ? suffix : '/' + suffix
  }
  else {
    const p = prefix.replace(/\/+$/, '')
    const s = suffix.replace(/^\/+/, '')
    pathModel.value = s ? `${p}/${s}` : p
  }
})

watch(() => parentRoutePrefix, (newPrefix) => {
  if (newPrefix && localPrefix.value === '/') {
    const split = splitPath(pathModel.value, newPrefix)
    localPrefix.value = split.prefix
    localSuffix.value = split.suffix
  }
})

const prefixOptions = computed(() => {
  const options = [{ label: '/ (root)', value: '/' }]
  if (parentRoutePrefix && parentRoutePrefix !== '/') {
    options.push({ label: parentRoutePrefix, value: parentRoutePrefix })
  }
  return options
})

const recommendedSuffix = computed(() => {
  if (!pageResource.title) {
    return undefined
  }
  return '/' + slugify(pageResource.title.toLowerCase(), { strict: true })
})

const fullRecommendedPath = computed(() => {
  if (!recommendedSuffix.value) {
    return undefined
  }
  return parentRoutePrefix && parentRoutePrefix !== '/' ? parentRoutePrefix + recommendedSuffix.value : recommendedSuffix.value
})

const isApplyDisabled = computed(() => disableButtons || fullRecommendedPath.value === currentPath)

const pageResourceRouteIri = computed(() => pageResource.route)
</script>

<template>
  <div
    class="cwa:flex cwa:flex-col cwa:gap-y-6"
  >
    <div class="cwa:flex cwa:flex-col cwa:gap-y-4">
      <div class="cwa:flex">
        <div class="cwa:flex-none cwa:w-40">
          <ModalSelect
            v-model="localPrefix"
            label="Prefix"
            :options="prefixOptions"
            container-class="cwa:rounded-r-none cwa:border-r-0"
          />
        </div>
        <div class="cwa:flex-1">
          <ModalInput
            v-model="localSuffix"
            label="Route suffix"
            class="cwa:rounded-l-none"
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
      <div>
        <ModalInfo
          label="SEO recommendation"
          class="cwa:font-bold"
        >
          <span data-seo-recommendation>{{ fullRecommendedPath }}</span>
        </ModalInfo>
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
