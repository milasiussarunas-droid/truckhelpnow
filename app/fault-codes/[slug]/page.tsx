import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getFaultSeoEntry, getRelatedFaultSeoEntries, faultSeoEntries } from '@/lib/diagnostics/seo-content'
import { buildMetadata } from '@/lib/seo'

type FaultCodePageProps = {
  params: Promise<{
    slug: string
  }>
}

export async function generateStaticParams() {
  return faultSeoEntries.map((fault) => ({
    slug: fault.slug,
  }))
}

export async function generateMetadata({ params }: FaultCodePageProps) {
  const { slug } = await params
  const fault = getFaultSeoEntry(slug)

  if (!fault) {
    return buildMetadata({
      title: 'Truck Fault Code Guide',
      description: 'TruckHelpNow fault-code guidance for commercial truck diagnostics.',
      path: `/fault-codes/${slug}`,
      noIndex: true,
    })
  }

  return buildMetadata({
    title: `${fault.code} meaning and truck troubleshooting help`,
    description:
      `${fault.code} typically points to ${fault.title.toLowerCase()}. Review subsystem context, driveability impact, low-risk checks, and related procedures from TruckHelpNow.`,
    path: `/fault-codes/${fault.slug}`,
    keywords: [
      fault.code,
      `${fault.code} fault code help`,
      `${fault.subsystem} truck troubleshooting`,
      `${fault.title} truck diagnostics`,
    ],
    openGraphType: 'article',
  })
}

