import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { SECTOR_MAP, SectorKey, STATUSES } from "../lib/model";
import { SectorStats } from "../lib/store";
import { Meter, Panel, SECTOR_ICON, SectorDot } from "./ui";
import { cn } from "../utils/cn";

export function Sparkline({ data, color, w = 92, h = 26 }: { data: number[]; color: string; w?: number; h?: number }) {
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => [(i / Math.max(1, data.length - 1)) * w, h - (v / max) * (h - 3) - 1.5]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} className="overflow-visible" aria-hidden>
      <path d={area} fill={color} opacity={0.14} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2} fill={color} />
    </svg>
  );
}

export function SectorMatrix({
  stats,
  selected,
  onToggle,
}: {
  stats: SectorStats[];
  selected: SectorKey[];
  onToggle: (k: SectorKey) => void;
}) {
  const [open, setOpen] = useState<SectorKey | null>(stats[0]?.key ?? null);
  const max = Math.max(1, ...stats.map((s) => s.totale));

  return (
    <div className="flex flex-col">
      {stats.map((s) => {
        const meta = SECTOR_MAP[s.key];
        const Icon = SECTOR_ICON[s.key];
        const isOpen = open === s.key;
        const isSel = selected.includes(s.key);
        return (
          <Panel key={s.key} hover={false} className="mb-px border-x-0 border-t-0 transition-colors duration-300">
            <div
              className="group grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-4 sm:px-5"
              style={{
                borderLeft: `2px solid ${isSel ? meta.color : "transparent"}`,
                background: isSel ? meta.color + "0f" : "transparent",
                transition: "background .3s",
              }}
              onClick={() => onToggle(s.key)}
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[3px] border transition-transform duration-300 group-hover:scale-105"
                style={{ borderColor: meta.color + "44", background: meta.color + "14", color: meta.color }}
              >
                <Icon size={19} />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display text-[19px] leading-none font-extrabold tracking-tight text-bone">
                    {meta.label}
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.14em] text-ash uppercase">
                    {meta.blurb}
                  </span>
                  {s.nuovi7 > 0 && (
                    <span
                      className="animate-breathe h-1.5 w-1.5 rounded-full"
                      style={{ background: meta.color }}
                      title={`${s.nuovi7} nuove negli ultimi 7 giorni`}
                    />
                  )}
                </div>
                <div className="mt-2.5 flex items-center gap-3">
                  <div className="max-w-[420px] flex-1">
                    <Meter value={(s.totale / max) * 100} color={meta.color} h={7} />
                  </div>
                  <span className="font-mono text-[10px] text-ash">{s.nuovi7} in 7gg</span>
                  <div className="hidden md:block">
                    <Sparkline data={s.serie} color={meta.color} />
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-4 sm:gap-6">
                <div className="text-right">
                  <div
                    className="font-display text-[26px] leading-none font-extrabold tabular-nums"
                    style={{ color: meta.color }}
                  >
                    {s.totale}
                  </div>
                  <div className="font-mono text-[9.5px] tracking-[0.14em] text-ash uppercase">tessere</div>
                </div>
                <div className="hidden text-right sm:block">
                  <div className="font-display text-[20px] leading-none font-bold tabular-nums text-bone">
                    {s.tasso}%
                  </div>
                  <div className="font-mono text-[9.5px] tracking-[0.14em] text-ash uppercase">accolte</div>
                </div>
                <button
                  type="button"
                  aria-label="Dettaglio settore"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(isOpen ? null : s.key);
                  }}
                  className="focus-ring rounded-[2px] border border-white/10 p-1.5 text-ash transition-colors hover:border-white/25 hover:text-bone"
                >
                  <ChevronDown size={15} className={cn("transition-transform duration-300", isOpen && "rotate-180")} />
                </button>
              </div>
            </div>

            <div
              className="grid transition-[grid-template-rows] duration-400 ease-out"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <div className="grid gap-5 border-t border-white/8 px-4 py-5 sm:px-5 md:grid-cols-[1.4fr_1fr_1fr]">
                  <div>
                    <div className="mb-2.5 font-mono text-[10px] tracking-[0.2em] text-ash uppercase">
                      avanzamento nel processo
                    </div>
                    <div className="flex h-4 w-full overflow-hidden rounded-[2px]">
                      {STATUSES.map((st) => {
                        const n = s.funnel[st.key];
                        if (!n) return null;
                        return (
                          <div
                            key={st.key}
                            title={`${st.label}: ${n}`}
                            className="h-full transition-all duration-500 hover:brightness-125"
                            style={{ width: `${(n / Math.max(1, s.totale)) * 100}%`, background: st.tone }}
                          />
                        );
                      })}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-1.5 sm:grid-cols-3">
                      {STATUSES.map((st) => (
                        <div key={st.key} className="flex items-center gap-2 text-[11.5px]">
                          <span className="h-2 w-2 rounded-[1px]" style={{ background: st.tone }} />
                          <span className="text-ash">{st.label}</span>
                          <span className="ml-auto font-mono text-bone/90">{s.funnel[st.key]}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2.5 font-mono text-[10px] tracking-[0.2em] text-ash uppercase">
                      qualità percepita
                    </div>
                    {[
                      ["Tasso di contatto", s.contattoTasso, `${s.contattoTasso}%`],
                      ["Tasso di accettazione", s.tasso, `${s.tasso}%`],
                      ["Copertura del filtro", Math.round((s.totale / Math.max(1, stats.reduce((a, b) => a + b.totale, 0))) * 100), `${s.totale} su ${stats.reduce((a, b) => a + b.totale, 0)}`],
                    ].map(([l, v, txt]) => (
                      <div key={String(l)} className="mb-3">
                        <div className="mb-1 flex justify-between text-[11.5px]">
                          <span className="text-ash">{l}</span>
                          <span className="font-mono text-bone">{txt}</span>
                        </div>
                        <Meter value={Number(v)} color={meta.color} h={4} />
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="mb-2.5 font-mono text-[10px] tracking-[0.2em] text-ash uppercase">
                      scheda del settore
                    </div>
                    <dl className="space-y-1.5 text-[12px]">
                      {[
                        ["Voto medio commissione", s.votoMedio ? `${s.votoMedio} / 5` : "non ancora espresso"],
                        ["In attesa di una risposta", s.inAttesa],
                        ["Fuori rosa", s.esclusi],
                        ["Città diverse raggiunte", s.cittaUniche],
                        ["Tendenza 12 settimane", `${s.serie.slice(6).reduce((a, b) => a + b, 0)} vs ${s.serie.slice(0, 6).reduce((a, b) => a + b, 0)} (ultime/precedenti)`],
                      ].map(([k, v]) => (
                        <div key={String(k)} className="flex items-baseline justify-between gap-3 border-b border-white/6 pb-1">
                          <dt className="text-ash">{k}</dt>
                          <dd className="text-right font-mono text-bone">{String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-3 flex items-center gap-1.5 font-mono text-[10px] text-ash">
                      <SectorDot k={s.key} size={7} />
                      premi la riga per filtrare il registro
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
