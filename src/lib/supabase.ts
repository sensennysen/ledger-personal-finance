import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables. ' +
    'Create a .env file with these values from your Supabase project settings.'
  )
}

// Typed from the migration-applied schema (src/types/database.ts, `pnpm db:types`): a wrong
// column, table or RPC argument fails the build (LED-320).
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      // Custom header used as a lightweight CSRF signal; the Supabase API
      // ignores unknown headers, but it distinguishes our requests from
      // simple cross-origin form submissions that cannot set custom headers.
      'X-Client-ID': 'ledger-web-v1',
    },
  },
})
