"use client";

import { useMemo, useState, useDeferredValue } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ShieldCheck, TriangleAlert, BookOpen } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { RiskGauge } from "@/components/app/RiskGauge";
import { MonteCarloArea } from "@/components/app/MonteCarloArea";
import { PortfolioDonut } from "@/components/app/PortfolioDonut";
import { MetricTiles } from "@/components/app/MetricTiles";
import { ActionsList } from "@/components/app/ActionsList";
import { StructuralRiskPanel } from "@/components/app/StructuralRiskPanel";
import { InfoTip } from "@/components/app/InfoTip";

import { buildView, type ViewInputs } from "@/lib/veylix-view";
import { buildStructuralRisk } from "@/lib/moralis-mock";
import {
  calibDate, fmtPct, fmtUsd, horizonWord, HORIZONS, JURISDICTIONS, PORTFOLIO_META,
} from "@/lib/veylix-data";
import type { Instrument } from "@/lib/veylix-sim";

function SectionLabel({ children, tip, tipLabel }: { children: React.ReactNode; tip?: string; tipLabel?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
      <span>{children}</span>
      {tip && <InfoTip label={tipLabel ?? String(children)} text={tip} />}
    </div>
  );
}

function HeroRow({ p5, p5u, p50, p50u, p95, p95u, prefix }: {
  p5: number; p5u: number; p50: number; p50u: number; p95: number; p95u: number; prefix: string;
}) {
  return (
    <dl className="grid grid-cols-3 gap-2 text-center">
      <div>
        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Worst 5%</dt>
        <dd data-testid={`${prefix}p5-pct`} className="font-mono text-sm font-bold tabular-nums text-destructive">{fmtPct(p5)}</dd>
        <dd data-testid={`${prefix}p5-usd`} className="font-mono text-[11px] tabular-nums text-muted-foreground">≈ ${fmtUsd(p5u)}</dd>
      </div>
      <div>
        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Median</dt>
        <dd data-testid={`${prefix}p50-pct`} className={`font-mono text-sm font-bold tabular-nums ${p50 >= 0 ? "text-chart-2" : "text-destructive"}`}>{fmtPct(p50)}</dd>
        <dd className="font-mono text-[11px] tabular-nums text-muted-foreground">≈ ${fmtUsd(p50u)}</dd>
      </div>
      <div>
        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Best 5%</dt>
        <dd className="font-mono text-sm font-bold tabular-nums text-chart-2">{fmtPct(p95)}</dd>
        <dd className="font-mono text-[11px] tabular-nums text-muted-foreground">≈ ${fmtUsd(p95u)}</dd>
      </div>
    </dl>
  );
}

