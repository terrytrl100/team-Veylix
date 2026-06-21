import Link from "next/link";
import { GetStartedButton } from "@/components/get-started-button";
import { Button } from "@/components/ui/button";

const YOUTUBE_VIDEO_ID = "4ARYLbXzF6Q";

export const metadata = {
  title: "Demo — Veylix",
  description: "See how Veylix helps you understand your crypto portfolio's real risk exposure.",
};

export default function DemoPage() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      {/* ── Nav ─────────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10 sm:py-6">
        <Link
          href="/"
          className="text-3xl font-semibold tracking-tight text-foreground transition-opacity hover:opacity-70 sm:text-4xl"
        >
          Veylix
        </Link>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild className="border-border bg-surface text-foreground hover:bg-surface-2 px-5 py-2.5 text-sm font-semibold sm:px-6 sm:py-3 sm:text-base">
            <Link href="/">← Back</Link>
          </Button>
          <GetStartedButton />
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────── */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-4xl">

          {/* Heading */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              See Veylix in action
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
              Watch how Veylix surfaces the real risk inside a crypto portfolio
              and shows the effect of hedging — before you commit to any trade.
            </p>
          </div>

          {/* Video embed — 16:9 responsive */}
          <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
               style={{ paddingBottom: "56.25%" }}>
            <iframe
              src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?rel=0&modestbranding=1&color=white`}
              title="Veylix demo video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>

          {/* CTA below video */}
          <div className="mt-10 text-center">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted/40">
              Educational &middot; not investment advice
            </p>
          </div>

        </div>
      </section>
    </main>
  );
}
