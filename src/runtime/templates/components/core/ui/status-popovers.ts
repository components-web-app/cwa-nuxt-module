import { computed, getCurrentInstance, onBeforeUnmount, shallowRef } from 'vue'
import type { ShallowRef } from 'vue'

interface Claim {
  id: symbol
  covered?: () => void
}

const stacks = new WeakMap<object, ShallowRef<Claim[]>>()
const fallback = shallowRef<Claim[]>([])

function stackFor(owner: object | undefined) {
  if (!owner) {
    return fallback
  }
  let stack = stacks.get(owner)
  if (!stack) {
    stack = shallowRef<Claim[]>([])
    stacks.set(owner, stack)
  }
  return stack
}

export function useStatusPopover(covered?: () => void) {
  const stack = stackFor(getCurrentInstance()?.appContext.app)
  const id = Symbol('status-popover')

  function release() {
    stack.value.some(each => each.id === id) && (stack.value = stack.value.filter(each => each.id !== id))
  }

  function claim() {
    if (stack.value.at(-1)?.id === id) {
      return
    }
    const others = stack.value.filter(each => each.id !== id)
    const closing = others.filter(each => each.covered)
    stack.value = [...others.filter(each => !each.covered), { id, covered }]
    closing.forEach(each => each.covered?.())
  }

  onBeforeUnmount(release)

  return { claim, release, front: computed(() => stack.value.at(-1)?.id === id) }
}
