import { createFileRoute, redirect } from '@tanstack/react-router'
import * as z from 'zod/mini'
import { sharedLocation, toSplat } from '@/lib/links'

const field = z.catch(z.optional(z.string().check(z.maxLength(4096))), undefined)

// The manifest's share_target: sharing a github.com link to the installed app
// opens it here. Never renders: it redirects to the file, or home when the
// share has no repo link in it. Redirects only build app routes, so a share
// can't send anyone off-site.
export const Route = createFileRoute('/share')({
  validateSearch: z.object({ title: field, text: field, url: field }),
  beforeLoad: ({ search }) => {
    const loc = sharedLocation(search)
    if (!loc) throw redirect({ to: '/', replace: true })
    throw redirect({
      to: '/$owner/$repo/$',
      params: { owner: loc.owner, repo: loc.repo, _splat: loc.ref ? toSplat(loc.ref, loc.path) : '' },
      hash: loc.hash || undefined,
      replace: true,
    })
  },
})
