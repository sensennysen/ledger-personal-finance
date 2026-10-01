import { cn } from '@/lib/utils'

// The Ledger mark: a serif L and its dot (LED-144). One inline SVG, so the L follows the text colour
// and the dot follows --primary. Both change with the theme through CSS, with no second asset to swap.
// The outline is traced from the original artwork (public/l-black.png), which stays for the manifest and favicon.
export function LedgerMark({ className, decorative = false }: { className?: string; /** Hidden from assistive tech when the name "Ledger" is written beside it. */ decorative?: boolean }) {
  return (
    <svg viewBox="0 0 377 377" role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : 'Ledger'} aria-hidden={decorative || undefined} className={cn('shrink-0', className)}>
      <path fill="currentColor" d="M68 82L173 82L173.5 82.5L173.5 86.5L173 87L159.3 87.3L157.3 88L155.5 88L150.5 90.3L150 91L149 91.3L149 91.8L148.3 92L146.3 94.5L145.8 96L145 96.8L145 97.8L144 100L143.3 110L143.3 248.3L144.3 260L145 261.5L145 262.5L145.8 263.3L146.3 264.8L148.3 266.8L152.5 269L154.5 269L157.8 269.8L191.3 270L197 269L199.5 269L202.3 268L203.8 268L205.8 267L207 267L208.5 266L209.5 266L210.8 265L211.8 265L212.8 264L213.5 264L214.5 263L215.3 263L215.8 262.3L216.8 262L217.5 261L218 261L221.3 258L221.8 258L222 257.3L222.8 257L224.3 255L224.8 255L224.8 254.5L228 251L228.3 250L228.8 250L229 249L229.8 248.5L230 247.5L232 245L232 244.3L232.8 243.8L233.3 242L235 239.5L235 238.8L238 232.8L238.3 231.3L238.8 231L239 229.3L239.8 228.5L240.3 226L240.8 225.8L241.3 223.3L242 222.3L242.3 220.3L243 219.3L243.3 217.3L244 216.3L244 214.8L245 212.8L245 211.5L245.5 211L251.3 211.3L250.5 219.5L249.8 228.5L249 232L249 235.8L248 241.3L247.8 247.3L247 250.5L247 254.3L246 260L246 263.8L245 269.3L245 273L243.8 281L68 281L67.5 280.5L67.5 276.5L68 276L77.8 276L83.3 275L84.5 274.3L86.8 273.8L87 273.3L89.5 272L90.3 271L90.8 271L91 270.3L92 269.5L92.3 268.5L93 268L94.8 263.3L95.5 253.5L95.5 109.5L95 100.8L94 96.5L93.3 95.8L92.8 94.3L92.3 94.3L92 93.5L89.3 91L88.3 90.8L87.8 90L86.8 89.8L86 89L85 89L83.3 88L80.5 87.8L79.8 87.3L68 87L67.5 86.5L67.5 82.5Z" />
      <circle cx="300" cy="260.5" r="24.3" fill="var(--primary)" />
    </svg>
  )
}
