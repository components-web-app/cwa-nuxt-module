export function TogglePublishable(
  state,
  { iri, showPublished }: { iri: string; showPublished: boolean }
) {
  if (showPublished) {
    if (!state.resources.mapToPublished.includes(iri)) {
      state.resources.mapToPublished.push(iri)
    }
  } else {
    const useLiveIndex = state.resources.mapToPublished.indexOf(iri)
    if (useLiveIndex !== -1) {
      state.resources.mapToPublished.splice(useLiveIndex, 1)
    }
  }
}

export default TogglePublishable
