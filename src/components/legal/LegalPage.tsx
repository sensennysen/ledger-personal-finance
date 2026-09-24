import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { legalSectionId, type LegalSection, type LegalTocItem } from '@/lib/legalSections'

// One document layout for Privacy, Terms and Data deletion (LED-88, design 24a).
// A tab row cross-links the three; the article keeps a reading measure, and at
// xl the freed width carries an "On this page" rail plus an optional aside.

export type LegalDoc = 'privacy' | 'terms' | 'data-deletion'

const DOCS: { id: LegalDoc; label: string; to: string }[] = [
  { id: 'privacy', label: 'Privacy', to: '/privacy' },
  { id: 'terms', label: 'Terms', to: '/terms' },
  { id: 'data-deletion', label: 'Data deletion', to: '/data-deletion' },
]

interface LegalPageProps {
  current: LegalDoc
  title: string
  intro: ReactNode
  lastUpdated: string
  toc: LegalTocItem[]
  /** Rendered in the rail at xl, and above the document below it. */
  aside?: ReactNode
  children: ReactNode
}

export function LegalPage({ current, title, intro, lastUpdated, toc, aside, children }: LegalPageProps) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 md:px-6">
          <Link to="/" className="text-lg font-semibold tracking-tight text-foreground">
            Ledger<span style={{ color: 'var(--primary)' }}>.</span>
          </Link>
          <nav aria-label="Legal documents" className="flex items-center gap-1">
            {DOCS.map((doc) => (
              <NavLink
                key={doc.id}
                to={doc.to}
                className={({ isActive }) => cn(
                  'rounded-full px-3 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {doc.label}
              </NavLink>
            ))}
          </nav>
          <Link
            to="/"
            className="group ml-auto inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Back to Ledger
          </Link>
        </div>
      </header>

      <div
        className={cn(
          'mx-auto grid max-w-6xl gap-8 px-4 py-10 md:px-6 md:py-14',
          '[grid-template-areas:"head"_"rail"_"body"]',
          'xl:grid-cols-[minmax(0,58ch)_16rem] xl:justify-center xl:gap-x-16',
          'xl:[grid-template-areas:"head_rail"_"body_rail"]',
        )}
      >
        <div className="max-w-[58ch] [grid-area:head]">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Last updated <span className="font-medium text-foreground">{lastUpdated}</span>
          </p>
          <div className="mt-4 leading-relaxed text-muted-foreground">{intro}</div>
          {toc.length > 0 && (
            <nav aria-label="On this page" className="mt-5 flex flex-wrap gap-2 xl:hidden">
              {toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          )}
        </div>

        {(toc.length > 0 || aside) && (
          <aside className="space-y-6 [grid-area:rail] xl:sticky xl:top-8 xl:self-start">
            {toc.length > 0 && (
              <nav aria-label="On this page" className="hidden xl:block">
                <p className="mb-3 text-xs font-medium uppercase tracking-[.14em] text-muted-foreground">
                  On this page
                </p>
                <ul className="space-y-2 border-l border-border/60">
                  {toc.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="-ml-px block border-l border-transparent pl-3 text-sm text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            {aside}
          </aside>
        )}

        <article className="max-w-[58ch] [grid-area:body]">
          {children}
          <footer className="mt-14 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-6 text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} Ledger</span>
            {DOCS.filter((doc) => doc.id !== current).map((doc) => (
              <Link key={doc.id} to={doc.to} className="underline underline-offset-2 transition-colors hover:text-foreground">
                {doc.label}
              </Link>
            ))}
          </footer>
        </article>
      </div>
    </div>
  )
}

/** Numbered prose sections, as Privacy and Terms use them. */
export function LegalSections({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <section key={section.title} id={legalSectionId(section.title)} className="scroll-mt-8">
          <h2 className="mb-3 text-base font-semibold text-foreground">{section.title}</h2>
          {Array.isArray(section.content) ? (
            <ul className="space-y-2">
              {section.content.map((item, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">{section.content}</p>
          )}
        </section>
      ))}
    </div>
  )
}
