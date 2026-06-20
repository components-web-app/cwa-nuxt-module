<script setup lang="ts">
import { computed, ref } from 'vue'
import SearchResource from '#cwa/templates/components/ui/form/SearchResource.vue'

const props = defineProps<{
  disableButtons: boolean
  currentRouteIri: string
  initialIri?: string
}>()

defineEmits<{
  create: [iri: string]
}>()

const forwardIri = ref(props.initialIri ?? '')

const isSelf = computed(() => !!forwardIri.value && forwardIri.value === props.currentRouteIri)
const canSave = computed(() => !!forwardIri.value && !isSelf.value)
</script>

<template>
  <div class="cwa:flex cwa:flex-col cwa:gap-y-6">
    <div class="cwa:flex cwa:flex-col cwa:gap-y-4">
      <SearchResource
        v-model="forwardIri"
        endpoint="/_/routes"
        property="path"
        not-nullable
      />
      <p
        v-if="isSelf"
        class="cwa:text-sm cwa:text-amber-400"
      >
        A route cannot redirect to itself.
      </p>
      <p
        v-else-if="forwardIri"
        class="cwa:text-sm cwa:text-stone-300"
      >
        Visitors will be automatically forwarded. The page's own content will not be shown directly.
      </p>
    </div>
    <div class="cwa:flex cwa:justify-start">
      <CwaUiFormButton
        data-save-forward
        color="blue"
        :disabled="disableButtons || !canSave"
        @click="$emit('create', forwardIri)"
      >
        Save Forward
      </CwaUiFormButton>
    </div>
  </div>
</template>
