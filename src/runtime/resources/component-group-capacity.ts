export interface ComponentGroupCapacity {
  max: number | null
  count: number
  full: boolean
  over: boolean
}

export function componentGroupCapacity(data: { [key: string]: any } | undefined): ComponentGroupCapacity {
  const max = typeof data?.maxComponents === 'number' ? data.maxComponents : null
  const count = data?.componentPositions?.length ?? 0
  return {
    max,
    count,
    full: max !== null && count >= max,
    over: max !== null && count > max,
  }
}
