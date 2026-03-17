import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getBrandSeoEntry, brandSeoEntries } from '@/lib/diagnostics/seo-content'
import { buildMetadata } from '@/lib/seo'

type BrandPageProps = {
  params: Promise<{
    slug: string
  }>
}

export async function generateStaticParams() {
  return brandSeoEntries.map((brand) => ({
    slug: brand.slug,
  }))
}

export async function generateMetadata({ params }: BrandPageProps) {
  const { slug } = await params
  const brand = getBrandSeoEntry(slug)

  if (!brand) {
    return buildMetadata({
      title: 'Truck brand diagnostics',
      description: 'TruckHelpNow guidance for commercial truck brand troubleshooting.',
      path: `/brands/${slug}`,
      noIndex: true,
    })
  }

  return buildMetadata({
    title: `${brand.name} truck fault code help and diagnostic guidance`,
    description:
      `TruckHelpNow helps ${brand.name} truck operators organize symptoms, warning lights, and fault-code context before the issue is escalated to a technician or shop.`,
    path: `/brands/${brand.slug}`,
    keywords: [
      `${brand.name} truck fault code help`,
      `${brand.name} diagnostic assistant`,
      `${brand.name} warning light troubleshooting`,
    ],
  })
}

export default async function BrandDetailPage({ params }: BrandPageProps) {
  const { slug } = await params
  const brand = getBrandSeoEntry(slug)

  if (!brand) {
    notFound()
  }

  const faqs = [
    {
      question: `How can TruckHelpNow help with ${brand.name} truck diagnostics?`,
      answer:
        `TruckHelpNow helps ${brand.name} operators capture symptoms, SPN/FMI or OEM fault codes, warning lights, and safety context so the next diagnostic step is clearer and easier to share with a shop.`,
    },
    {
      question: `Does TruckHelpNow replace ${brand.name} OEM diagnostics?`,
      answer:
        'No. The assistant is designed to organize information, recommend low-risk checks first, and improve the handoff to a technician. It does not replace OEM tooling or certified service procedures.',
    },
    {
      question: `What should I include when asking about a ${brand.name} truck problem?`,
      answer:
        'Include the truck year, model, engine, exact symptom, when it happens, any recent repair history, and every warning light or code shown on the dash or scanner.',
    },
  ]

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `${brand.name} truck diagnostics`,
      description: brand.description,
      url: `https://truckhelpnow.com/brands/${brand.slug}`,
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
        {
          '@type': 'ListItem',
          position: 3,
          name: brand.name,
          item: `https://truckhelpnow.com/brands/${brand.slug}`,
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
              <Link href="/brands" className="transition hover:text-slate-200">
                Brands
              </Link>
            </li>
            <li>/</li>
            <li className="text-slate-200">{brand.name}</li>
          </ol>
        </nav>

        <section className="mt-8 rounded-[32px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:p-8">
          <div className="max-w-4xl">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-emerald-200/80">
              Brand diagnostic page
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {brand.name} truck fault code help and troubleshooting
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-300">{brand.description}</p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {brand.focusAreas.map((focus) => (
              <article key={focus} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <h2 className="text-lg font-semibold text-white capitalize">{focus}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  TruckHelpNow keeps {brand.name} diagnostic questions practical, specific, and easier to review from the road or shop floor.
                </p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="search-examples" className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <article className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_18px_40px_rgba(2,6,23,0.3)] sm:p-8">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Common search intent
            </p>
            <h2 id="search-examples" className="mt-3 text-2xl font-semibold tracking-tight text-white">
              How drivers look for {brand.name} diagnostic help
            </h2>
            <ul className="mt-6 space-y-3">
              {brand.queryExamples.map((query) => (
                <li key={query} className="flex gap-3 text-sm leading-7 text-slate-300">
                  <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  <span>{query}</span>
                </li>
              ))}
            </ul>
          </article>

          <aside className="rounded-[32px] border border-emerald-400/20 bg-emerald-400/10 p-6 shadow-[0_18px_40px_rgba(2,6,23,0.3)]">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-emerald-100/80">
              Start here
            </p>
            <p className="mt-3 text-sm leading-7 text-emerald-50">
              When you open the diagnostic chat, include the exact {brand.name} truck details, the symptom, and any code or warning that appeared first.
            </p>
            <Link
              href="/chat"
              className="mt-5 inline-flex items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-300/10 px-4 py-2 text-sm font-medium text-emerald-50 transition hover:bg-emerald-300/20"
            >
              Open diagnostic chat
            </Link>
          </aside>
        </section>

        <section aria-labelledby="featured-faults" className="mt-8 rounded-[32px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_18px_40px_rgba(2,6,23,0.3)] sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Related reading
              </p>
              <h2 id="featured-faults" className="mt-3 text-2xl font-semibold tracking-tight text-white">
                Useful fault-code pages for {brand.name} operators
              </h2>
            </div>
            <Link
              href="/fault-codes"
              className="inline-flex text-sm font-medium text-emerald-300 transition hover:text-emerald-200"
            >
              View all fault-code pages
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {brand.featuredFaults.map((fault) => (
              <article key={fault.code} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <h3 className="text-lg font-semibold text-white">{fault.code}</h3>
                <p className="mt-2 text-sm text-emerald-300">{fault.title}</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">{fault.description}</p>
                <Link
                  href={fault.href}
                  className="mt-4 inline-flex text-sm font-medium text-emerald-300 transition hover:text-emerald-200"
                >
                  Read fault guide
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="brand-faq" className="mt-8 rounded-[32px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_18px_40px_rgba(2,6,23,0.3)] sm:p-8">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
            FAQ
          </p>
          <h2 id="brand-faq" className="mt-3 text-2xl font-semibold tracking-tight text-white">
            Frequently asked questions about {brand.name} truck diagnostics
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
