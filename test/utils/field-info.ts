export function fieldExplanation(field: Element, text: string) {
  const info = field.querySelector('[data-testid="field-info"]')
  const infoText = [...field.querySelectorAll('.cwa\\:sr-only')].some(element => element.textContent?.trim() === text)
  const line = [...field.querySelectorAll('p')].some(element => element.textContent?.trim() === text)
  return { info: !!info && infoText, line }
}
