import { useMemo, useState } from "react";
import { Candidate, SECTOR_MAP, STATUS_MAP, fmtDate, relative, SectorKey } from "../lib/model";
import { cn } from "../utils/cn";

/* --------------------------------------------------------------- fondale */

export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#090e14]" />
      <div className="tile-grid absolute inset-0 opacity-70" />
      <div
        className="absolute -top-[22vh] -left-[10vw] h-[62vh] w-[62vw] rounded-full opacity-[0.5] blur-[90px]"
        style={{ background: "radial-gradient(circle,#e9a23b26,transparent 62%)" }}
      />
      <div
        className="absolute top-[28vh] -right-[14vw] h-[58vh] w-[46vw] rounded-full opacity-[0.45] blur-[100px]"
        style={{ background: "radial-gradient(circle,#21b3a426,transparent 65%)" }}
      />
      <div
        className="absolute bottom-[-18vh] left-[26vw] h-[52vh] w-[52vw] rounded-full opacity-40 blur-[110px]"
        style={{ background: "radial-gradient(circle,#5f8fd91f,transparent 66%)" }}
      />
      {[
        { c: "#e05a45", top: "16%", left: "78%", d: "0s", s: 26 },
        { c: "#a9bf4a", top: "62%", left: "8%", d: "1.4s", s: 18 },
        { c: "#e9a23b", top: "84%", left: "62%", d: "2.6s", s: 22 },
        { c: "#5f8fd9", top: "38%", left: "34%", d: "3.6s", s: 14 },
      ].map((t, i) => (
        <span
          key={i}
          className="absolute rounded-[3px] border"
          style={{
            top: t.top,
            left: t.left,
            width: t.s,
            height: t.s,
            borderColor: t.c + "55",
            background: t.c + "18",
            animation: `floaty ${9 + i * 2}s ease-in-out ${t.d} infinite`,
          }}
        />
      ))}
      <div className="grain absolute inset-0 opacity-[0.28] mix-blend-overlay" />
      <div className="absolute inset-x-0 top-0 h-[45vh] bg-gradient-to-b from-[#090e14] to-transparent" />
    </div>
  );
}

/* --------------------------------------------------------- bacheca a mosaico */

interface Tile {
  c: Candidate;
}

function tileStyle(c: Candidate): React.CSSProperties {
  const color = SECTOR_MAP[c.settore].color;
  const st = c.stato;
  if (st === "accettato")
    return { background: color, boxShadow: `0 0 14px ${color}88`, borderColor: "transparent" };
  if (st === "escluso")
    return { background: "transparent", borderColor: color + "33", opacity: 0.55 };
  if (st === "provino" || st === "contattato")
    return { background: color + "66", borderColor: color + "aa" };
  if (st === "valutato") return { background: color + "33", borderColor: color + "77" };
  return { background: color + "18", borderColor: color + "55" };
}

export function MosaicBoard({
  list,
  activeSectors,
  onOpen,
}: {
  list: Candidate[];
  activeSectors: SectorKey[];
  onOpen: (c: Candidate) => void;
}) {
  const [hover, setHover] = useState<Candidate | null>(null);
  const tiles = useMemo<Tile[]>(() => list.slice(0, 320).map((c) => ({ c })), [list]);

  return (
    <div className="panel relative p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[10.5px] tracking-[0.24em] text-ash uppercase">
            Bacheca · ogni tessera è una candidatura
          </div>
          <div className="mt-1 font-display text-[15px] font-bold text-bone">
            {list.length > 320 ? `ultime 320 di ${list.length}` : `${list.length} tessere del mosaico`}
          </div>
        </div>
        <div className="hidden gap-3 sm:flex">
          {[
            ["Accettato", "#e9a23b", true],
            ["Al provino", "#21b3a4", true],
            ["Da valutare", "#5f8fd9", false],
            ["Fuori rosa", "#e05a45", false],
          ].map(([l, c, fill]) => (
            <span key={String(l)} className="flex items-center gap-1.5 font-mono text-[9.5px] text-ash uppercase">
              <span
                className="h-2.5 w-2.5 rounded-[1px] border"
                style={{
                  borderColor: String(c) + "99",
                  background: fill ? String(c) + "cc" : String(c) + "22",
                }}
              />
              {l}
            </span>
          ))}
        </div>
      </div>

      {tiles.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-center font-mono text-[11px] text-ash">
          Nessuna tessera: importa il CSV del modulo per comporre il mosaico.
        </div>
      ) : (
        <div
          className="grid max-h-[292px] gap-[3px] overflow-y-auto pb-1"
          style={{ gridTemplateColumns: "repeat(auto-fill,minmax(15px,1fr))" }}
          onMouseLeave={() => setHover(null)}
        >
          {tiles.map(({ c }, i) => {
            const dim = activeSectors.length > 0 && !activeSectors.includes(c.settore);
            return (
              <button
                key={c.id}
                type="button"
                title={`${c.nome} · ${c.citta} · ${SECTOR_MAP[c.settore].label}`}
                onMouseEnter={() => setHover(c)}
                onFocus={() => setHover(c)}
                onClick={() => onOpen(c)}
                className={cn(
                  "aspect-square w-full rounded-[2px] border transition-all duration-200",
                  "hover:scale-[1.55] hover:z-10 focus:scale-[1.55] focus:z-10 focus:outline-none",
                  dim ? "opacity-15" : "animate-tilein",
                )}
                style={{
                  ...tileStyle(c),
                  animationDelay: `${Math.min(i * 7, 1400)}ms`,
                }}
              />
            );
          })}
        </div>
      )}

      <div className="mt-3 flex min-h-[46px] items-center gap-3 border-t border-white/8 pt-3">
        {hover ? (
          <>
            <span
              className="h-7 w-7 shrink-0 rounded-[2px]"
              style={{ background: SECTOR_MAP[hover.settore].color }}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-[14px] font-bold">
                {hover.nome}
                <span className="ml-2 font-mono text-[10px] font-normal text-ash">
                  {hover.citta} · {relative(hover.timestamp)}
                </span>
              </div>
              <div className="truncate text-[11.5px] text-ash/90">
                {hover.presentazione || "— nessuna presentazione —"}
              </div>
            </div>
            <span
              className="hidden shrink-0 font-mono text-[9.5px] tracking-[0.14em] uppercase sm:block"
              style={{ color: STATUS_MAP[hover.stato].tone }}
            >
              {STATUS_MAP[hover.stato].label}
            </span>
          </>
        ) : (
          <div className="font-mono text-[10.5px] tracking-[0.14em] text-ash/70 uppercase">
            passa il mouse su una tessera · clicca per aprire la scheda
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ ticker */

export function Ticker({ list }: { list: Candidate[] }) {
  const items = list.slice(0, 14);
  if (!items.length) return null;
  const doubled = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-white/8 bg-[#0b1219]/70 py-2">
      <div className="animate-ticker flex w-max gap-8 whitespace-nowrap">
        {doubled.map((c, i) => (
          <span key={c.id + i} className="flex items-center gap-2 font-mono text-[11px] text-ash">
            <span
              className="h-1.5 w-1.5 rounded-[1px]"
              style={{ background: SECTOR_MAP[c.settore].color }}
            />
            <span className="text-bone/85">{c.nome}</span>
            <span className="opacity-60">{c.citta}</span>
            <span className="opacity-40">{fmtDate(c.timestamp)}</span>
            <span className="opacity-60">{SECTOR_MAP[c.settore].short}</span>
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#090e14] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#090e14] to-transparent" />
    </div>
  );
}
