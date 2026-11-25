import { consola } from 'consola'

export interface CwaFieldDescriptor {
  name: string
  label: string
  type: string
  required?: boolean
  secret?: boolean
}

export type DescriptorControl = 'secret' | 'toggle' | 'number' | 'textarea' | 'input'

const CONTROLS: Record<string, DescriptorControl> = {
  bool: 'toggle',
  int: 'number',
  text: 'textarea',
  string: 'input',
}

const warnedTypes = new Set<string>()

export function controlFor(descriptor: CwaFieldDescriptor): DescriptorControl {
  if (descriptor.secret) {
    return 'secret'
  }
  const control = CONTROLS[descriptor.type]
  if (control) {
    return control
  }
  if (import.meta.env.DEV && !warnedTypes.has(descriptor.type)) {
    warnedTypes.add(descriptor.type)
    consola.warn(`A field descriptor of type "${descriptor.type}" ("${descriptor.name}") has no kit control, so it is a text input. Known types: ${Object.keys(CONTROLS).join(', ')}.`)
  }
  return 'input'
}
