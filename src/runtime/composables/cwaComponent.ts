import { useCwa } from './cwa'

export const useCwaComponent = (componentId: string) => {
  if (!componentId) {
    throw new Error('You should provide component id')
  }

  return useCwa().resources.getResource(componentId)
}
