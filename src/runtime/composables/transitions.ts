interface Transitions {
  [key: string]: {
    enterActiveClass: string
    enterFromClass: string
    enterToClass: string
    leaveActiveClass: string
    leaveFromClass: string
    leaveToClass: string
  }
}

export function useTransitions(): Transitions {
  return {
    context: {
      enterActiveClass: 'cwa:transform-gpu cwa:transition-opacity-transform cwa:ease-out cwa:duration-600',
      enterFromClass: 'cwa:opacity-0 cwa:translate-y-0 cwa:scale-110',
      enterToClass: 'cwa:opacity-100 cwa:translate-y-0 cwa:scale-100',
      leaveActiveClass: 'cwa:duration-0',
      leaveFromClass: 'cwa:opacity-100 cwa:translate-y-0',
      leaveToClass: 'cwa:opacity-0 cwa:translate-y-0',
    },
  }
}
