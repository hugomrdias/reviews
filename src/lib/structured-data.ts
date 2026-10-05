/**
 * The home page's JSON-LD. WebSite gives search engines the site's name, so
 * results say "Reviews" rather than the parent domain. SoftwareApplication says
 * what it is, for crawlers and agents that read structured data.
 */
export function homeStructuredData(origin: string) {
  const url = new URL('/', origin).toString()
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${url}#website`,
        name: 'Reviews',
        url,
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${url}#app`,
        name: 'Reviews',
        description:
          "Read a repository's markdown the way GitHub renders it, select any passage, and leave a note for your team. Notes live in Reviews, never in the repo.",
        url,
        image: new URL('/icon-512.png', origin).toString(),
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        author: { '@type': 'Person', name: 'Hugo Dias', url: 'https://hugodias.me' },
      },
    ],
  }
}

/** JSON for an inline script: `<` is escaped, so no value can close the tag. */
export function jsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
