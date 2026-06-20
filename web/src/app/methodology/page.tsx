import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { calibDate } from "@/lib/veylix-data";

const SECTIONS: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: "What does the risk number mean?",
    a: (
      <>
        The headline figure is a <strong>Value-at-Risk (VaR)</strong>: a realistic bad case rather than the worst
        imaginable one. We show the <strong>1-in-20</strong> loss — over the chosen horizon you would do worse than
        this only about 5% of the time. It is shown in both percent and dollars, because a −20% move means something
        different on a $5,000 book than on a $500,000 one.
      </>
    ),
  },
  {
    q: "How does the Monte Carlo simulation work?",
    a: (
      <>
        We model each day as one shared market move (the “BTC factor”) plus each asset’s own wobble, with{" "}
        <strong>no assumed drift</strong> (we don’t bet on prices going up or down). The simulator rolls thousands of
        possible day-by-day paths and reads the spread: the median line, the 25–75% band, and the 5–95% band you see in
        the fan. A <strong>fixed random seed</strong> means the same inputs always produce the same picture, so the
        chart is reproducible rather than flickering each time.
      </>
    ),
  },
  {
    q: "What does hedging actually do?",
    a: (
      <>
        Most retail crypto books are, underneath, one big bet on Bitcoin. A hedge takes an <strong>offsetting short
        position</strong> so that when BTC falls, the short gains and cushions the book. In the model this lowers your{" "}
        <strong>effective BTC beta</strong> toward zero, which lifts the downside floor of the fan while leaving the
        median roughly where it was. The protection isn’t free — you pay <strong>carry</strong> (funding or borrow
        cost) for as long as the hedge is open, which we show as the cost of insurance.
      </>
    ),
  },
  {
    q: "Why is MSTR used as a proxy?",
    a: (
      <>
        Some investors can’t trade crypto derivatives — UK and US retail rules restrict perpetual futures, for example.
        MicroStrategy (<strong>MSTR</strong>) is a listed company whose stock moves closely with Bitcoin, so a short
        MSTR position in a normal brokerage approximates a BTC short. We scale it by MSTR’s measured BTC beta to cover
        the same exposure. It is <strong>approximate</strong>: MSTR carries its own company risk, so the floor lifts a
        little less than a direct BTC short at the same ratio. We flag this wherever the proxy is in use.
      </>
    ),
  },
  {
    q: "What is the structural-risk panel?",
    a: (
      <>
        Market risk isn’t the whole story. For your most volatile holding we also surface <strong>on-chain
        structural signals</strong> — how concentrated the holders are (a few whales can move price), and
        contract-safety style flags (verified source, mint authority, liquidity locks). In this build the panel uses{" "}
        <strong>mock data shaped to the Moralis API</strong>, so a live feed can drop straight in.
      </>
    ),
  },
  {
    q: "Where do the numbers come from, and what are the limits?",
    a: (
      <>
        The calibration (volatility, betas, funding and borrow rates) is built from <strong>Bybit market data</strong>{" "}
        for crypto and <strong>MSTR equity data</strong>, as of {calibDate()}. This demo runs the audited engine
        entirely in your browser on mock balances — no live wallet, exchange, or Moralis calls. Everything here is{" "}
        <strong>simulated, not a prediction</strong>, and is provided to explain risk. It is not investment advice and
        not a recommendation to take any position.
      </>
    ),
  },
];

export default function MethodologyPage() {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <nav className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-5 py-3.5">
          <Link href="/" className="text-xl font-bold tracking-tight">Vey<span className="text-primary">lix</span></Link>
          <Link href="/app" className="flex items-center gap-1.5 text-[12px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            <ArrowLeft className="size-3.5" aria-hidden /> Back to the console
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-10">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-primary">How it works</span>
          <h1 className="text-2xl font-bold tracking-tight">Plain-English methodology</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Veylix is built to be understood, not taken on faith. Here is exactly what the numbers mean, how the
            simulation is built, and what it can and can’t tell you — in plain language.
          </p>
        </div>

        <Accordion type="single" collapsible defaultValue="item-0" className="w-full">
          {SECTIONS.map((s, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-sm font-medium">{s.q}</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{s.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <p className="flex items-center gap-1.5 border-t border-border pt-5 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0 text-chart-2" aria-hidden />
          Calibrated from Bybit + MSTR market data · as of {calibDate()} · educational use only, not investment advice.
        </p>
      </main>
    </div>
  );
}
