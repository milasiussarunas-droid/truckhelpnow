import Link from 'next/link'
import { brandSeoEntries, faultSeoEntries } from '@/lib/diagnostics/seo-content'
import { absoluteUrl, buildMetadata, siteConfig } from '@/lib/seo'

export const metadata = buildMetadata({
  title: 'AI Truck Diagnostic Assistant for Fault Codes and Troubleshooting',
  description:
    'TruckHelpNow helps drivers, dispatchers, and shops interpret SPN/FMI fault codes, warning lights, low-power complaints, and other heavy-truck symptoms with practical next steps.',
  path: '/',
  keywords: [
    'AI truck diagnostic assistant',
    'truck warning light help',
    'semi truck fault code interpretation',
    'roadside truck troubleshooting',
  ],
})

const featuredFaults = faultSeoEntries.slice(0, 4)
const homeFaqs = [
  {
    question: 'What does TruckHelpNow help with?',
    answer:
      'TruckHelpNow helps drivers and shops organize truck symptoms, SPN/FMI fault codes, warning lights, and safety signals into clearer next steps before the issue is escalated to a technician.',
  },
  {
    question: 'Can TruckHelpNow help with SPN/FMI fault codes?',
    answer:
      'Yes. The app is designed for heavy-duty truck troubleshooting, including SPN/FMI code intake, symptom summaries, and guidance on what information to capture for shop-level diagnosis.',
  },
  {
    question: 'Is TruckHelpNow a replacement for a mechanic or OEM diagnostics?',
    answer:
      'No. TruckHelpNow is a diagnostic assistant that prioritizes low-risk checks and clearer handoff notes. Safety-critical or uncertain conditions should still be confirmed by a qualified technician.',
  },
  {
    question: 'Which truck brands are covered on the site?',
    answer:
      'The site includes indexable guidance pages for Volvo, Freightliner, Kenworth, and International trucks, along with fault-code pages and the main diagnostic chat workflow.',
  },
]

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.defaultDescription,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteConfig.name,
    url: siteConfig.url,
    logo: absoluteUrl('/icon.svg'),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: siteConfig.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any',
    url: siteConfig.url,
    description:
      'AI-powered truck diagnostic assistant for SPN/FMI fault code help, warning-light interpretation, and safety-first troubleshooting.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: homeFaqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-100">
      {jsonLd.map((entry, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entry) }}
        />
      ))}

      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/10 ring-1 ring-emerald-400/40">
              <span className="text-xs font-semibold text-emerald-300">TH</span>
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">TruckHelpNow</p>
              <p className="text-xs text-slate-400">Truck diagnostics and fault-code help</p>
            </div>
          </Link>

          <nav aria-label="Primary" className="flex flex-wrap items-center gap-2">
            <Link
              href="/fault-codes"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/10"
            >
              Fault codes
            </Link>
            <Link
              href="/brands"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/10"
            >
              Brands
            </Link>
            <Link
              href="/chat"
              className="rounded-full border border-emerald-400/60 bg-emerald-400/10 px-4 py-1.5 text-sm font-medium text-emerald-100 shadow-sm shadow-emerald-500/30 transition hover:bg-emerald-400/20"
            >
              Open assistant
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 md:flex-row md:items-center md:justify-between md:px-6 md:py-16 lg:py-20">
        <div className="max-w-xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-100">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Built for drivers, dispatch, and shop triage
          </div>

          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl md:leading-tight">
            AI truck diagnostic assistant for
            <span className="block text-emerald-300">fault codes, warning lights, and roadside troubleshooting.</span>
          </h1>

          <p className="text-base text-slate-300 sm:text-lg">
            Describe the problem, paste SPN/FMI or OEM fault codes, and get structured next steps that help you decide what to check, what to document, and when the truck should be parked.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/chat"
              className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/40 transition hover:bg-emerald-300"
            >
              Start a diagnostic session
            </Link>
            <Link
              href="/fault-codes"
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/10"
            >
              Browse fault-code pages
            </Link>

            <div className="flex items-center gap-2 text-xs text-slate-400 sm:text-sm">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[0.7rem]">
                24/7
              </span>
              <span>No account required. Works from your phone.</span>
            </div>
          </div>

          <p className="max-w-md text-xs text-slate-500">
            Informational guidance only. Always follow proper safety procedures and consult a qualified technician before working on safety-critical systems like brakes, steering, and suspension.
          </p>
        </div>

        <div className="mt-4 flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_40px_rgba(15,23,42,0.8)] backdrop-blur-sm md:mt-0">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Live diagnostic preview
            </span>
            <span>Typical response &lt; 30 sec</span>
          </div>

          <div className="space-y-3 rounded-xl bg-slate-950/60 p-3">
            <p className="text-[0.7rem] uppercase tracking-[0.15em] text-slate-500">
              Driver input
            </p>
            <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-sm text-slate-200">
              <p>
                &quot;Check engine light came on, power feels low going uphill.
                Freightliner Cascadia, code SPN 4364 FMI 18.&quot;
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-xl bg-slate-950/40 p-3">
            <p className="text-[0.7rem] uppercase tracking-[0.15em] text-slate-500">
              Assistant response
            </p>
            <ol className="space-y-2 text-xs text-slate-200">
              <li>
                <span className="font-medium text-emerald-300">1. Likely area</span>{" "}
                — aftertreatment / DEF system derate related to SPN 4364.
              </li>
              <li>
                <span className="font-medium text-emerald-300">2. Safe checks</span>{" "}
                — verify no active fluid leaks, unusual smells, or smoke. If any
                present, park immediately.
              </li>
              <li>
                <span className="font-medium text-emerald-300">
                  3. Next diagnostics
                </span>{" "}
                — capture full code list, note engine load and DEF level, then
                share with your shop or roadside service.
              </li>
            </ol>
          </div>

          <p className="text-[0.7rem] text-slate-500">
            This is a sample flow. Real responses are tailored to your truck,
            symptoms, and codes.
          </p>
        </div>
      </section>

      <section aria-labelledby="how-it-works" className="border-y border-white/10 bg-slate-950/30">
        <div className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14">
          <div className="max-w-3xl">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-emerald-200/80">
              Search-friendly overview
            </p>
            <h2 id="how-it-works" className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              How TruckHelpNow helps with commercial truck troubleshooting
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300 sm:text-base">
              The site is built for the kind of search intent drivers and shops have in the real world: truck fault code help, semi-truck diagnostic guidance, warning-light interpretation, and cleaner handoff notes when a truck needs a shop.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <article className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/40">
                1
              </div>
              <h3 className="text-base font-semibold">Capture the right context</h3>
              <p className="text-sm text-slate-300">
                Start with truck year, make, model, engine, symptoms, and any SPN/FMI or OEM codes shown on the dash or scan tool.
              </p>
            </article>

            <article className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/40">
                2
              </div>
              <h3 className="text-base font-semibold">Get practical next steps</h3>
              <p className="text-sm text-slate-300">
                TruckHelpNow organizes likely systems involved, low-risk checks, stop-driving conditions, and the key details a shop will need next.
              </p>
            </article>

            <article className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/40">
                3
              </div>
              <h3 className="text-base font-semibold">Move from driver report to shop handoff</h3>
              <p className="text-sm text-slate-300">
                Use the structured response to communicate faster with dispatch, roadside service, or an in-house technician.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section aria-labelledby="supported-topics" className="border-b border-white/10 bg-slate-950/40">
        <div className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Diagnostic entry points
              </p>
              <h2 id="supported-topics" className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                Browse truck fault-code help and supported brand pages
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-300 sm:text-base">
                The strongest SEO pages on the site are designed around real truck-diagnostic searches, including SPN/FMI help, low-power troubleshooting, air-system warnings, brake-related alerts, and brand-oriented entry pages.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/brands"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:border-white/20 hover:bg-white/10"
              >
                Explore truck brands
              </Link>
              <Link
                href="/fault-codes"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:border-white/20 hover:bg-white/10"
              >
                Explore fault codes
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
            <div className="grid gap-4 sm:grid-cols-2">
              {featuredFaults.map((fault) => (
                <article
                  key={fault.code}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
                >
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-emerald-200/80">
                    {fault.severityLabel}
                  </p>
                  <h3 className="mt-3 text-lg font-semibold text-white">{fault.code}</h3>
                  <p className="mt-2 text-sm text-emerald-300">{fault.title}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{fault.description}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                    {fault.driveabilityLabel}
                  </p>
                  <Link
                    href={fault.href}
                    className="mt-4 inline-flex text-sm font-medium text-emerald-300 transition hover:text-emerald-200"
                  >
                    Read this fault-code guide
                  </Link>
                </article>
              ))}
            </div>

            <aside className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Covered brands
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {brandSeoEntries.map((brand) => (
                  <Link
                    key={brand.slug}
                    href={brand.href}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 transition hover:border-white/20 hover:bg-white/10"
                  >
                    {brand.name}
                  </Link>
                ))}
              </div>
              <p className="mt-5 text-sm leading-6 text-slate-300">
                Brand pages are focused on the real searches drivers make for Volvo, Freightliner, Kenworth, and International truck diagnostics.
              </p>
              <Link
                href="/brands"
                className="mt-4 inline-flex text-sm font-medium text-emerald-300 transition hover:text-emerald-200"
              >
                View all brand pages
              </Link>
            </aside>
          </div>
        </div>
      </section>

      <section aria-labelledby="faq" className="border-b border-white/10 bg-black/30">
        <div className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14">
          <div className="max-w-3xl">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
              FAQ
            </p>
            <h2 id="faq" className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Common questions about truck diagnostic AI and fault-code help
            </h2>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {homeFaqs.map((faq) => (
              <article key={faq.question} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <h3 className="text-base font-semibold text-white">{faq.question}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-black/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-10 md:flex-row md:items-center md:justify-between md:px-6 md:py-14">
          <div className="max-w-2xl">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-emerald-200/80">
              Ready to diagnose
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Start with the truck, the symptom, and the fault code you have.
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300 sm:text-base">
              TruckHelpNow works best when you include the truck details, the operating condition, and any visible warning or code. The output stays focused on practical troubleshooting instead of generic chatbot text.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/chat"
              className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/40 transition hover:bg-emerald-300"
            >
              Open the assistant
            </Link>
            <Link
              href="/fault-codes"
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/10"
            >
              Review example fault codes
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-black/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 text-xs text-slate-500 md:flex-row md:items-center md:justify-between md:px-6">
          <p>© {new Date().getFullYear()} TruckHelpNow. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/brands" className="transition hover:text-slate-300">
              Brands
            </Link>
            <Link href="/fault-codes" className="transition hover:text-slate-300">
              Fault codes
            </Link>
            <Link href="/chat" className="transition hover:text-slate-300">
              Diagnostic chat
            </Link>
          </div>
          <p className="text-[0.7rem] md:text-right md:text-xs">
            Not a replacement for certified diagnostics. Always follow OEM and shop procedures.
          </p>
        </div>
      </footer>
    </main>
  )
}