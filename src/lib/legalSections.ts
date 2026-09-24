// Section anchors for the legal pages (LED-88): each numbered section gets a
// stable id so the "On this page" rail and chips can link to it.

export interface LegalTocItem {
  id: string
  label: string
}

export interface LegalSection {
  title: string
  content: string | string[]
}

export function legalSectionId(title: string): string {
  return title.toLowerCase().replace(/^\d+\.\s*/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function legalToc(sections: LegalSection[]): LegalTocItem[] {
  return sections.map((s) => ({ id: legalSectionId(s.title), label: s.title.replace(/^\d+\.\s*/, '') }))
}
