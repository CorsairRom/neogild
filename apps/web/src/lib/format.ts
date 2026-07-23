export function formatCLP(amount: number, opts?: { signed?: boolean }) {
  const value = opts?.signed ? amount : Math.abs(amount)
  const formatted = new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value)
  if (opts?.signed && amount < 0) return `−${formatted.replace('-', '')}`
  return formatted
}

export function formatMonthTitle(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(
    new Date(y, m - 1, 1),
  )
}
