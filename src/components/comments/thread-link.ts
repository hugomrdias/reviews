/** This page's URL, opened on one thread. */
export function threadLink(threadId: string) {
  const url = new URL(window.location.href)
  url.searchParams.set('thread', threadId)
  url.hash = ''
  return url.toString()
}
