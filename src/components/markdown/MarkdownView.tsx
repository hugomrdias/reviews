import { Link } from '@tanstack/react-router'
import type { Element, ElementContent } from 'hast'
import { AlertTriangle, Info, Lightbulb, MessageSquareWarning, OctagonAlert } from 'lucide-react'
import { memo, useMemo, type ComponentProps, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import { CodeBlock } from '@/components/code/CodeBlock'
import { MermaidDiagram } from '@/components/markdown/MermaidDiagram'
import { resolveAssetPath, resolveRepoLink, toSplat } from '@/lib/links'
import { markdownPipeline } from '@/lib/markdown/pipeline'
import { ALERT_LABELS, type AlertType } from '@/lib/markdown/plugins'

export interface RepoContext {
  owner: string
  repo: string
  /** Ref as shown in the URL; links keep it. */
  ref: string
  /** Commit SHA; asset URLs pin to it. */
  sha: string
  path: string
  paths: readonly string[]
  pathSet: ReadonlySet<string>
}

export function rawUrl(ctx: Pick<RepoContext, 'owner' | 'repo' | 'sha'>, path: string) {
  return `/api/raw/${ctx.owner}/${ctx.repo}/${ctx.sha}/${path.split('/').map(encodeURIComponent).join('/')}`
}

/** Scrolls to a heading or footnote; ids carry GitHub's "user-content-" prefix. */
export function scrollToHash(hash: string) {
  if (!hash) return
  const el = document.getElementById(`user-content-${hash}`) ?? document.getElementById(hash)
  el?.scrollIntoView({ block: 'start' })
}

function MdLink({ ctx, href, children, node: _node, ...rest }: ComponentProps<'a'> & { ctx: RepoContext; node?: Element }) {
  const link = resolveRepoLink(href ?? '', ctx)
  switch (link.kind) {
    case 'external':
      return (
        <a {...rest} href={link.href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      )
    case 'hash':
      return (
        <a
          {...rest}
          href={`#${link.hash}`}
          onClick={(event) => {
            event.preventDefault()
            history.replaceState(null, '', `#${link.hash}`)
            scrollToHash(link.hash)
          }}
        >
          {children}
        </a>
      )
    case 'internal':
      return (
        <Link
          {...rest}
          to="/$owner/$repo/$"
          params={{ owner: ctx.owner, repo: ctx.repo, _splat: toSplat(link.ref ?? ctx.ref, link.path) }}
          hash={link.hash || undefined}
          hashScrollIntoView={false}
        >
          {children}
        </Link>
      )
    default:
      return <span title="This link points outside the repository">{children}</span>
  }
}

function MdImage({ ctx, src, node: _node, alt, ...rest }: ComponentProps<'img'> & { ctx: RepoContext; node?: Element }) {
  const path = typeof src === 'string' ? resolveAssetPath(src, ctx.path) : null
  return (
    <img
      {...rest}
      alt={alt ?? ''}
      src={path ? rawUrl(ctx, path) : (src as string | undefined)}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  )
}

function MdSource({ ctx, srcSet, node: _node, ...rest }: ComponentProps<'source'> & { ctx: RepoContext; node?: Element }) {
  const rewritten = srcSet
    ?.split(',')
    .map((part) => {
      const [url, descriptor] = part.trim().split(/\s+/, 2)
      const path = resolveAssetPath(url, ctx.path)
      return [path ? rawUrl(ctx, path) : url, descriptor].filter(Boolean).join(' ')
    })
    .join(', ')
  return <source {...rest} srcSet={rewritten} />
}

function textOf(node: ElementContent): string {
  if (node.type === 'text') return node.value
  if (node.type === 'element') return node.children.map(textOf).join('')
  return ''
}

function MdPre({ node, children }: ComponentProps<'pre'> & { node?: Element }) {
  const code = node?.children.find((c): c is Element => c.type === 'element' && c.tagName === 'code')
  if (!code) return <pre>{children}</pre>
  const className = code.properties.className
  const lang = (Array.isArray(className) ? className : [])
    .map(String)
    .find((c) => c.startsWith('language-'))
    ?.slice('language-'.length)
  const source = textOf(code).replace(/\n$/, '')
  if (lang?.toLowerCase() === 'mermaid') return <MermaidDiagram source={source} />
  return <CodeBlock code={source} lang={lang} />
}

const ALERTS: Record<AlertType, { icon: ReactNode; tone: string }> = {
  note: { icon: <Info />, tone: 'border-l-sky-600 [&_svg]:text-sky-600' },
  tip: { icon: <Lightbulb />, tone: 'border-l-emerald-600 [&_svg]:text-emerald-600' },
  important: { icon: <MessageSquareWarning />, tone: 'border-l-violet-600 [&_svg]:text-violet-600' },
  warning: { icon: <AlertTriangle />, tone: 'border-l-amber-600 [&_svg]:text-amber-600' },
  caution: { icon: <OctagonAlert />, tone: 'border-l-red-600 [&_svg]:text-red-600' },
}

function MdBlockquote({ node, children, ...rest }: ComponentProps<'blockquote'> & { node?: Element }) {
  const type = node?.properties.dataAlert as AlertType | undefined
  if (!type || !ALERTS[type]) return <blockquote {...rest}>{children}</blockquote>
  const alert = ALERTS[type]
  return (
    <div
      data-alert-box
      data-sline={node?.properties.dataSline as number | undefined}
      data-eline={node?.properties.dataEline as number | undefined}
      className={`rounded-r-md border-l-4 bg-card py-3 pr-4 pl-4 font-sans text-[0.9375rem] leading-relaxed [&>p:last-child]:mb-0 ${alert.tone}`}
    >
      <p className="mb-1.5 flex items-center gap-2 font-semibold [&_svg]:size-4">
        {alert.icon}
        {ALERT_LABELS[type]}
      </p>
      {children}
    </div>
  )
}

/**
 * Renders repo markdown the way GitHub does: GFM, alerts, sanitized raw
 * HTML, "user-content-" heading ids. Relative links stay in the app and
 * relative images load through the asset proxy.
 */
export const MarkdownView = memo(function MarkdownView({
  source,
  ctx,
}: {
  source: string
  ctx: RepoContext
}) {
  const components = useMemo<Components>(
    () => ({
      a: (props) => <MdLink {...props} ctx={ctx} />,
      img: (props) => <MdImage {...props} ctx={ctx} />,
      source: (props) => <MdSource {...props} ctx={ctx} />,
      pre: MdPre,
      blockquote: MdBlockquote,
    }),
    [ctx],
  )
  const pipeline = markdownPipeline(ctx.path)
  return (
    <ReactMarkdown
      remarkPlugins={pipeline.remarkPlugins}
      remarkRehypeOptions={pipeline.remarkRehypeOptions}
      rehypePlugins={pipeline.rehypePlugins}
      components={components}
    >
      {source}
    </ReactMarkdown>
  )
})
