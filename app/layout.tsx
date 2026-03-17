import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { absoluteUrl, coreKeywords, siteConfig } from '@/lib/seo'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  applicationName: siteConfig.name,
  title: {
    default: `${siteConfig.name} | ${siteConfig.defaultTitle}`,
    template: '%s | TruckHelpNow',
  },
  description: siteConfig.defaultDescription,
  keywords: coreKeywords,
  alternates: {
    canonical: '/',
  },
  category: 'technology',
  classification: 'Commercial truck diagnostics and fault-code guidance',
  referrer: 'origin-when-cross-origin',
  formatDetection: {
    telephone: false,
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/apple-icon',
  },
  appleWebApp: {
    capable: true,
    title: siteConfig.shortName,
    statusBarStyle: 'black-translucent',
  },
  openGraph: {
    title: `${siteConfig.name} | ${siteConfig.defaultTitle}`,
    description: siteConfig.defaultDescription,
    url: siteConfig.url,
    siteName: siteConfig.name,
    type: 'website',
    locale: 'en_US',
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
    title: `${siteConfig.name} | ${siteConfig.defaultTitle}`,
    description: siteConfig.defaultDescription,
    images: [absoluteUrl(siteConfig.twitterImagePath)],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#020617',
  colorScheme: 'dark',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