export default async function FaultCodeDetailPage({ params }: FaultCodePageProps) {
  const { slug } = await params
  const fault = getFaultSeoEntry(slug)

  if (!fault) {
    notFound()
  }

  const relatedFaults = getRelatedFaultSeoEntries(slug)
  const faqs = [
    {
      question: `What does ${fault.code} usually mean on a truck?`,
      answer: `${fault.code} commonly points to ${fault.title.toLowerCase()}. In TruckHelpNow, it is grouped under the ${fault.subsystem} subsystem so drivers and shops can start with the most relevant checks first.`,
    },
    {
      question: `Can I keep driving with ${fault.code}?`,
      answer: `${fault.driveabilitySummary} The final decision should still depend on the full warning picture, related symptoms, and whether the truck is clearly safe to continue moving.`,
    },
    {
      question: `What should I collect before calling a shop about ${fault.code}?`,
      answer:
        'Collect the full code list, when the issue appears, what changed first, and any related warning lights or recent repairs. That context helps the next diagnostic step stay focused.',
    },
  ]

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `${fault.code} meaning and troubleshooting help`,
      description: fault.description,
      url: `https://truckhelpnow.com/fault-codes/${fault.slug}`,
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
        {
          '@type': 'ListItem',
          position: 3,
          name: fault.code,
          item: `https://truckhelpnow.com/fault-codes/${fault.slug}`,
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    },
  ]

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
            <li>
              <Link href="/fault-codes" className="transition hover:text-slate-200">
                Fault codes
              </Link>
            </li>
            <li>/</li>
            <li className="text-slate-200">{fault.code}</li>
          </ol>
        </nav>

        <section className="mt-8 rounded-[32px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-slate-300">
              {fault.severityLabel}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-slate-300">
              {fault.driveabilityLabel}
            </span>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-emerald-100">
              {fault.subsystem}
            </span>
          </div>

          <div className="mt-5 max-w-4xl">
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {fault.code}: {fault.title}
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-300">{fault.description}</p>
            <p className="mt-4 text-sm leading-7 text-slate-400">{fault.subsystemDescription}</p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-lg font-semibold text-white">Driveability</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{fault.driveabilitySummary}</p>
            </article>
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-lg font-semibold text-white">Module context</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                This code is currently grouped under the {fault.module_code ?? 'relevant control module'} so the assistant can frame likely causes and related systems faster.
              </p>
            </article>
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-lg font-semibold text-white">Best next step</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Capture the full fault list and operating condition before clearing anything. That gives the shop or roadside technician a much better starting point.
              </p>
            </article>
          </div>
        </section>

        <section aria-labelledby="common-signals" className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_18px_40px_rgba(2,6,23,0.3)] sm:p-8">
            <h2 id="common-signals" className="text-2xl font-semibold tracking-tight text-white">
              What symptoms often appear with {fault.code}
            </h2>
            <ul className="mt-6 space-y-3">
              {fault.symptomSignals.map((signal) => (
                <li key={signal} className="flex gap-3 text-sm leading-7 text-slate-300">
                  <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  <span>{signal}</span>
                </li>
              ))}
            </ul>
          </div>

          <aside className="rounded-[32px] border border-emerald-400/20 bg-emerald-400/10 p-6 shadow-[0_18px_40px_rgba(2,6,23,0.3)]">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-emerald-100/80">
              Safety note
            </p>
            <p className="mt-3 text-sm leading-7 text-emerald-50">
              TruckHelpNow prioritizes low-risk checks first. If the truck also has brake, steering, overheating, fire-risk, fuel-leak, or low-air symptoms, treat those as the higher-priority issue regardless of the code.
            </p>
            <Link
              href="/chat"
              className="mt-5 inline-flex items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-300/10 px-4 py-2 text-sm font-medium text-emerald-50 transition hover:bg-emerald-300/20"
            >
              Ask about this code in chat
            </Link>
          </aside>
        </section>

        <section aria-labelledby="low-risk-checks" className="mt-8 grid gap-4 lg:grid-cols-2">
          <article className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_18px_40px_rgba(2,6,23,0.3)] sm:p-8">
            <h2 id="low-risk-checks" className="text-2xl font-semibold tracking-tight text-white">
              Low-risk checks before shop-level diagnostics
            </h2>
            <ul className="mt-6 space-y-3">
              {fault.lowRiskChecks.map((check) => (
                <li key={check} className="flex gap-3 text-sm leading-7 text-slate-300">
                  <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  <span>{check}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_18px_40px_rgba(2,6,23,0.3)] sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              Related procedures and shop prep
            </h2>
            {fault.relatedProcedures.length > 0 ? (
              <div className="mt-6 space-y-4">
                {fault.relatedProcedures.map((procedure) => (
                  <div key={procedure.procedure_code} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                    <h3 className="text-lg font-semibold text-white">{procedure.title}</h3>
                    <p className="mt-2 text-sm uppercase tracking-[0.18em] text-slate-500">{procedure.audience}</p>
                    {procedure.summary ? (
                      <p className="mt-3 text-sm leading-7 text-slate-300">{procedure.summary}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-6 text-sm leading-7 text-slate-300">
                No linked procedure is published for this code yet, but capturing the full code list and operating conditions still makes the next shop-level diagnostic step much stronger.
              </p>
            )}
          </article>
        </section>

        {relatedFaults.length > 0 ? (
          <section aria-labelledby="related-codes" className="mt-8 rounded-[32px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_18px_40px_rgba(2,6,23,0.3)] sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Related reading
                </p>
                <h2 id="related-codes" className="mt-3 text-2xl font-semibold tracking-tight text-white">
                  More {fault.subsystem} fault-code pages
                </h2>
              </div>
              <Link
                href="/fault-codes"
                className="inline-flex text-sm font-medium text-emerald-300 transition hover:text-emerald-200"
              >
                Back to all fault codes
              </Link>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {relatedFaults.map((relatedFault) => (
                <article key={relatedFault.code} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <h3 className="text-lg font-semibold text-white">{relatedFault.code}</h3>
                  <p className="mt-2 text-sm text-emerald-300">{relatedFault.title}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{relatedFault.description}</p>
                  <Link
                    href={relatedFault.href}
                    className="mt-4 inline-flex text-sm font-medium text-emerald-300 transition hover:text-emerald-200"
                  >
                    View related code
                  </Link>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section aria-labelledby="fault-faq" className="mt-8 rounded-[32px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_18px_40px_rgba(2,6,23,0.3)] sm:p-8">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
            FAQ
          </p>
          <h2 id="fault-faq" className="mt-3 text-2xl font-semibold tracking-tight text-white">
            Frequently asked questions about {fault.code}
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {faqs.map((faq) => (
              <article key={faq.question} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <h3 className="text-base font-semibold text-white">{faq.question}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{faq.answer}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
