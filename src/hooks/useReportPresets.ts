import { useState, useCallback } from 'react'

export interface ReportPreset {
  id: string
  name: string
  preset: string
  startDate: string
  endDate: string
  activeTab: string
}

const STORAGE_KEY = 'ledger-report-presets'

function load(): ReportPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ReportPreset[]) : []
  } catch {
    return []
  }
}

function persist(presets: ReportPreset[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
  } catch {}
}

export function useReportPresets() {
  const [presets, setPresets] = useState<ReportPreset[]>(load)

  const savePreset = useCallback(
    (name: string, preset: string, startDate: string, endDate: string, activeTab: string) => {
      const newPreset: ReportPreset = {
        id: crypto.randomUUID(),
        name,
        preset,
        startDate,
        endDate,
        activeTab,
      }
      setPresets((prev) => {
        const next = [...prev, newPreset]
        persist(next)
        return next
      })
    },
    [],
  )

  const deletePreset = useCallback((id: string) => {
    setPresets((prev) => {
      const next = prev.filter((p) => p.id !== id)
      persist(next)
      return next
    })
  }, [])

  return { presets, savePreset, deletePreset }
}
