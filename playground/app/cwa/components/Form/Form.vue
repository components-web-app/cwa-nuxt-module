<template>
  <form
    class="space-y-5 max-w-xl mx-auto py-8"
    @submit.prevent="form.submit()"
  >
    <UAlert
      v-if="form.success.value"
      color="success"
      icon="i-lucide-circle-check"
      title="Submitted!"
    />
    <UAlert
      v-else-if="form.formErrors.value.length"
      color="error"
      icon="i-lucide-circle-x"
      :description="form.formErrors.value[0]"
    />
    <FormField
      v-for="field in textFields"
      :key="field.fullName"
      :iri="props.iri"
      :full-name="field.fullName"
      :multiline="field.multiline"
    />
    <UButton
      type="submit"
      :loading="form.submitting.value"
      :disabled="form.success.value"
    >
      Submit
    </UButton>
  </form>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import type { IriProp } from '#cwa/composables/cwa-resource'
import { useCwaComponent, useCwaForm, defineCwaConfig } from '#imports'
import FormField from './_parts/FormField.vue'

defineCwaConfig({
  name: 'Form',
  description: '<p>A form from the API, shown as a list of its text fields unless a UI variant lays it out.</p>',
})

const props = defineProps<IriProp>()
const iriRef = toRef(props, 'iri')

const { resource, exposeMeta } = useCwaComponent(props)
defineExpose(exposeMeta)

const form = useCwaForm(iriRef)

type FormViewChild = { vars?: { full_name?: string, block_prefixes?: string[] } }

const textFields = computed(() => {
  const children: FormViewChild[] = resource.value?.data?.formView?.children ?? []
  return children
    .filter(child => child.vars?.full_name && child.vars.block_prefixes?.includes('text'))
    .map(child => ({
      fullName: child.vars!.full_name!,
      multiline: !!child.vars!.block_prefixes?.includes('textarea'),
    }))
})
</script>
