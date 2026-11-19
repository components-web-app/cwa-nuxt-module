<template>
  <form @submit.prevent="form.submit()">
    <p
      v-if="form.success.value"
      role="status"
    >
      Submitted
    </p>
    <p
      v-else-if="form.formErrors.value.length"
      role="alert"
    >
      {{ form.formErrors.value[0] }}
    </p>
    <FormField
      v-for="field in textFields"
      :key="field.fullName"
      :iri="iri"
      :full-name="field.fullName"
      :multiline="field.multiline"
      :email="field.email"
    />
    <button
      type="submit"
      :disabled="form.submitting.value || form.success.value"
    >
      Submit
    </button>
  </form>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import type { IriProp } from '#cwa/composables/cwa-resource'
import { useCwaComponent } from '#cwa/composables/cwa-component'
import { useCwaForm } from '#cwa/composables/cwa-form'
import FormField from './_parts/FormField.vue'

const props = defineProps<IriProp>()

const { resource, exposeMeta } = useCwaComponent(props)
defineExpose(exposeMeta)

const form = useCwaForm(toRef(props, 'iri'))

type FormViewChild = { vars?: { full_name?: string, block_prefixes?: string[] } }

const textFields = computed(() => {
  const children: FormViewChild[] = resource.value?.data?.formView?.children ?? []
  return children.flatMap(({ vars }) => {
    const prefixes = vars?.block_prefixes ?? []
    if (!vars?.full_name || !prefixes.includes('text')) {
      return []
    }
    return [{
      fullName: vars.full_name,
      multiline: prefixes.includes('textarea'),
      email: prefixes.includes('email'),
    }]
  })
})
</script>
