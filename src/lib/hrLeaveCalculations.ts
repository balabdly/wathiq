/**
 * Annual leave accrual under Saudi Labor Law art. 109.
 * 21 days for EACH of the first five completed service years; 30 days
 * per year thereafter. Partial service years are accrued pro rata.
 * Values are calendar-day entitlements, not working-day counts.
 */
export function calcAnnualLeaveBalance(
  hireDateStr: string,
  takenDays: number,
  asOfStr = new Date().toISOString().slice(0, 10),
): { yearsOfService: number; annualEntitlement: number; totalEarned: number; balance: number } {
  const empty = { yearsOfService: 0, annualEntitlement: 21, totalEarned: 0, balance: 0 }
  if (!hireDateStr) return empty
  const hire = new Date(hireDateStr + 'T00:00:00Z')
  const asOf = new Date(asOfStr + 'T00:00:00Z')
  if (Number.isNaN(hire.getTime()) || Number.isNaN(asOf.getTime()) || asOf <= hire) return empty

  const anniversary = (years: number): Date => {
    const d = new Date(hire)
    d.setUTCFullYear(hire.getUTCFullYear() + years)
    return d
  }
  let fullYears = asOf.getUTCFullYear() - hire.getUTCFullYear()
  if (anniversary(fullYears) > asOf) fullYears--
  const yearStart = anniversary(fullYears)
  const yearEnd = anniversary(fullYears + 1)
  const fraction = (asOf.getTime() - yearStart.getTime()) /
    (yearEnd.getTime() - yearStart.getTime())
  const yearsOfService = fullYears + fraction
  const totalEarned = Math.floor(Math.min(yearsOfService, 5) * 21 +
    Math.max(yearsOfService - 5, 0) * 30)
  return {
    yearsOfService,
    annualEntitlement: yearsOfService >= 5 ? 30 : 21,
    totalEarned,
    balance: Math.max(0, totalEarned - Math.max(0, takenDays || 0)),
  }
}
