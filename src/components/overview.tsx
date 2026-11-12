import { useMemo, useState } from "react";
import { ArrowDown, Info } from "lucide-react";
import { Candidate, SECTORS, SECTOR_MAP, STATUSES, SectorKey, fmtDate, pct } from "../lib/model";
import { SectorStats, cityRanking, globalStats } from "../lib/store";
import { Donut, HBars, HealthRadar, TrendLines } from "./charts";
import { Meter, Panel, Stat } from "./ui";
import { cn } from "../utils/cn";

function CardHead({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 pt-4 sm:px-5">
      <div>
        <h3 className="font-display text-[15.5px] leading-tight font-bold tracking-tight text-bone">
          {title}
        </h3>
        {hint && <p className="mt-0.5 text-[11.5px] text-ash">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

export function OverviewGrid({
  list,
  stats,
  selected,
  onToggle,
}: {
  list: Candidate[];
  stats: SectorStats[];
  selected: SectorKey[];
  onToggle: (k: SectorKey) => void;
}) {
  const g = useMemo(() => globalStats(list), [list]);
  const [mode, setMode] = useState<"settore" | "totale">("settore");

  const byKey = Object.fromEntries(stats.map((s) => [s.key, s])) as Record<SectorKey, SectorStats>;
  const ordered = SECTORS.slice().sort((a, b) => (byKey[b.key]?.totale ?? 0) - (byKey[a.key]?.totale ?? 0));
  const total = Math.max(1, list.length);

  const cities = useMemo(() => cityRanking(list, 7), [list]);

  const radar = useMemo(() => {
    const maxVol = Math.max(1, ...stats.map((s) => s.totale));
    const maxCity = Math.max(1, ...stats.map((s) => s.cittaUniche));
    return stats
      .filter((s) => s.totale > 0)
      .map((s) => ({
        label: SECTOR_MAP[s.key].label,
        color: SECTOR_MAP[s.key].color,
        data: [
          Math.round((s.totale / maxVol) * 100),
          s.contattoTasso,
          Math.min(100, Math.round(s.tasso * 2.4)),
          Math.round((s.cittaUniche / maxCity) * 100),
          Math.round((s.votoMedio / 5) * 100),
          Math.round(100 - (s.inAttesa / Math.max(1, s.totale)) * 100),
        ],
      }));
  }, [stats]);

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* ripartizione */}
      <Panel className="lg:col-span-5">
        <CardHead
          title="Ripartizione per settore"
          hint="Quante tessere sta prendendo ogni linguaggio"
          right={
            <span className="flex items-center gap-1 font-mono text-[10px] text-ash">
              <Info size={12} /> clic su una fetta
            </span>
          }
        />
        <div className="flex items-center gap-4 p-4 sm:p-5">
          <div className="relative h-[188px] w-[188px] shrink-0">
            <Donut
              labels={SECTORS.map((s) => s.label)}
              data={SECTORS.map((s) => byKey[s.key]?.totale ?? 0)}
              colors={SECTORS.map((s) => s.color)}
              active={SECTORS.map((s) => selected.includes(s.key))}
              onSelect={(i) => onToggle(SECTORS[i].key)}
            />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-[30px] leading-none font-extrabold tabular-nums text-bone">
                {list.length}
              </span>
              <span className="font-mono text-[9.5px] tracking-[0.18em] text-ash uppercase">candidature</span>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-2.5">
            {ordered.map((s) => {
              const st = byKey[s.key];
              const on = selected.includes(s.key);
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => onToggle(s.key)}
                    className={cn(
                      "focus-ring group w-full rounded-[2px] border-l-2 py-1 pl-2.5 text-left transition-all duration-200",
                      on ? "bg-white/6" : "border-transparent hover:bg-white/4",
                    )}
                    style={{ borderColor: on ? s.color : "transparent" }}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[12.5px] text-bone/90 group-hover:text-bone">
                        {s.short}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-ash">
                        <span className="text-bone">{st?.totale ?? 0}</span> · {pct(st?.totale ?? 0, total)}%
                      </span>
                    </div>
                    <div className="mt-1">
                      <Meter value={pct(st?.totale ?? 0, total) * 2.2} color={s.color} h={3} />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </Panel>

      {/* andamento */}
      <Panel className="lg:col-span-7">
        <CardHead
          title="Affluenza al modulo"
          hint={`nuove risposte per settimana · ${g.labelSerie[0]} → ${g.labelSerie[g.labelSerie.length - 1]}`}
          right={
            <div className="flex gap-1 rounded-[2px] border border-white/10 p-0.5">
              {(["settore", "totale"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "focus-ring px-2 py-1 font-mono text-[9.5px] tracking-[0.14em] uppercase transition-colors",
                    mode === m ? "bg-bone text-ink-950" : "text-ash hover:text-bone",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          }
        />
        <div className="h-[232px] px-3 pt-3 pb-2">
          <TrendLines
            labels={g.labelSerie}
            series={
              mode === "settore"
                ? SECTORS.map((s) => ({
                    label: s.short,
                    color: s.color,
                    data: byKey[s.key]?.serie ?? new Array(12).fill(0),
                  }))
                : [{ label: "Totale", color: "#e9a23b", data: g.serie }]
            }
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/8 px-4 py-2.5 sm:px-5">
          {SECTORS.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 font-mono text-[9.5px] text-ash uppercase">
              <span className="h-1.5 w-4 rounded-[1px]" style={{ background: s.color }} />
              {s.short}
            </span>
          ))}
          <span className="ml-auto font-mono text-[10px] text-ash">
            picco {Math.max(...(mode === "settore" ? stats.flatMap((x) => x.serie) : g.serie), 0)}/sett
          </span>
        </div>
      </Panel>

      {/* funnel */}
      <Panel className="lg:col-span-5">
        <CardHead title="Avanzamento delle candidature" hint="Dal modulo alla rosa definitiva" />
        <div className="space-y-3 p-4 sm:p-5">
          {g.funnel.map((step, i) => {
            const def = STATUSES.find((s) => s.key === step.key)!;
            const prev = i > 0 ? g.funnel[i - 1].n : step.n;
            const keep = prev ? Math.round((step.n / prev) * 100) : 0;
            return (
              <div key={step.key} className="group">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] text-bone/90">{def.label}</span>
                  <span className="flex items-center gap-2 font-mono text-[10.5px] text-ash tabular-nums">
                    {i > 0 && (
                      <span className={cn(keep >= 60 ? "text-ok" : keep > 25 ? "text-warn" : "text-performer")}>
                        {keep}%
                      </span>
                    )}
                    <span className="text-bone">{step.n}</span>
                  </span>
                </div>
                <Meter
                  value={pct(step.n, Math.max(1, g.totale))}
                  color={def.tone}
                  h={i === g.funnel.length - 1 ? 10 : 6}
                />
              </div>
            );
          })}
          <div className="flex items-center gap-2 border-t border-white/8 pt-3 text-[11.5px] text-ash">
            <ArrowDown size={13} className="text-performer" />
            {list.filter((c) => c.stato === "escluso").length} candidature chiuse fuori rosa
          </div>
        </div>
      </Panel>

      {/* città */}
      <Panel className="lg:col-span-4">
        <CardHead title="Geografia" hint={`${g.citta} città raggiunte`} />
        <div className="h-[244px] px-2 pt-3 pb-2">
          <HBars
            labels={cities.map((c) => c.citta)}
            values={cities.map((c) => c.n)}
            colors={cities.map((_, i) => SECTORS[i % SECTORS.length].color)}
          />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-white/8 px-4 py-2.5">
          {cities.slice(0, 3).map((c) => (
            <span key={c.citta} className="font-mono text-[10px] text-ash">
              {c.citta} <span className="text-bone">{c.n}</span>
              {c.acc > 0 && <span className="text-ok"> ·{c.acc}✓</span>}
            </span>
          ))}
        </div>
      </Panel>

      {/* radar */}
      <Panel className="lg:col-span-3">
        <CardHead title="Salute settori" hint="Indice composito 0-100" />
        <div className="h-[244px] px-1 pt-2">
          <HealthRadar
            labels={["Volume", "Contatti", "Accoglienza", "Territori", "Qualità", "Smaltite"]}
            series={radar}
          />
        </div>
      </Panel>

      {/* kpi a tutta larghezza */}
      <Panel className="lg:col-span-12" hover={false}>
        <div className="grid grid-cols-2 gap-5 p-4 sm:grid-cols-3 sm:p-5 lg:grid-cols-6">
          <Stat label="Candidature totali" value={g.totale} sub={`${g.nuovi7} negli ultimi 7 giorni`} accent="#ece5d8" />
          <Stat label="Accettate in rosa" value={g.accettati} suffix="" sub={`${g.tassoAccettazione}% del totale`} accent="#63c07f" />
          <Stat label="Ai provini" value={g.provini} sub="convocate per l'ascolto" accent="#21b3a4" />
          <Stat label="Da valutare" value={g.inAttesa} sub="ancora senza esito" accent="#e9a23b" />
          <Stat
            label="Voto medio"
            decimals={2}
            value={list.length ? list.reduce((a, c) => a + c.voto, 0) / Math.max(1, list.filter((c) => c.voto > 0).length) : 0}
            suffix="/5"
            sub="media delle valutazioni espresse"
            accent="#5f8fd9"
          />
          <Stat label="Giorni medi in coda" value={g.etaMediaGiorni} sub={`ultimo aggiornamento ${fmtDate(new Date().toISOString())}`} accent="#a9bf4a" />
        </div>
      </Panel>
    </div>
  );
}
