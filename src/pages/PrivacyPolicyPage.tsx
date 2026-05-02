import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, Trash2 } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

const LAST_UPDATED = 'May 2, 2026'

interface Section {
  title: string
  content: string | string[]
}

const sections: Section[] = [
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
    <div className="min-h-screen bg-background relative overflow-hidden">

      {/* ── Atmospheric background (mirrors LoginPage) ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-175 h-125 rounded-full"
          style={{ background: 'radial-gradient(ellipse, color-mix(in srgb, var(--primary) 4%, transparent) 0%, transparent 70%)' }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--foreground) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="absolute -top-40 -left-40 w-120 h-120 rounded-full border border-primary/5" />
        <div className="absolute -bottom-48 -right-48 w-125 h-125 rounded-full border border-primary/5" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-12 md:py-16">

        {/* ── Back link ── */}
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-10 group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          Back
        </Link>

        {/* ── Header ── */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl"
              style={{ background: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}
            >
              <ShieldCheck className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h1
                className="text-3xl md:text-4xl font-bold tracking-tight"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Privacy Policy
              </h1>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Last updated: <span className="font-medium text-foreground">{LAST_UPDATED}</span>
          </p>
          <p className="mt-4 text-muted-foreground leading-relaxed max-w-2xl">
            Ledger is a personal finance application. This policy explains what data we collect, how we
            use it, and how we protect it. We are committed to keeping your financial information private
            and secure.
          </p>
        </div>

        <Separator className="mb-10 opacity-50" />

        {/* ── Sections ── */}
        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2
                className="text-base font-semibold mb-3"
                style={{ color: 'var(--primary)' }}
              >
                {section.title}
              </h2>
              {Array.isArray(section.content) ? (
                <ul className="space-y-2">
                  {section.content.map((item, i) => (
                    <li key={i} className="flex gap-3 text-sm text-muted-foreground leading-relaxed">
                      <span
                        className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full"
                        style={{ background: 'color-mix(in srgb, var(--primary) 60%, transparent)' }}
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
              )}
            </section>
          ))}
        </div>

        <Separator className="my-10 opacity-50" />

        {/* ── Data deletion callout ── */}
        <div
          className="rounded-xl border p-5 mb-10 flex gap-4"
          style={{
            borderColor: 'oklch(0.570 0.170 18 / 0.25)',
            background: 'oklch(0.570 0.170 18 / 0.04)',
          }}
        >
          <Trash2
            className="mt-0.5 shrink-0 w-5 h-5"
            style={{ color: 'oklch(0.570 0.170 18)' }}
          />
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">Want to delete your data?</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Visit our{' '}
              <Link to="/data-deletion" className="underline underline-offset-2 hover:text-foreground transition-colors">
                Data Deletion Instructions
              </Link>{' '}
              page for a step-by-step guide on requesting permanent removal of your account and all
              associated personal data.
            </p>
          </div>
        </div>

        {/* ── Footer ── */}
        <p className="text-xs text-muted-foreground/60 text-center">
          © {new Date().getFullYear()} Ledger. All rights reserved.
        </p>
      </div>
    </div>
  )
}
