// Which account the add form opens on when it is offline (LED-197). The combobox lists accounts
// grouped by type, so "first" means first as that list shows it: the same order lives here, and
// AccountCombobox uses it, so the two cannot drift.

interface PickerAccount {
  type: string
  name: string
  sort_order?: number | null
}

/** The user's group order first, then any type it leaves out, in the default order. */
export function pickerGroupOrder<T extends string>(
  preferred: readonly T[] | null | undefined,
  defaults: readonly T[],
): T[] {
  const first = preferred ?? defaults
  return [...first, ...defaults.filter((type) => !first.includes(type))]
}

export function compareAccountsForPicker(a: PickerAccount, b: PickerAccount): number {
  return (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)
}

/** The accounts in the order the combobox lists them. */
export function orderAccountsForPicker<A extends PickerAccount>(
  accounts: readonly A[],
  groupOrder: readonly string[],
): A[] {
  return groupOrder.flatMap((type) => accounts.filter((account) => account.type === type).sort(compareAccountsForPicker))
}

/** The account to open an offline add form on, or null when there are none. */
export function pickOfflineDefaultAccount<A extends PickerAccount>(
  accounts: readonly A[] | null | undefined,
  groupOrder: readonly string[],
): A | null {
  if (!accounts?.length) return null
  return orderAccountsForPicker(accounts, groupOrder)[0] ?? null
}
