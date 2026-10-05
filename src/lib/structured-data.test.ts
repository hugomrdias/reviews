import { describe, expect, it } from 'vitest'
import { homeStructuredData, jsonLd } from './structured-data'

describe('homeStructuredData', () => {
  it('names the site and the app at the given origin', () => {
    const data = homeStructuredData('https://reviews.example.com')
    const [site, app] = data['@graph']
    expect(site).toMatchObject({ '@type': 'WebSite', name: 'Reviews', url: 'https://reviews.example.com/' })
    expect(app).toMatchObject({
      '@type': 'SoftwareApplication',
      url: 'https://reviews.example.com/',
      image: 'https://reviews.example.com/icon-512.png',
    })
  })
})

describe('jsonLd', () => {
  it('round-trips and never closes the script tag', () => {
    const data = { text: '</script><script>alert(1)</script>' }
    const out = jsonLd(data)
    expect(out).not.toContain('<')
    expect(JSON.parse(out)).toEqual(data)
  })
})
