const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "TruckHelpNow",
  description:
    "AI-powered truck repair and diagnostic assistant. Turn symptoms and fault codes (SPN/FMI) into clear, safety-minded next steps for drivers and dispatchers.",
  url: "https://truckhelpnow.com",
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Top nav */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/10 ring-1 ring-emerald-400/40">
              <span className="text-xs font-semibold text-emerald-300">TH</span>
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">
                TruckHelpNow
              </p>
              <p className="text-xs text-slate-400">
                Roadside repair & diagnostics
              </p>
            </div>
          </div>

          <a
            href="/chat"
            className="hidden rounded-full border border-emerald-400/60 bg-emerald-400/10 px-4 py-1.5 text-sm font-medium text-emerald-100 shadow-sm shadow-emerald-500/30 transition hover:bg-emerald-400/20 md:inline-flex"
          >
            Open assistant
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 md:flex-row md:items-center md:justify-between md:py-16 lg:py-20 md:px-6">
        <div className="max-w-xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-100">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Built for drivers on the road
          </div>

          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl md:leading-tight">
            Truck repair & diagnostic help,
            <span className="block text-emerald-300">before it’s an emergency.</span>
          </h1>

          <p className="text-base text-slate-300 sm:text-lg">
            Describe what&apos;s happening, drop in fault codes, and get guided
            next steps to keep your truck moving safely. Designed for drivers,
            dispatchers, and late‑night breakdowns.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="/chat"
              className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/40 transition hover:bg-emerald-300"
            >
              Start a diagnostic session
            </a>

            <div className="flex items-center gap-2 text-xs text-slate-400 sm:text-sm">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[0.7rem]">
                24/7
              </span>
              <span>No account required. Works from your phone.</span>
            </div>
          </div>

          <p className="max-w-md text-xs text-slate-500">
            Informational guidance only. Always follow proper safety procedures
            and consult a qualified technician before working on safety‑critical
            systems like brakes, steering, and suspension.
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

      {/* Features */}
      <section className="border-t border-white/10 bg-slate-950/40">
        <div className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="space-y-3">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/40">
                ⏱
              </div>
              <h2 className="text-base font-semibold">Built for the moment</h2>
              <p className="text-sm text-slate-300">
                No logins, no complicated menus. Open, describe what you&apos;re
                seeing, and get structured next steps in under a minute.
              </p>
            </div>

            <div className="space-y-3">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/40">
                🛠
              </div>
              <h2 className="text-base font-semibold">Designed for technicians</h2>
              <p className="text-sm text-slate-300">
                Turn driver descriptions and fault codes into notes your shop
                can actually use, with likely areas and suggested checks.
              </p>
            </div>

            <div className="space-y-3">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/40">
                📱
              </div>
              <h2 className="text-base font-semibold">Optimized for your phone</h2>
              <p className="text-sm text-slate-300">
                Clean, high‑contrast interface that works from the cab, the
                fuel island, or the side of the road.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/80">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-slate-500 md:flex-row md:px-6">
          <p>© {new Date().getFullYear()} TruckHelpNow. All rights reserved.</p>
          <p className="text-[0.7rem] md:text-xs">
            Not a replacement for certified diagnostics. Always follow OEM and
            shop procedures.
          </p>
        </div>
      </footer>
    </main>
  );
}