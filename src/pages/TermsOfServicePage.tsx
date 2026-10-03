import { LegalLink, LegalPage, LegalSections } from '@/components/legal/LegalPage'
import { LEDGER_ISSUES_URL, LEDGER_REPO_URL, legalToc, type LegalSection } from '@/lib/legalSections'

// Wording approved by the product owner before commit (LED-189, OD-9; rule OD-5). Ledger is MIT
// licensed (LICENSE), so nothing here restricts reading, copying or changing the source.
const LAST_UPDATED = 'October 3, 2026'

const sections: LegalSection[] = [
  {
    title: '1. Agreeing to these terms',
    content: 'By using this copy of Ledger you agree to these terms. If you do not agree, do not use it.',
  },
  {
    title: '2. What Ledger is',
    content:
      'Ledger is software for tracking your own money: you record accounts, transactions, budgets and loans, and it adds them up. It is not a bank or a regulated financial service. It does not move money or connect to your bank accounts.',
  },
  {
    title: '3. Open-source software and operators',
    content: [
      <>
        Ledger’s source code is published under the MIT licence at{' '}
        <LegalLink href={LEDGER_REPO_URL}>{LEDGER_REPO_URL.replace('https://', '')}</LegalLink>.
      </>,
      'Anyone may run a copy. Each copy has an operator who is responsible for hosting it, keeping it updated and secure, backing it up, and meeting the law where they run it.',
      'These terms are between you and the operator of the copy you use.',
    ],
  },
  {
    title: '4. Your account',
    content: [
      'You must be at least 13.',
      'You sign in with Google, so keep your Google account secure.',
      'You are responsible for what you enter and for keeping it accurate.',
    ],
  },
  {
    title: '5. Acceptable use',
    content:
      'Do not use Ledger for anything unlawful, try to reach other people’s data, or disrupt or attack the copy you use.',
  },
  {
    title: '6. Your data',
    content:
      'Your records are yours. You can export them or delete your account at any time. The Privacy Policy explains what is stored and where.',
  },
  {
    title: '7. Not financial advice',
    content:
      'Balances, budgets, reports and forecasts are information, not advice. Decisions you make with them are your own.',
  },
  {
    title: '8. No warranty',
    content:
      'Ledger is provided “as is”, without warranty of any kind, as the MIT licence says. It may contain mistakes; check figures that matter against your bank’s records.',
  },
  {
    title: '9. Limitation of liability',
    content:
      'To the extent the law allows, neither the operator nor the Ledger contributors are liable for indirect or consequential loss, or for lost data, money or profit, arising from using Ledger or being unable to use it.',
  },
  {
    title: '10. Ending your use',
    content:
      'You can stop at any time and delete your account in Settings. The operator may suspend an account that breaks these terms.',
  },
  {
    title: '11. Governing law',
    content:
      'These terms are governed by the laws of the place where the operator of this copy is established. Consumer protections that the law where you live gives you, and that cannot be waived, still apply.',
  },
  {
    title: '12. Changes',
    content: 'When these terms change, the date at the top changes too.',
  },
  {
    title: '13. Contact',
    content: (
      <>
        Questions about this copy go to its operator. Questions about the Ledger software go to{' '}
        <LegalLink href={LEDGER_ISSUES_URL}>{LEDGER_ISSUES_URL.replace('https://', '')}</LegalLink>.
      </>
    ),
  },
]

export default function TermsOfServicePage() {
  return (
    <LegalPage
      current="terms"
      title="Terms of Service"
      lastUpdated={LAST_UPDATED}
      toc={legalToc(sections)}
    >
      <LegalSections sections={sections} />
    </LegalPage>
  )
}
