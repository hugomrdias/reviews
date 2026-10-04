import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import { commentSchema } from '@/lib/markdown/schema'

const remarkPlugins = [remarkGfm]
const rehypePlugins = [[rehypeSanitize, commentSchema]] as never

/** Comment text: GFM without raw HTML or images. Links open in a new tab. */
export const CommentBody = memo(function CommentBody({ body }: { body: string }) {
  return (
    <div className="text-sm leading-relaxed break-words [&_a]:text-link [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-2 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em] [&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-2 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  )
})
