// Statement currency vs account currency on import (LED-75). A CSV doesn't
// say what currency it's in, and the balance trigger adds income and expense
// amounts to the account unconverted, so a statement in another currency is
// converted to the account's currency before the write, at a rate the user
// enters. Nothing converts silently: the exchange-rate table (LED-136) only fills the
// input in, and the user can change it before anything is imported.

export type CurrencyState =
  | { kind: 'same' }
  | { kind: 'needs-rate' }
  | { kind: 'ok'; rate: number }

/** Whether amounts need converting, and the rate once it's usable. */
export function currencyState(statementCurrency: string, accountCurrency: string, rateInput: string): CurrencyState {
  if (!statementCurrency || statementCurrency === accountCurrency) return { kind: 'same' }
  const rate = Number(rateInput.replace(/,/g, '').trim())
  if (!rateInput.trim() || !Number.isFinite(rate) || rate <= 0) return { kind: 'needs-rate' }
  return { kind: 'ok', rate }
}

/** The table's rate as text for the input, to six significant digits; empty when the table has none. */
export function formatSuggestedRate(rate: number | null): string {
  return rate === null ? '' : String(Number(rate.toPrecision(6)))
}

/** What the rate input shows: what the user typed once they have touched it, else the table's suggestion. */
export function rateInputValue(typed: string | null, suggested: string): string {
  return typed ?? suggested
}

/** A statement amount in the account's currency, to the cent. */
export function convertAmount(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100
}

/** The rate to apply: 1 when the currencies match or the rate isn't usable yet. */
export function effectiveRate(state: CurrencyState): number {
  return state.kind === 'ok' ? state.rate : 1
}
