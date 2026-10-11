export interface LazyImport<T> {
  readonly loaded: T | undefined
  load: () => Promise<T>
}

export function lazyImport<T>(importer: () => Promise<T>): LazyImport<T> {
  let loaded: T | undefined
  let pending: Promise<T> | undefined
  return {
    get loaded() {
      return loaded
    },
    load() {
      pending ??= importer().then(
        (module) => {
          loaded = module
          return module
        },
        (error) => {
          pending = undefined
          throw error
        },
      )
      return pending
    },
  }
}
