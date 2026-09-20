import { z } from 'zod'

export const MAX_MONTHLY_INTEREST_PCT = 10

export const monthlyRateSchema = z.coerce.number()
  .min(0, 'Interest cannot be negative')
  .max(MAX_MONTHLY_INTEREST_PCT, `Monthly rate can't exceed ${MAX_MONTHLY_INTEREST_PCT}% — enter 1.25 for 1.25%, not 125`)
