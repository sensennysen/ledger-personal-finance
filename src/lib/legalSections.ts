// Section anchors for the legal pages (LED-88): each numbered section gets a
// stable id so the "On this page" rail and chips can link to it.

import type { ReactNode } from 'react'

/** The GitHub repository and its issues: the contact the legal pages give (LED-189). */
export const LEDGER_REPO_URL = 'https://github.com/sensennysen/ledger-personal-finance'
export const LEDGER_ISSUES_URL = `${LEDGER_REPO_URL}/issues`

export interface LegalTocItem {
  id: string
  label: string
}

export interface LegalSection {
  title: string
  /** A paragraph, or a list of points; either may hold links (LED-189). */
  content: ReactNode | ReactNode[]
}

export function legalSectionId(title: string): string {
  return title.toLowerCase().replace(/^\d+\.\s*/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function legalToc(sections: LegalSection[]): LegalTocItem[] {
  return sections.map((s) => ({ id: legalSectionId(s.title), label: s.title.replace(/^\d+\.\s*/, '') }))
}
