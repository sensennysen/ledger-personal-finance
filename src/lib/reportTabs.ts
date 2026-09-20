export type ReportTab = 'overview' | 'analytics'

const REPORT_TABS: readonly string[] = ['overview', 'analytics']

/**
 * Presets saved before LED-22 may hold 'thirteenth', a tab that no longer
 * exists. Anything that is not a live tab falls back to Overview.
 */
export function resolveReportTab(saved?: string | null): ReportTab {
  return saved && REPORT_TABS.includes(saved) ? (saved as ReportTab) : 'overview'
}
