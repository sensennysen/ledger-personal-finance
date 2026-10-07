// LED-320: proof that the typed client rejects calls the schema does not allow. Never imported or
// run: `tsc -b` type-checks it, and each @ts-expect-error fails the build if its line ever compiles.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.ts'

export function databaseContract(client: SupabaseClient<Database>) {
  // @ts-expect-error a misspelled column cannot be inserted
  void client.from('accounts').insert({ user_id: 'u', name: 'n', type: 'cash', balanse: 0 })
  // @ts-expect-error a misspelled column cannot be updated
  void client.from('transactions').update({ amont: 1 }).eq('id', 'x')
  // @ts-expect-error an unknown table cannot be read
  void client.from('acounts').select('*')
  // @ts-expect-error an RPC argument must have its declared name
  void client.rpc('add_goal_contribution', { p_goal_id: 'g', p_amount: 1, p_op: 'o' })
  // @ts-expect-error an RPC argument must have its declared type
  void client.rpc('add_goal_contribution', { p_goal_id: 'g', p_amount: '1', p_op_id: 'o' })
  // @ts-expect-error an unknown function cannot be called
  void client.rpc('add_goal_contributions', {})

  // The same calls spelled correctly compile.
  void client.from('accounts').insert({ user_id: 'u', name: 'n', type: 'cash', balance: 0 })
  void client.rpc('add_goal_contribution', { p_goal_id: 'g', p_amount: 1, p_op_id: 'o' })
}
