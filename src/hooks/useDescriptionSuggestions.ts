import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export function useDescriptionSuggestions() {
  const { user } = useAuth()
  const [suggestions, setSuggestions] = useState<string[]>([])

  useEffect(() => {
    if (!user) return
    supabase
      .from('transactions')
      .select('description')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (!data) return
        const seen = new Set<string>()
        const unique: string[] = []
        for (const row of data) {
          const d = row.description?.trim()
          if (d && !seen.has(d.toLowerCase())) {
            seen.add(d.toLowerCase())
            unique.push(d)
          }
        }
        setSuggestions(unique)
      })
  }, [user])

  return suggestions
}
