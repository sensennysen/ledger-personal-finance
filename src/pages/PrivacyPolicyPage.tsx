import { LegalPage, LegalSections } from '@/components/legal/LegalPage'
import { legalToc, type LegalSection } from '@/lib/legalSections'

const LAST_UPDATED = 'May 2, 2026'

const sections: LegalSection[] = [
  {
    title: '1. Information We Collect',
    content: [
      'Account information you provide when signing in via Google OAuth (name, email address, and profile picture).',
      'Financial data you manually enter: accounts, transactions, categories, and budgets.',
      'Usage data such as the pages you visit and actions you take within the application, collected to improve the service.',
    ],
  },
  {
    title: '2. How We Use Your Information',
    content: [
      'To authenticate you and maintain your session securely.',
      'To store and retrieve the financial records you create so you can access them across devices.',
      'To personalise the application based on your preferences (e.g., currency, colour scheme).',
      'To improve application performance, reliability, and user experience.',
    ],
  },
  {
    title: '3. Data Storage & Security',
    content:
      'Your data is stored in a Supabase-managed PostgreSQL database protected by row-level security policies. Only you can read or modify your own records. All data is transmitted over HTTPS/TLS. We do not store payment card numbers, bank credentials, or any sensitive authentication tokens beyond the OAuth tokens needed to maintain your session.',
  },
  {
    title: '4. Third-Party Services',
    content: [
      'Google OAuth — used solely for authentication. We receive only the profile information Google makes available (name, email, avatar). We do not receive your Google account password.',
      'Supabase — our backend-as-a-service provider that hosts the database and authentication layer. Supabase processes data in accordance with its own Privacy Policy.',
    ],
  },
  {
    title: '5. Data Sharing',
    content:
      'We do not sell, rent, or share your personal data with any third parties for marketing or advertising purposes. Data may be disclosed only if required by applicable law or to protect the rights and safety of users.',
  },
  {
    title: '6. Data Retention',
    content:
      'Your data is retained for as long as your account remains active. If you choose to delete your account, all associated personal data and financial records are permanently and immediately removed from our database at the moment you confirm the deletion request.',
  },
  {
    title: '7. Your Rights',
    content: [
      'Access — you may request a copy of all personal data we hold about you.',
      'Correction — you may update your profile information at any time in the Settings page.',
      'Deletion — you may request permanent deletion of your account and all associated data. See our Data Deletion Instructions page for step-by-step guidance.',
      'Portability — you may request an export of your financial data in a structured format.',
    ],
  },
  {
    title: '8. Cookies & Local Storage',
    content:
      'Ledger uses browser local storage to persist your authentication session and theme preference. No third-party tracking cookies are used.',
  },
  {
    title: '9. Children\'s Privacy',
    content:
      'Ledger is not intended for use by individuals under the age of 13. We do not knowingly collect personal information from children.',
  },
  {
    title: '10. Changes to This Policy',
    content:
      'We may update this Privacy Policy from time to time. The "Last updated" date at the top of this page will reflect the most recent revision. Continued use of the application after changes are posted constitutes your acceptance of the revised policy.',
  },
  {
    title: '11. Contact',
    content:
      'If you have questions or requests regarding this Privacy Policy, please reach out through the Settings page or the contact information provided in the application.',
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
          Ledger is a personal finance application. This policy explains what data we collect, how we
          use it, and how we protect it. We are committed to keeping your financial information
          private and secure.
        </p>
      }
      toc={legalToc(sections)}
    >
      <LegalSections sections={sections} />
    </LegalPage>
  )
}
