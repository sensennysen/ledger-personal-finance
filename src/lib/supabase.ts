import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables. ' +
    'Create a .env file with these values from your Supabase project settings.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      // Custom header used as a lightweight CSRF signal; the Supabase API
      // ignores unknown headers, but it distinguishes our requests from
      // simple cross-origin form submissions that cannot set custom headers.
      'X-Client-ID': 'ledger-web-v1',
    },
  },
})
