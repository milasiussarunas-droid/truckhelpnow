import type { MetadataRoute } from 'next'
import { brandSeoEntries, faultSeoEntries } from '@/lib/diagnostics/seo-content'
import { absoluteUrl, siteConfig } from '@/lib/seo'

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl('/'),
      lastModified: siteConfig.updatedAt,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: absoluteUrl('/chat'),
      lastModified: siteConfig.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.95,
    },
    {
      url: absoluteUrl('/fault-codes'),
      lastModified: siteConfig.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: absoluteUrl('/brands'),
      lastModified: siteConfig.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.85,
    },
  ]

  const faultPages: MetadataRoute.Sitemap = faultSeoEntries.map((fault) => ({
    url: absoluteUrl(fault.href),
    lastModified: siteConfig.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  const brandPages: MetadataRoute.Sitemap = brandSeoEntries.map((brand) => ({
    url: absoluteUrl(brand.href),
    lastModified: siteConfig.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.75,
  }))

  return [
    ...staticPages,
    ...faultPages,
    ...brandPages,
  ]
}
