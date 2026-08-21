// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, defineComponent, nextTick, ref } from 'vue'
import { useCwaAutoClass } from './cwa-auto-class'

// These mount real elements rather than mocking classList, because the defect this file guards
// against - stale classes surviving a style change - is only observable in the resulting DOM.
// The two modes are the two ways a CWA resource actually renders:
//   ACTIVE  - nothing binds :class from a parent (a layout via CwaRootLayout / useCwaLayout), so
//             this composable owns the classes on the element.
//   PASSIVE - a parent binds :class (ResourceLoader binds a component's uiClassNames), so Vue owns
//             them and the composable must stay out of the way without stealing anything.

const tick = async () => {
  await nextTick()
  await nextTick()
}

function mountActive(initial: string[] | undefined, staticClass = '') {
  const classes = ref<string[] | undefined>(initial)
  const Comp = defineComponent({
    setup() {
      useCwaAutoClass(computed(() => classes.value))
      return {}
    },
    template: `<div class="${staticClass}">content</div>`,
  })
  const wrapper = mount(Comp, { attachTo: document.body })
  return { classes, className: () => wrapper.find('div').element.className }
}

function mountPassive(initial: string[] | undefined, staticClass = '') {
  const classes = ref<string[] | undefined>(initial)
  const Child = defineComponent({
    setup() {
      useCwaAutoClass(computed(() => classes.value))
      return {}
    },
    template: `<div class="${staticClass}">content</div>`,
  })
  const Parent = defineComponent({
    components: { Child },
    setup: () => ({ classes }),
    template: '<Child :class="classes" />',
  })
  const wrapper = mount(Parent, { attachTo: document.body })
  return { classes, className: () => wrapper.find('div').element.className }
}

describe('useCwaAutoClass', () => {
  describe('active - no parent :class binding', () => {
    test('applies the classes on mount', () => {
      const { className } = mountActive(['bg-black border p-2'])
      expect(className()).toBe('bg-black border p-2')
    })

    test('swaps to an entirely different style', async () => {
      const { classes, className } = mountActive(['bg-black border p-2'])
      classes.value = ['rounded shadow']
      await tick()
      expect(className()).toBe('rounded shadow')
    })

    test('removes the dropped classes when the new style is a subset of the old', async () => {
      const { classes, className } = mountActive(['bg-black border p-2'])
      classes.value = ['border']
      await tick()
      expect(className()).toBe('border')
    })

    test('deselecting one style of a multiple selection removes only its classes', async () => {
      const { classes, className } = mountActive(['bg-black', 'p-2'])
      classes.value = ['p-2']
      await tick()
      expect(className()).toBe('p-2')
    })

    test('clears every applied class when the styles are removed', async () => {
      const { classes, className } = mountActive(['bg-black p-2'])
      classes.value = undefined
      await tick()
      expect(className()).toBe('')
    })

    test('never removes a class the component template owns, even when a style repeats it', async () => {
      const { classes, className } = mountActive(['py-4 rounded'], 'py-4 text-teal')
      expect(className()).toBe('py-4 text-teal rounded')
      classes.value = ['shadow']
      await tick()
      // py-4 came from the template, so it is not ours to remove
      expect(className()).toBe('py-4 text-teal shadow')
    })

    test('applies classes to a resource that started with none', async () => {
      const { classes, className } = mountActive(undefined)
      classes.value = ['bg-black']
      await tick()
      expect(className()).toBe('bg-black')
      classes.value = ['rounded']
      await tick()
      expect(className()).toBe('rounded')
    })
  })

  describe('passive - a parent binds :class', () => {
    test('does not duplicate the bound classes on mount', () => {
      const { className } = mountPassive(['bg-black border p-2'], 'py-4')
      expect(className()).toBe('py-4 bg-black border p-2')
    })

    test('leaves the binding to update the element on a style change', async () => {
      const { classes, className } = mountPassive(['bg-black border p-2'], 'py-4')
      classes.value = ['rounded shadow']
      await tick()
      expect(className()).toBe('py-4 rounded shadow')
    })

    test('deselecting one style of a multiple selection', async () => {
      const { classes, className } = mountPassive(['bg-black', 'p-2'])
      classes.value = ['p-2']
      await tick()
      expect(className()).toBe('p-2')
    })

    test('removing the styles leaves the template class alone', async () => {
      const { classes, className } = mountPassive(['bg-black p-2'], 'py-4')
      classes.value = undefined
      await tick()
      expect(className()).toBe('py-4')
    })
  })

  test('does nothing when autoClass is disabled', async () => {
    const classes = ref<string[] | undefined>(['bg-black'])
    const Comp = defineComponent({
      setup() {
        useCwaAutoClass(computed(() => classes.value), { autoClass: false })
        return {}
      },
      template: '<div class="py-4">content</div>',
    })
    const wrapper = mount(Comp, { attachTo: document.body })
    expect(wrapper.find('div').element.className).toBe('py-4')
    classes.value = ['rounded']
    await tick()
    expect(wrapper.find('div').element.className).toBe('py-4')
  })

  test('skips a component whose root is not an element', () => {
    const classes = ref<string[] | undefined>(['bg-black'])
    const Comp = defineComponent({
      setup() {
        useCwaAutoClass(computed(() => classes.value))
        return {}
      },
      // a fragment root - $el is the anchor node, so there is nothing to apply classes to
      template: '<!--start--><div class="py-4">content</div><!--end-->',
    })
    const wrapper = mount(Comp, { attachTo: document.body })
    expect(wrapper.find('div').element.className).toBe('py-4')
  })
})
