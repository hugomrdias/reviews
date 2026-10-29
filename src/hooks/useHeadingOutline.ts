import { useLayoutEffect, useState, type RefObject } from 'react'
import type { TocMinimapItem } from '@/components/ui/toc-minimap'

const NO_ITEMS: TocMinimapItem[] = []
// Headings scroll to 5rem below the top (scroll-margin-top in .doc); a little
// past that, the heading counts as the one being read.
const READING_LINE = 96

/**
 * The h1–h4 headings rendered inside `ref`, and the one being read: the last
 * heading above the reading line, or the last one once the page is at its end.
 * Ids drop GitHub's "user-content-" prefix, so they work as URL hashes.
 */
export function useHeadingOutline(ref: RefObject<HTMLElement | null>, source: string) {
  const [items, setItems] = useState(NO_ITEMS)
  const [activeId, setActiveId] = useState<string | null>(null)

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const headings = [...root.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id], h4[id]')].filter((h) =>
      h.textContent?.trim(),
    )
    const ids = headings.map((h) => h.id.replace(/^user-content-/, ''))
    setItems(
      headings.map((h, i) => ({ id: ids[i], title: h.textContent!.trim(), level: Number(h.tagName[1]) })),
    )

    const update = () => {
      const page = document.scrollingElement
      const atEnd = page !== null && page.scrollTop > 0 && page.scrollTop + window.innerHeight >= page.scrollHeight - 2
      let current = 0
      if (atEnd) current = headings.length - 1
      else {
        headings.forEach((h, i) => {
          if (h.getBoundingClientRect().top <= READING_LINE) current = i
        })
      }
      setActiveId(ids[current] ?? null)
    }
    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    update()
    // Capture, so scrolling in an inner container counts too.
    window.addEventListener('scroll', schedule, { capture: true, passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule, { capture: true })
      window.removeEventListener('resize', schedule)
    }
  }, [ref, source])

  return { items, activeId }
}
