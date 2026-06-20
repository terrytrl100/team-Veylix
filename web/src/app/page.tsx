import Link from "next/link";
import { GetStartedButton } from "@/components/get-started-button";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Top navigation bar — wordmark left, primary CTA top-right */}
      <header className="border-b border-border">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">Veylix</span>
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
              Educational · not investment advice
            </span>
          </Link>
          {/* Primary call-to-action, top-right — initiates wallet connection */}
          <GetStartedButton />
        </nav>
      </header>

      {/* Hero — quiet around the idea; the cone is the hero later, not here */}
      <main className="flex flex-1 items-center">
        <section className="mx-auto w-full max-w-6xl px-6 py-24">
          <div className="max-w-2xl">
            <p className="mb-4 text-sm font-medium uppercase tracking-widest text-accent">
              Pre-trade risk visibility
            </p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              See the consequence first.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted">
              You can buy, sell, hold, or hedge in one tap. Veylix shows how that
              move reshapes your portfolio&rsquo;s downside{" "}
              <span className="text-foreground">before</span> you commit — in
              terms you can actually read.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              It models <span className="text-foreground">risk and dispersion</span>,
              not predicted returns. It explains; it never recommends.
            </p>

            <div className="mt-10 flex items-center gap-4">
              <GetStartedButton />
              <span className="text-sm text-muted">
                Connect a wallet to begin.
              </span>
            </div>

            {/* Meaning-colour legend: a small, honest nod to the system */}
            <div className="mt-12 flex flex-wrap items-center gap-6 text-xs text-muted">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-downside" />
                Downside
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-upside" />
                Upside
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                Hedge
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer disclaimer — present on every surface */}
      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-6 py-6">
          <p className="text-xs leading-relaxed text-muted">
            Veylix surfaces and explains risk using simulated outcomes from a
            modelled volatility process — these are not forecasts. It does not
            recommend any position, allocation, or hedge. Educational use only.
          </p>
        </div>
      </footer>
    </div>
  );
}
