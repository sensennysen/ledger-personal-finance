import { useRef } from 'react'
import { Pipette } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  palette: string[]
  className?: string
}

/**
 * Swatch palette + a native color-input button for picking any custom color.
 * The "custom" swatch shows the currently selected color when it isn't in the palette.
 */
export function ColorPicker({ value, onChange, palette, className }: ColorPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isCustom = !palette.includes(value)

  return (
    <div className={cn('flex gap-2 flex-wrap items-center', className)}>
      {palette.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110"
          style={{
            backgroundColor: c,
            borderColor: value === c ? 'white' : 'transparent',
            outline: value === c ? `2px solid ${c}` : 'none',
            outlineOffset: '2px',
          }}
          aria-label={c}
        />
      ))}

      {/* Custom color button */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110 flex items-center justify-center overflow-hidden relative"
        style={{
          backgroundColor: isCustom ? value : 'transparent',
          borderColor: isCustom ? 'white' : 'hsl(var(--border))',
          outline: isCustom ? `2px solid ${value}` : 'none',
          outlineOffset: '2px',
        }}
        aria-label="Custom color"
        title="Custom color…"
      >
        {!isCustom && <Pipette className="w-3.5 h-3.5 text-muted-foreground" />}
        <input
          ref={inputRef}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
          tabIndex={-1}
        />
      </button>
    </div>
  )
}
