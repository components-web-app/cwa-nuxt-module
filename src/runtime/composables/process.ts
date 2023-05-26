export const useProcess = () => {
  return {
    isClient: process.client,
    isServer: process.server
  }
}
