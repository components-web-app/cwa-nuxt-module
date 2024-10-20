export const useProcess = () => {
  return {
    isClient: import.meta.client,
    isServer: import.meta.server,
  }
}
