import { LegalLink, LegalPage } from '@/components/legal/LegalPage'
import { LEDGER_ISSUES_URL, LEDGER_REPO_URL } from '@/lib/legalSections'

// Wording approved by the product owner before commit (LED-189, OD-9; rule OD-5). The licence text is
// the LICENSE file at the repository root.
const LAST_UPDATED = 'October 3, 2026'

const COPYRIGHT = 'Copyright (c) 2026 sensennysen and Ledger contributors'

const MIT_PARAGRAPHS = [
  'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:',
  'The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.',
  'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.',
]

const TOC = [
  { id: 'not-financial-advice', label: 'Not financial advice' },
  { id: 'running-your-own-copy', label: 'Running your own copy' },
  { id: 'licence', label: 'Licence' },
  { id: 'third-party-software', label: 'Third-party software' },
  { id: 'contact', label: 'Contact' },
]

const heading = 'mb-3 text-base font-semibold text-foreground'
const body = 'text-sm leading-relaxed text-muted-foreground'

export default function LegalNoticesPage() {
  return (
    <LegalPage current="notices" title="Notices" lastUpdated={LAST_UPDATED} toc={TOC}>
      <div className="space-y-10">
        <section id="not-financial-advice" className="scroll-mt-8">
          <h2 className={heading}>Not financial advice</h2>
          <p className={body}>
            Ledger shows what you record. Its balances, budgets, reports and forecasts are information, not financial,
            tax or investment advice.
          </p>
        </section>

        <section id="running-your-own-copy" className="scroll-mt-8">
          <h2 className={heading}>Running your own copy</h2>
          <p className={`${body} mb-2`}>If you operate a copy of Ledger, you are responsible for:</p>
          <ul className="space-y-2">
            {[
              'its hosting and its Supabase project;',
              'applying updates and keeping it secure;',
              'backups;',
              'the privacy and consumer laws where you and your users are;',
              'making sure these pages describe your copy. If you add services the browser contacts, list them in the Privacy Policy and in the Content Security Policy.',
            ].map((item) => (
              <li key={item} className={`flex gap-3 ${body}`}>
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section id="licence" className="scroll-mt-8">
          <h2 className={heading}>Licence</h2>
          <p className={`${body} mb-3`}>Ledger is open-source software under the MIT licence:</p>
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">{COPYRIGHT}</p>
            {MIT_PARAGRAPHS.map((paragraph) => (
              <p key={paragraph.slice(0, 24)}>{paragraph}</p>
            ))}
          </div>
        </section>

        <section id="third-party-software" className="scroll-mt-8">
          <h2 className={heading}>Third-party software</h2>
          <p className={body}>
            Ledger is built with open-source libraries, including React, Supabase’s JavaScript client, Tailwind CSS and
            Recharts, each under its own licence. Exchange rates come from Frankfurter. Fonts are from Google Fonts.
          </p>
        </section>

        <section id="contact" className="scroll-mt-8">
          <h2 className={heading}>Contact</h2>
          <p className={body}>
            Source code and issues: <LegalLink href={LEDGER_REPO_URL}>{LEDGER_REPO_URL.replace('https://', '')}</LegalLink>.
            Report a problem or ask a question at{' '}
            <LegalLink href={LEDGER_ISSUES_URL}>{LEDGER_ISSUES_URL.replace('https://', '')}</LegalLink>.
          </p>
        </section>
      </div>
    </LegalPage>
  )
}
