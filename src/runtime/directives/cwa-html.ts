import type { ObjectDirective } from 'vue'

export const vCwaHtml: ObjectDirective<HTMLElement, string | undefined> = {
  getSSRProps: binding => ({ innerHTML: binding.value ?? '' }),
  mounted(el, binding) {
    const value = binding.value ?? ''
    if (el.innerHTML !== value) {
      el.innerHTML = value
    }
  },
  beforeUpdate(el, binding) {
    if (binding.value !== binding.oldValue) {
      el.innerHTML = binding.value ?? ''
    }
  },
}
