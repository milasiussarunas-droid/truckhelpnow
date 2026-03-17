import Link from 'next/link'
import { faultSeoEntries } from '@/lib/diagnostics/seo-content'
import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({
  title: 'Truck Fault Code Help for SPN/FMI Diagnostics',
  description:
    'Browse TruckHelpNow fault-code pages for SPN/FMI help, subsystem context, driveability impact, and safety-first next steps for commercial truck diagnostics.',
  path: '/fault-codes',
  keywords: [
    'truck fault code help',
    'SPN FMI troubleshooting',
    'semi truck code lookup help',
    'commercial truck diagnostic codes',
  ],
})

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Truck Fault Code Help',
    description:
      'Collection of TruckHelpNow fault-code pages covering common SPN/FMI diagnostics for heavy-duty trucks.',
    url: 'https://truckhelpnow.com/fault-codes',
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
        name: 'Fault Codes',
        item: 'https://truckhelpnow.com/fault-codes',
      },
    ],
  },
]

export default function FaultCodesPage() {
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
            <li className="text-slate-200">Fault codes</li>
          </ol>
        </nav>

        <section className="mt-8 rounded-[32px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:p-8">
          <div className="max-w-3xl">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-emerald-200/80">
              TruckHelpNow library
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Truck fault code help for SPN/FMI diagnostics
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
              These pages are built for real search intent around heavy-truck fault codes. Each entry explains the subsystem involved, why the code matters, what symptoms often show up, and what information helps before the truck is escalated to a technician.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-lg font-semibold text-white">Use this library when</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                You have an SPN/FMI code, a dash warning, or a low-power complaint and need clearer context before calling a shop.
              </p>
            </article>
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-lg font-semibold text-white">What the pages include</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Severity, driveability notes, likely subsystem impact, low-risk checks, and related procedures when available.
              </p>
            </article>
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-lg font-semibold text-white">What they do not replace</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                OEM diagnostics, multimeter work, brake-system verification, or safety-critical inspection by a qualified technician.
              </p>
            </article>
          </div>
        </section>

        <section aria-labelledby="fault-code-grid" className="mt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Index
              </p>
              <h2 id="fault-code-grid" className="mt-3 text-2xl font-semibold tracking-tight text-white">
                Browse current fault-code pages
              </h2>
            </div>
            <Link
              href="/chat"
              className="inline-flex items-center justify-center rounded-full border border-emerald-400/50 bg-emerald-400/10 px-5 py-2.5 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/20"
            >
              Open diagnostic chat
            </Link>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {faultSeoEntries.map((fault) => (
              <article
                key={fault.code}
                className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-[0_18px_40px_rgba(2,6,23,0.3)]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-slate-300">
                    {fault.severityLabel}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-slate-300">
                    {fault.driveabilityLabel}
                  </span>
                </div>
                <h3 className="mt-4 text-xl font-semibold text-white">{fault.code}</h3>
                <p className="mt-2 text-base text-emerald-300">{fault.title}</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">{fault.description}</p>
                <p className="mt-4 text-sm leading-7 text-slate-400">{fault.subsystemDescription}</p>
                <Link
                  href={fault.href}
                  className="mt-5 inline-flex text-sm font-medium text-emerald-300 transition hover:text-emerald-200"
                >
                  View code details
                </Link>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
