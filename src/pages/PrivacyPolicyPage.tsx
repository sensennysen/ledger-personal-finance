import { LegalLink, LegalPage, LegalPageLink, LegalSections } from '@/components/legal/LegalPage'
import { LEDGER_ISSUES_URL, legalToc, type LegalSection } from '@/lib/legalSections'

// Wording approved by the product owner before commit (LED-189, OD-9; rule OD-5). Every statement
// is checked against the code: tests/legalPages.test.mjs ties the hosts to the CSP. The settings moved
// to the account (LED-263 to LED-268) were approved by the owner on 2026-10-06. The LED-257 and LED-258
// additions (saved transaction templates, error reports) are drafts the owner reviews in the epic-22
// pull request.
const LAST_UPDATED = 'October 6, 2026'

const sections: LegalSection[] = [
  {
    title: '1. What Ledger stores',
    content: [
      'Your name, email address and profile picture link, received from Google when you sign in.',
      'The records you enter: accounts and their balances; transactions, with their notes, tags and receipt images; categories and subcategories; budgets; savings goals; loans and financed purchases; credit card payments; auto-categorisation rules; saved filters; saved transaction templates; and the exchange rates Ledger fetched or you typed.',
      'Your settings: default currency, pay cycle, budget deficit setting, rate refresh schedule, Home widget order and which widgets show, number and date format, list views, the large-transaction threshold, whether card reminders are on, and whether you finished or dismissed the setup checklist. Also the card reminders already shown to you, and the income records you picked for 13th Month Pay. Your theme, text size and accent colour stay in your browser.',
      'When something in the app fails while you are signed in, an error report: what failed, with numbers, quoted text and ids taken out; the page’s path; the app version; and your browser’s name and version. It never includes your amounts, names, descriptions or notes. Only the operator can read these reports.',
      'Ledger collects no analytics and no usage data, and shows no ads.',
    ],
  },
  {
    title: '2. How it is used',
    content:
      'Only to sign you in, store your records and show them back to you: balances, budgets, reports and reminders. Your data is not sold, rented or shared for marketing.',
  },
  {
    title: '3. Where it is stored',
    content:
      'Your records are in the operator’s Supabase project: a PostgreSQL database and a private storage bucket for receipt images. Row-level security lets each signed-in user read and change only their own rows, and everything travels over HTTPS. Ledger does not connect to banks and does not store bank passwords or card numbers.',
  },
  {
    title: '4. Services your browser contacts',
    content: [
      <>
        <strong className="font-medium text-foreground">Supabase</strong> (the operator’s project): everything in
        section 1, plus the sign-in session. Each request carries an app identifier (X-Client-ID: ledger-web-v1). As
        with any website, Supabase sees your IP address and browser details.
      </>,
      <>
        <strong className="font-medium text-foreground">Google sign-in</strong> (accounts.google.com, through
        Supabase): Google sees that you are signing in to this copy of Ledger. Ledger receives your name, email address
        and profile picture link, never your Google password. Ledger shows your initials rather than loading the
        picture from Google.
      </>,
      <>
        <strong className="font-medium text-foreground">Frankfurter exchange rates</strong> (api.frankfurter.dev):
        only while you are signed in and hold an account in a currency other than your default, on the schedule you
        pick in Settings (every time you open Ledger, once a day by default, once a week, or only when you press
        Refresh). It receives the currency codes (your default currency and your other accounts’ currencies), your IP
        address and browser details, and this site’s address. Never your amounts, names or transactions.
      </>,
      <>
        <strong className="font-medium text-foreground">Google Fonts</strong> (fonts.googleapis.com,
        fonts.gstatic.com): the app’s fonts are loaded from Google, which receives your IP address, browser details and
        this site’s address. The app keeps a copy for a year so they are not fetched on every visit.
      </>,
      'No other services.',
    ],
  },
  {
    title: '5. Your choices',
    content: [
      <>
        Export: download your data as CSV files, at any time, from the{' '}
        <LegalPageLink to="/data-deletion">Data deletion</LegalPageLink> page.
      </>,
      'Correct: edit or delete any record in the app.',
      <>
        Delete: delete your account and everything in section 1 from Settings. It happens immediately; see{' '}
        <LegalPageLink to="/data-deletion">Data deletion</LegalPageLink>.
      </>,
      'For anything else about your data, ask the operator of this copy. Questions about the Ledger software itself go to the project’s GitHub issues (below).',
    ],
  },
  {
    title: '6. How long data is kept',
    content:
      'Everything is kept until you delete it or the operator removes it. When you delete your account, your records and receipt images are erased at once. Copies in the operator’s hosting backups follow that provider’s backup schedule.',
  },
  {
    title: '7. Cookies and browser storage',
    content: (
      <>
        Ledger sets no cookies. It keeps your sign-in session, settings, a short-lived copy of your data for fast and
        offline use, and changes waiting to sync in your browser’s storage. The{' '}
        <LegalPageLink to="/cookies">Cookies and storage</LegalPageLink> page lists every item.
      </>
    ),
  },
  {
    title: '8. Children',
    content: 'Ledger is not meant for anyone under 13.',
  },
  {
    title: '9. Changes',
    content: 'When this policy changes, the date at the top changes too.',
  },
  {
    title: '10. Contact',
    content: (
      <>
        For your data in this copy of Ledger, contact its operator. For the Ledger software, open an issue at{' '}
        <LegalLink href={LEDGER_ISSUES_URL}>{LEDGER_ISSUES_URL.replace('https://', '')}</LegalLink>.
      </>
    ),
  },
]

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      current="privacy"
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
      intro={
        <p>
          Ledger is open-source personal finance software. Anyone can run their own copy, so each copy has an operator:
          the person or organisation that set it up. This policy explains what the Ledger software stores, which
          services your browser contacts, and how to take your data out or delete it. The operator of this copy is
          responsible for how they host it.
        </p>
      }
      toc={legalToc(sections)}
    >
      <LegalSections sections={sections} />
    </LegalPage>
  )
}
