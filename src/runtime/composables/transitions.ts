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
      enterActiveClass: 'cwa:transform-gpu cwa:transition-opacity-transform cwa:ease-out cwa:duration-200',
      enterFromClass: 'cwa:opacity-0 cwa:translate-y-0 cwa:scale-110',
      enterToClass: 'cwa:opacity-100 cwa:translate-y-0 cwa:scale-100',
      leaveActiveClass: 'cwa:duration-0',
      leaveFromClass: 'cwa:opacity-100 cwa:translate-y-0',
      leaveToClass: 'cwa:opacity-0 cwa:translate-y-0',
    },
    dropdown: {
      enterActiveClass: 'cwa:transition-opacity cwa:duration-100 cwa:ease-out',
      enterFromClass: 'cwa:opacity-0',
      enterToClass: 'cwa:opacity-100',
      leaveActiveClass: 'cwa:transition-opacity cwa:duration-100 cwa:ease-in',
      leaveFromClass: 'cwa:opacity-100',
      leaveToClass: 'cwa:opacity-0',
    },
    overlay: {
      enterFromClass: 'cwa:transform cwa:opacity-0',
      enterActiveClass: 'cwa:duration-200 cwa:ease-out',
      enterToClass: 'cwa:opacity-100',
      leaveFromClass: 'cwa:opacity-100',
      leaveActiveClass: 'cwa:duration-200 cwa:ease-in',
      leaveToClass: 'cwa:transform cwa:opacity-0',
    },
    slideUp: {
      enterFromClass: 'cwa:transform cwa:translate-y-full',
      enterActiveClass: 'cwa:duration-200 cwa:ease-out',
      enterToClass: 'cwa:translate-y-0',
      leaveFromClass: 'cwa:translate-y-0',
      leaveActiveClass: 'cwa:duration-200 cwa:ease-in',
      leaveToClass: 'cwa:transform cwa:translate-y-full',
    },
    menu: {
      enterFromClass: 'cwa:transform cwa:opacity-0 cwa:scale-[0.97]',
      enterActiveClass: 'cwa:duration-200 cwa:ease-out',
      enterToClass: 'cwa:opacity-100',
      leaveFromClass: 'cwa:opacity-100',
      leaveActiveClass: 'cwa:duration-200 cwa:ease-in',
      leaveToClass: 'cwa:transform cwa:opacity-0 cwa:scale-[0.97]',
    },
    spinner: {
      enterFromClass: 'cwa:transform cwa:opacity-0',
      enterActiveClass: 'cwa:duration-300 cwa:ease-out',
      enterToClass: 'cwa:opacity-100',
      leaveFromClass: 'cwa:opacity-100',
      leaveActiveClass: 'cwa:duration-300 cwa:ease-in',
      leaveToClass: 'cwa:transform cwa:opacity-0',
    },
    notification: {
      enterActiveClass: 'cwa:transform cwa:ease-out cwa:duration-300 cwa:transition',
      enterFromClass: 'cwa:translate-y-2 cwa:opacity-0 cwa:sm:translate-y-0 cwa:sm:translate-x-2',
      enterToClass: 'cwa:translate-y-0 cwa:opacity-100 cwa:sm:translate-x-0',
      leaveActiveClass: 'cwa:transition cwa:ease-in cwa:duration-100',
      leaveFromClass: 'cwa:opacity-100',
      leaveToClass: 'cwa:translate-y-2 cwa:opacity-0 cwa:sm:translate-y-0 cwa:sm:translate-x-2',
    },
    progressBar: {
      enterFromClass: 'cwa:transform cwa:opacity-0 cwa:w-0',
      enterActiveClass: 'cwa:duration-200 cwa:ease-out',
      enterToClass: 'cwa:opacity-100',
      leaveFromClass: 'cwa:opacity-100',
      leaveActiveClass: 'cwa:duration-300 cwa:ease-in cwa:delay-200',
      leaveToClass: 'cwa:transform cwa:opacity-0',
    },
  }
}
