export default (commaDelimitedStr?: string): string[] | null => {
  if (!commaDelimitedStr) {
    return null
  }
  return commaDelimitedStr.split(',').map((item) => item.trim())
}