export default function AppPage() {
  const [portfolioId, setPortfolioId] = useState("client_alpha");
  const [horizon, setHorizon] = useState(30);
  const [jurisdictionId, setJurisdictionId] = useState("intl");
  const [hedge, setHedge] = useState(0); // percent 0..100
  const [instrument, setInstrument] = useState<Instrument>("BTC");
  const [view, setView] = useState("current");

  const jur = JURISDICTIONS.find((j) => j.id === jurisdictionId) ?? JURISDICTIONS[0];
  const derivativesAllowed = jur.cryptoDerivativesAllowed;

  const deferredHedge = useDeferredValue(hedge);
  const inputs: ViewInputs = {
    portfolioId, hedge: deferredHedge / 100, instrument, horizonDays: horizon, jurisdictionId,
  };
  const v = useMemo(() => buildView(inputs), [portfolioId, deferredHedge, instrument, horizon, jurisdictionId]);
  const risk = useMemo(() => buildStructuralRisk(portfolioId), [portfolioId]);

  const hedgePct = Math.round(hedge);
  const fundingLabel = v.resolvedInstrument === "BTC" ? "BTC funding (ann.)" : "MSTR borrow (ann.)";

  return (
    <TooltipProvider delayDuration={120}>
      <div className="dark min-h-screen bg-background text-foreground">
        {/* Header */}
        <header className="border-b border-border">
          <nav className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <Link href="/" className="flex items-baseline gap-2.5">
              <span className="text-xl font-bold tracking-tight">Vey<span className="text-primary">lix</span></span>
              <span className="hidden text-[11px] text-muted-foreground sm:inline">see the consequence first</span>
            </Link>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="hidden border-border text-[11px] font-normal text-muted-foreground sm:inline-flex">
                Educational · not investment advice
              </Badge>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Portfolio value</div>
                <div className="font-mono text-base font-bold tabular-nums">${fmtUsd(v.equity)}</div>
              </div>
              <ConnectButton showBalance={false} accountStatus="avatar" chainStatus="none" />
            </div>
          </nav>
        </header>

        <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-5">
          {/* Breadcrumb + provenance */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem><BreadcrumbLink asChild><Link href="/">Veylix</Link></BreadcrumbLink></BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem><BreadcrumbLink>Risk console</BreadcrumbLink></BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem><BreadcrumbPage>{view === "current" ? "Current risk" : "Hedge builder"}</BreadcrumbPage></BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Link href="/methodology" className="flex items-center gap-1.5 text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              <BookOpen className="size-3.5" aria-hidden /> How it works
            </Link>
          </div>

          {/* Shared scenario controls */}
          <Card>
            <CardContent className="grid gap-4 lg:grid-cols-3">
              <div className="flex flex-col gap-2">
                <SectionLabel>Portfolio</SectionLabel>
                <ToggleGroup type="single" value={portfolioId} onValueChange={(val) => val && setPortfolioId(val)} className="w-full">
                  {PORTFOLIO_META.map((p) => (
                    <ToggleGroupItem key={p.id} value={p.id} className="flex h-auto flex-1 flex-col gap-0.5 px-2 py-2">
                      <span className="text-xs font-semibold">{p.label}</span>
                      <span className="text-[10px] font-normal text-muted-foreground">{p.note}</span>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              <div className="flex flex-col gap-2">
                <SectionLabel>Horizon</SectionLabel>
                <ToggleGroup type="single" value={String(horizon)} onValueChange={(val) => val && setHorizon(Number(val))} className="w-full">
                  {HORIZONS.map((h) => (
                    <ToggleGroupItem key={h} value={String(h)} className="flex-1 px-2 py-1.5 text-xs">{h} days</ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <p className="text-[11px] text-muted-foreground">Outlook over the next {horizonWord(horizon)}.</p>
              </div>
              <div className="flex flex-col gap-2">
                <SectionLabel tip="Where you can trade affects which hedge is available to you.">Jurisdiction</SectionLabel>
                <ToggleGroup type="single" value={jurisdictionId} onValueChange={(val) => val && setJurisdictionId(val)} className="w-full">
                  {JURISDICTIONS.map((j) => (
                    <ToggleGroupItem key={j.id} value={j.id} className="flex-1 px-2 py-1.5 text-xs">{j.label}</ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <p className="text-[11px] text-muted-foreground">{v.jurisdictionNote}</p>
              </div>
            </CardContent>
          </Card>

          {/* Two peer views */}
          <Tabs value={view} onValueChange={setView} className="gap-4">
            <TabsList className="w-full max-w-md self-center">
              <TabsTrigger value="current" className="flex-1">Current risk</TabsTrigger>
              <TabsTrigger value="hedge" className="flex-1">Hedge builder</TabsTrigger>
            </TabsList>

            {/* ---------------- CURRENT ---------------- */}
            <TabsContent value="current" className="flex flex-col gap-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-1">
                  <CardContent className="flex flex-col gap-3">
                    <SectionLabel tip="Your 1-in-20 worst case over the horizon — a loss you'd see about 5% of the time.">
                      Risk as it stands
                    </SectionLabel>
                    <div className="flex justify-center"><RiskGauge varPct={v.current.varPct} varUsd={v.current.varUsd} /></div>
                    <Separator />
                    <HeroRow p5={v.current.p5Pct} p5u={v.current.p5Usd} p50={v.current.p50Pct} p50u={v.current.p50Usd}
                      p95={v.current.p95Pct} p95u={v.current.p95Usd} prefix="cur-" />
                  </CardContent>
                </Card>
                <Card className="lg:col-span-2">
                  <CardContent className="flex h-full flex-col gap-2">
                    <SectionLabel tip="Each band is a range of simulated outcomes; the spread is your uncertainty.">
                      Outcome fan · {horizon}-day horizon
                    </SectionLabel>
                    <MonteCarloArea cone={v.current.cone} horizon={horizon} equity={v.equity} />
                    <p className="text-center text-[11px] text-muted-foreground">
                      {v.equity > 0 && <>~{Math.round(v.btcVarShare * 100)}% of this spread is driven by BTC (top driver: {v.topDriver}).</>}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardContent className="flex flex-col gap-3">
                    <SectionLabel>Current allocation</SectionLabel>
                    <PortfolioDonut slices={v.currentPie} centerTop={`$${fmtUsd(v.equity)}`} centerBottom="exposure" />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col justify-center gap-2">
                    <SectionLabel>Why this number</SectionLabel>
                    <p className="text-sm leading-relaxed">
                      You hold {v.currentPie.length} assets, but{" "}
                      <span className="font-semibold text-primary">~{Math.round(v.btcVarShare * 100)}% of your risk is one bet on BTC</span>{" "}
                      (top driver: {v.topDriver}). Over {horizon} days the 1-in-20 worst case is{" "}
                      <span className="font-semibold text-destructive">{fmtPct(v.current.p5Pct)}</span> (≈ ${fmtUsd(v.current.p5Usd)}),
                      with a median of <span className="font-semibold">{fmtPct(v.current.p50Pct)}</span>. Open the hedge builder to see how an
                      offsetting position lifts that downside floor.
                    </p>
                  </CardContent>
                </Card>
              </div>

              <MetricTiles snap={v.current} effBeta={v.grossLoading} grossLoading={v.grossLoading}
                fundingLabel={fundingLabel} fundingRatePct={v.fundingRatePct} carryUsd={0} carryPct={0} showCost={false} testPrefix="cur-" />
            </TabsContent>

            {/* ---------------- HEDGE ---------------- */}
            <TabsContent value="hedge" className="flex flex-col gap-4">
              <Card>
                <CardContent className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <SectionLabel tip="The share of your BTC-factor exposure you offset with the hedge.">Hedge amount</SectionLabel>
                      <span data-testid="hedge-value" className="font-mono text-sm font-bold tabular-nums text-primary">{hedgePct}%</span>
                    </div>
                    <Slider value={[hedge]} min={0} max={100} step={1} onValueChange={(val) => setHedge(val[0])}
                      aria-label="Hedge amount, percent of portfolio value" />
                    <p className="text-[11px] text-muted-foreground">Drag to model an offset. Most users sit below 100%.</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <SectionLabel>Hedge instrument</SectionLabel>
                    <ToggleGroup type="single" value={v.resolvedInstrument}
                      onValueChange={(val) => derivativesAllowed && val && setInstrument(val as Instrument)}
                      className="w-full" disabled={!derivativesAllowed}>
                      <ToggleGroupItem value="BTC" className="flex-1 px-2 py-1.5 text-xs" disabled={!derivativesAllowed}>Short BTC perp</ToggleGroupItem>
                      <ToggleGroupItem value="MSTR" className="flex-1 px-2 py-1.5 text-xs">Short MSTR proxy</ToggleGroupItem>
                    </ToggleGroup>
                    <p data-testid="resolved-instrument" className="sr-only">{v.resolvedInstrument}</p>
                    {v.proxyApprox ? (
                      <p className="flex items-start gap-1.5 text-[11px] text-chart-4">
                        <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
                        {derivativesAllowed
                          ? "MSTR is an equity proxy — approximate, with extra basis risk."
                          : `Crypto perps unavailable for ${jur.label} — using the MSTR equity proxy (approximate).`}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">Short BTC perps neutralise your BTC market factor directly.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-1">
                  <CardContent className="flex flex-col gap-3">
                    <SectionLabel>Risk after hedge</SectionLabel>
                    <div className="flex justify-center"><RiskGauge varPct={v.hedged.varPct} varUsd={v.hedged.varUsd} /></div>
                    <p data-testid="hedge-var-pct" className="sr-only">{v.hedged.varPct.toFixed(2)}</p>
                    <Separator />
                    <HeroRow p5={v.hedged.p5Pct} p5u={v.hedged.p5Usd} p50={v.hedged.p50Pct} p50u={v.hedged.p50Usd}
                      p95={v.hedged.p95Pct} p95u={v.hedged.p95Usd} prefix="hed-" />
                  </CardContent>
                </Card>
                <Card className="lg:col-span-2">
                  <CardContent className="flex h-full flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <SectionLabel>Outcome fan · hedged vs unhedged</SectionLabel>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><span className="inline-block h-1 w-3 rounded bg-primary" />median</span>
                        <span className="flex items-center gap-1"><span className="inline-block h-1 w-3 rounded bg-destructive" />worst 5%</span>
                        <span className="flex items-center gap-1"><span className="inline-block h-1 w-3 rounded border-t border-dashed border-muted-foreground" />unhedged</span>
                      </div>
                    </div>
                    <MonteCarloArea cone={v.hedged.cone} baseCone={v.current.cone} horizon={horizon} equity={v.equity} />
                    <p className="text-center text-[11px] text-muted-foreground">As the hedge rises, the coral floor lifts away from the faint unhedged band while the median barely moves.</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardContent className="flex flex-col gap-4">
                    <SectionLabel>Allocation · current vs target</SectionLabel>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] text-muted-foreground">Current</span>
                      <PortfolioDonut slices={v.currentPie} centerTop={`$${fmtUsd(v.equity)}`} centerBottom="exposure" />
                    </div>
                    <Separator />
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] text-muted-foreground">After hedge</span>
                      <PortfolioDonut slices={v.targetPie} centerTop={`${v.effectiveBeta.toFixed(2)}×`} centerBottom="net beta" />
                    </div>
                    {v.hedgeNotional > 0 && (
                      <p className="text-[11px] text-muted-foreground">Adds a short {v.resolvedInstrument} leg of ≈ ${fmtUsd(v.hedgeNotional)}; slices shown against gross exposure.</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <SectionLabel>Steps to reach this hedge</SectionLabel>
                      <span className="text-[10px] text-muted-foreground">illustrative · not advice</span>
                    </div>
                    <ActionsList actions={v.actions} />
                  </CardContent>
                </Card>
              </div>

              <MetricTiles snap={v.hedged} effBeta={v.effectiveBeta} grossLoading={v.grossLoading}
                fundingLabel={fundingLabel} fundingRatePct={v.fundingRatePct} carryUsd={v.carryUsd} carryPct={v.carryPct}
                showCost testPrefix="hed-" />
            </TabsContent>
          </Tabs>

          {/* Structural risk (Moralis shell) */}
          <Card>
            <CardContent className="flex flex-col gap-4">
              <StructuralRiskPanel risk={risk} />
            </CardContent>
          </Card>

          {/* Provenance + footer */}
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 shrink-0 text-chart-2" aria-hidden />
            Calibrated from Bybit + MSTR market data · as of {calibDate()} · simulated, not a forecast
          </p>
          <footer className="pb-2 text-center text-[11px] leading-relaxed text-muted-foreground">
            Outcomes are simulated from modelled volatility — not predictions of future prices. Veylix explains risk and does not
            recommend any position, allocation, or hedge. Educational use only.
          </footer>
        </main>
      </div>
    </TooltipProvider>
  );
}
