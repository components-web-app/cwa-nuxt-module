export interface CwaResourceManagerTabOptions {
  name: string
}

export const useCwaResourceManagerTab = (options?: CwaResourceManagerTabOptions) => {
  return {
    exposeMeta: options
  }
}
