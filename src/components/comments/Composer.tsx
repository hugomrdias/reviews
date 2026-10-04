import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Textarea } from '@/components/ui/textarea'
import { MAX_COMMENT_LENGTH } from '@/lib/threads'
import { cn } from '@/lib/utils'

interface ComposerProps {
  placeholder: string
  submitLabel: string
  initialValue?: string
  autoFocus?: boolean
  pending?: boolean
  className?: string
  onSubmit: (body: string) => void | Promise<unknown>
  onCancel?: () => void
}

/** A comment box. ⌘/Ctrl+Enter submits, Escape cancels. */
export function Composer({
  placeholder,
  submitLabel,
  initialValue = '',
  autoFocus,
  pending,
  className,
  onSubmit,
  onCancel,
}: ComposerProps) {
  const [value, setValue] = useState(initialValue)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true })
  }, [autoFocus])

  const trimmed = value.trim()
  const tooLong = value.length > MAX_COMMENT_LENGTH

  const submit = async () => {
    if (!trimmed || tooLong || pending) return
    try {
      await onSubmit(trimmed)
      setValue('')
    } catch {
      // The mutation reports the error; keep the text so nothing is lost.
    }
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Textarea
        ref={ref}
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        rows={2}
        className="min-h-16 resize-y bg-card text-sm"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            void submit()
          } else if (e.key === 'Escape' && onCancel) {
            e.preventDefault()
            onCancel()
          }
        }}
      />
      <div className="flex items-center justify-end gap-2">
        {tooLong ? (
          <span className="mr-auto text-xs text-destructive">
            {value.length - MAX_COMMENT_LENGTH} characters over the limit
          </span>
        ) : (
          <span className="mr-auto hidden text-xs text-muted-foreground sm:inline">
            <Kbd>⌘</Kbd> <Kbd>Enter</Kbd> to send
          </span>
        )}
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="button" size="sm" disabled={!trimmed || tooLong || pending} onClick={() => void submit()}>
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}
