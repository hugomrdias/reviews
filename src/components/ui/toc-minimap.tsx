import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface TocMinimapItem {
  id: string
  title: string
  /** Heading level, 1 to 6. Deeper headings get shorter dashes. */
  level: number
}

const DASH = ["w-4", "w-3", "w-2"]
const INDENT = ["", "pl-3", "pl-6"]

/**
 * A page outline drawn as a column of dashes, one per heading, with the
 * current one lit. Hovering or focusing it opens the titles over the dashes.
 */
function TocMinimap({
  items,
  activeId,
  onSelect,
  label = "On this page",
  className,
}: {
  items: readonly TocMinimapItem[]
  activeId: string | null
  onSelect: (id: string) => void
  label?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  if (items.length === 0) return null
  const top = Math.min(...items.map((item) => item.level))
  const depth = (item: TocMinimapItem) => Math.min(item.level - top, DASH.length - 1)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        openOnHover
        delay={0}
        closeDelay={120}
        aria-label={label}
        data-slot="toc-minimap-trigger"
        className={cn(
          "flex max-h-[60dvh] flex-col items-start gap-2 overflow-hidden rounded-md p-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          className
        )}
      >
        {items.map((item) => (
          <span
            key={item.id}
            aria-hidden
            className={cn(
              "h-0.5 shrink-0 rounded-full bg-muted-foreground/40 transition-colors",
              DASH[depth(item)],
              item.id === activeId && "bg-foreground"
            )}
          />
        ))}
      </PopoverTrigger>
      {/* Opens over the dashes, so each title sits on its own dash. */}
      <PopoverContent
        side="right"
        align="start"
        sideOffset={({ anchor }) => -anchor.width - 6}
        alignOffset={-13}
        className="w-64 gap-0 p-1.5"
      >
        <nav aria-label={label} data-slot="toc-minimap">
          <ul className="flex max-h-[min(70dvh,32rem)] flex-col overflow-y-auto">
            {items.map((item) => {
              const active = item.id === activeId
              return (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    aria-current={active ? "location" : undefined}
                    onClick={(event) => {
                      event.preventDefault()
                      setOpen(false)
                      onSelect(item.id)
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-2 py-1.5 text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
                      active && "bg-accent font-medium text-foreground"
                    )}
                  >
                    <span className="flex w-4 shrink-0" aria-hidden>
                      <span className={cn("h-0.5 rounded-full bg-current", DASH[depth(item)])} />
                    </span>
                    <span className={cn("truncate", INDENT[depth(item)])}>{item.title}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
      </PopoverContent>
    </Popover>
  )
}

export { TocMinimap }
