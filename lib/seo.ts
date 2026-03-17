import type { Metadata } from 'next'

export const siteConfig = {
  name: 'TruckHelpNow',
  shortName: 'TruckHelpNow',
  url: 'https://truckhelpnow.com',
  defaultTitle: 'AI Truck Diagnostic Assistant & Fault Code Help',
  defaultDescription:
    'TruckHelpNow helps drivers, dispatchers, and shops interpret truck symptoms, SPN/FMI fault codes, and safety-critical warning signs with structured, practical next steps.',
  ogImagePath: '/opengraph-image',
  twitterImagePath: '/twitter-image',
  updatedAt: new Date('2026-03-17T00:00:00.000Z'),
} as const

export const coreKeywords = [
  'truck diagnostic AI',
  'truck fault code help',
  'semi truck diagnostic assistant',
  'commercial truck troubleshooting',
  'SPN FMI help',
  'heavy truck fault codes',
  'truck repair guidance',
  'Volvo truck code help',
  'Freightliner fault code help',
]

type BuildMetadataOptions = {
  title: string
  description: string
  path: string
  keywords?: string[]
  noIndex?: boolean
  openGraphType?: 'website' | 'article'
}

export function absoluteUrl(path = '/') {
  return new URL(path, siteConfig.url).toString()
}

export function buildMetadata({
  title,
  description,
  path,
  keywords = [],
  noIndex = false,
  openGraphType = 'website',
}: BuildMetadataOptions): Metadata {
  const canonical = absoluteUrl(path)
  const mergedKeywords = Array.from(new Set([...coreKeywords, ...keywords]))

  return {
    title,
    description,
    keywords: mergedKeywords,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: siteConfig.name,
      locale: 'en_US',
      type: openGraphType,
      images: [
        {
          url: absoluteUrl(siteConfig.ogImagePath),
          width: 1200,
          height: 630,
          alt: 'TruckHelpNow AI truck diagnostic assistant',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [absoluteUrl(siteConfig.twitterImagePath)],
    },
    robots: noIndex
      ? {
          index: false,
          follow: true,
          googleBot: {
            index: false,
            follow: true,
          },
        }
      : undefined,
  }
}
