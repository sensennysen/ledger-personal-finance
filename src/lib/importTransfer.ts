// Transfers on import (LED-75). A transfer between two of the user's own
// accounts shows up on both statements; imported as an expense on one and
// income on the other, it inflates both totals. A row the user marks as a
// transfer is written once, as a `transfer` from one account to the other,
// and the other statement's matching row is then flagged as a duplicate.

export interface TransferRule {
  keyword: string
  type_hint: 'income' | 'expense' | 'transfer' | null
  priority: number
}

export interface TransferAccount {
  id: string
  type: string
  currency: string
}

const TRANSFER_PATTERN = /\b(transfer|trf|xfer|instapay|pesonet|fund trans)/i

/**
 * Whether to suggest "Make a transfer?" for a row. The highest-priority rule
 * whose keyword the description contains decides when it has a type hint;
 * otherwise common bank transfer wording does.
 */
export function looksLikeTransfer(description: string, rules: readonly TransferRule[] = []): boolean {
  const lower = description.toLowerCase()
  const rule = [...rules]
    .sort((a, b) => b.priority - a.priority)
    .find((item) => item.keyword && lower.includes(item.keyword.toLowerCase()))
  if (rule?.type_hint) return rule.type_hint === 'transfer'
  return TRANSFER_PATTERN.test(description)
}

/**
 * The accounts a row can transfer to or from: the user's other accounts in
 * the same currency, so the transfer needs no second rate. Loans are left out;
 * a loan repayment is an expense with a destination, not a transfer.
 */
export function transferCandidates<T extends TransferAccount>(accounts: readonly T[], importAccount: TransferAccount): T[] {
  return accounts.filter(
    (account) => account.id !== importAccount.id && account.type !== 'loan' && account.currency === importAccount.currency,
  )
}

/** Money out of the imported account goes to the other one; money in comes from it. */
export function transferLegs(
  direction: 'income' | 'expense',
  importAccountId: string,
  otherAccountId: string,
): { account_id: string; to_account_id: string } {
  return direction === 'expense'
    ? { account_id: importAccountId, to_account_id: otherAccountId }
    : { account_id: otherAccountId, to_account_id: importAccountId }
}
