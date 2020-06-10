export default {
  vuex: {
    namespace: 'resources',
    initialState: {
      new: {},
      current: {}
    }
  },
  fetchConcurrency: 10,
  pagesDepth: 3
}
