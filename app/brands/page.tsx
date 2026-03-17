import Link from 'next/link'
import { brandSeoEntries } from '@/lib/diagnostics/seo-content'
import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({
  title: 'Truck Brand Pages for Volvo, Freightliner, Kenworth, and International',
  description:
    'Browse TruckHelpNow brand pages for Volvo, Freightliner, Kenworth, and International truck diagnostics, fault-code help, and safety-first troubleshooting guidance.',
  path: '/brands',
  keywords: [
    'Volvo truck diagnostic help',
    'Freightliner fault code help',
    'Kenworth truck troubleshooting',
    'International truck warning lights',
  ],
})

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Truck brand diagnostic pages',
    description:
      'TruckHelpNow brand pages for common heavy-truck diagnostic searches, including Volvo, Freightliner, Kenworth, and International.',
    url: 'https://truckhelpnow.com/brands',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://truckhelpnow.com/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Brands',
        item: 'https://truckhelpnow.com/brands',
      },
    ],
  },
]

export default function BrandsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-100">
      {jsonLd.map((entry, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entry) }}
        />
      ))}

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
        <nav aria-label="Breadcrumb" className="text-sm text-slate-400">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="transition hover:text-slate-200">
                Home
              </Link>
            </li>
            <li>/</li>
            <li className="text-slate-200">Brands</li>
          </ol>
        </nav>

        <section className="mt-8 rounded-[32px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:p-8">
          <div className="max-w-3xl">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-emerald-200/80">
              Brand hubs
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Truck brand pages for fault-code help and diagnostics
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
              These pages are designed around the way drivers search for help in the field: Volvo truck fault code help, Freightliner derate questions, Kenworth troubleshooting, and International warning-light guidance.
            </p>
          </div>
        </section>

        <section aria-labelledby="brand-grid" className="mt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Current pages
              </p>
              <h2 id="brand-grid" className="mt-3 text-2xl font-semibold tracking-tight text-white">
                Browse supported truck brands
              </h2>
            </div>
            <Link
              href="/chat"
              className="inline-flex items-center justify-center rounded-full border border-emerald-400/50 bg-emerald-400/10 px-5 py-2.5 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/20"
            >
              Start a diagnostic chat
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {brandSeoEntries.map((brand) => (
              <article
                key={brand.slug}
                className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-[0_18px_40px_rgba(2,6,23,0.3)]"
              >
                <h3 className="text-2xl font-semibold text-white">{brand.name}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-300">{brand.description}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {brand.queryExamples.map((query) => (
                    <span
                      key={query}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
                    >
                      {query}
                    </span>
                  ))}
                </div>
                <Link
                  href={brand.href}
                  className="mt-6 inline-flex text-sm font-medium text-emerald-300 transition hover:text-emerald-200"
                >
                  View {brand.name} page
                </Link>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
