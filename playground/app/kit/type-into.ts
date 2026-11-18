export interface TypeIntoOptions {
  delay?: number
  clear?: boolean
  sleep?: (ms: number) => Promise<void>
}

type Typeable = HTMLInputElement | HTMLTextAreaElement

function setValue(element: Typeable, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set
  setter ? setter.call(element, value) : (element.value = value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

export async function typeInto(element: Typeable, text: string, { delay = 70, clear = true, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) }: TypeIntoOptions = {}) {
  element.focus()
  let value = clear ? '' : element.value
  if (clear && element.value) {
    setValue(element, '')
  }
  for (const character of text) {
    await sleep(delay)
    if (!element.isConnected) {
      return false
    }
    value += character
    setValue(element, value)
  }
  return true
}

export function typeableIn(root: Element | null | undefined): Typeable | undefined {
  return root?.querySelector<Typeable>('input:not([type=hidden]):not([type=file]), textarea') ?? undefined
}
