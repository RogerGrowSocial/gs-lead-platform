export function getMonthBounds(date = new Date()) {
  const year = date.getFullYear()
  const month = date.getMonth()
  
  const start = new Date(year, month, 1, 0, 0, 0, 0)
  const end = new Date(year, month + 1, 1, 0, 0, 0, 0)
  
  return { start, end }
}
