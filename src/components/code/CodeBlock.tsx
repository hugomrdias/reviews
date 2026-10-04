import { memo, useMemo } from 'react'
import { DiffsOnly, File } from './diffs'
import { normalizeLang, useDiffsTheme } from './diffs-options'

function hash(value: string) {
  let h = 5381
  for (let i = 0; i < value.length; i++) h = (h * 33) ^ value.charCodeAt(i)
  return (h >>> 0).toString(36)
}

export function PlainCode({ code }: { code: string }) {
  return (
    <pre className="plain-code">
      <code>{code}</code>
    </pre>
  )
}

/**
 * A fenced code block inside rendered markdown, highlighted by @pierre/diffs.
 * The server renders plain text with the same metrics; highlighting arrives
 * after hydration. data-anchor-skip keeps it out of comment anchoring.
 */
export const CodeBlock = memo(function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const diffsTheme = useDiffsTheme()
  const language = normalizeLang(lang)
  const file = useMemo(
    () => ({ name: `snippet.${language}`, contents: code, lang: language as never, cacheKey: hash(code) }),
    [code, language],
  )
  const options = useMemo(
    () => ({ ...diffsTheme, disableFileHeader: true, disableLineNumbers: true, overflow: 'scroll' as const }),
    [diffsTheme],
  )
  return (
    <div data-anchor-skip className="overflow-hidden rounded-lg border bg-card">
      <DiffsOnly fallback={<PlainCode code={code} />}>
        <File file={file} options={options} />
      </DiffsOnly>
    </div>
  )
})
