export interface CwaResourceManagerTabOptions {
  name: string,
  order?: number
}

export const useCwaResourceManagerTab = (options?: CwaResourceManagerTabOptions) => {
  return {
    exposeMeta: options
  }
}
