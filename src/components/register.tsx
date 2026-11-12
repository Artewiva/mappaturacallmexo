import { useEffect, useState } from "react";
import { Download, ExternalLink, Mail, MapPin, Phone, Search, Trash2, X, ChevronDown } from "lucide-react";
import {
  Candidate,
  SECTORS,
  SECTOR_MAP,
  STATUSES,
  SectorKey,
  StatusKey,
  fmtDate,
  relative,
} from "../lib/model";
import { toCsv, download } from "../lib/data";
import { Chip, Meter, Panel, SECTOR_ICON, Stars, StatusPill } from "./ui";
import { cn } from "../utils/cn";

/* ------------------------------------------------------------------ drawer */

export function CandidateSheet({
  c,
  onClose,
  onPatch,
  onRemove,
}: {
  c: Candidate | null;
  onClose: () => void;
  onPatch: (patch: Partial<Candidate> & { id: string }) => void;
  onRemove: (id: string) => void;
}) {
  const [note, setNote] = useState(c?.note ?? "");
  useEffect(() => setNote(c?.note ?? ""), [c?.id, c?.note]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (c) window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [c, onClose]);

  if (!c) return null;
  const meta = SECTOR_MAP[c.settore];
  const Icon = SECTOR_ICON[c.settore];
  const step = STATUSES.findIndex((s) => s.key === c.stato);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Chiudi"
        onClick={onClose}
        className="absolute inset-0 bg-ink-950/70 backdrop-blur-[3px] transition-opacity"
      />
      <aside
        className="relative flex h-full w-full max-w-[430px] flex-col border-l border-white/12 bg-[#0c141d] shadow-[-30px_0_80px_rgba(0,0,0,0.6)]"
        style={{ animation: "slidein .34s cubic-bezier(.2,.9,.3,1) both" }}
      >
        <div className="h-1 w-full" style={{ background: meta.color }} />
        <header className="flex items-start gap-3 border-b border-white/8 p-5">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[3px] border"
            style={{ borderColor: meta.color + "55", background: meta.color + "18", color: meta.color }}
          >
            <Icon size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: meta.color }}>
              {meta.label}
            </div>
            <h3 className="font-display truncate text-[22px] leading-tight font-extrabold tracking-tight text-bone">
              {c.nome}
            </h3>
            <div className="mt-1 flex items-center gap-2 font-mono text-[10.5px] text-ash">
              <MapPin size={11} /> {c.citta}
              <span className="opacity-40">·</span>
              {fmtDate(c.timestamp, true)}
              <span className="opacity-40">·</span>
              {relative(c.timestamp)}
            </div>
          </div>
          <button
            onClick={onClose}
            className="focus-ring rounded-[2px] border border-white/12 p-1.5 text-ash transition-colors hover:border-white/30 hover:text-bone"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <section>
            <div className="mb-2 font-mono text-[10px] tracking-[0.2em] text-ash uppercase">contatti</div>
            <div className="space-y-1.5">
              {c.mail ? (
                <a
                  href={`mailto:${c.mail}`}
                  className="hover:bg-white/6 flex items-center gap-2 border border-white/8 px-3 py-2 text-[12.5px] text-bone/90 transition-colors hover:border-white/20"
                >
                  <Mail size={13} className="text-ash" /> {c.mail}
                  <ExternalLink size={12} className="ml-auto text-ash" />
                </a>
              ) : null}
              {c.telefono ? (
                <a
                  href={`tel:${c.telefono.replace(/\s/g, "")}`}
                  className="hover:bg-white/6 flex items-center gap-2 border border-white/8 px-3 py-2 text-[12.5px] text-bone/90 transition-colors hover:border-white/20"
                >
                  <Phone size={13} className="text-ash" /> {c.telefono}
                </a>
              ) : null}
            </div>
          </section>

          <section>
            <div className="mb-2 font-mono text-[10px] tracking-[0.2em] text-ash uppercase">
              raccontaci chi sei
            </div>
            <p className="border-l-2 pl-3 text-[13.5px] leading-relaxed text-bone/85" style={{ borderColor: meta.color }}>
              {c.presentazione || "Il candidato non ha scritto nulla nel campo aperto."}
            </p>
          </section>

          <section>
            <div className="mb-2.5 font-mono text-[10px] tracking-[0.2em] text-ash uppercase">
              stato nel processo
            </div>
            <div className="mb-3 flex h-1.5 gap-1">
              {STATUSES.filter((s) => s.key !== "escluso").map((s, i) => (
                <span
                  key={s.key}
                  className="h-full flex-1 rounded-[1px] transition-colors duration-500"
                  style={{ background: i <= step && c.stato !== "escluso" ? s.tone : "rgba(255,255,255,0.09)" }}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {STATUSES.map((s) => {
                const on = s.key === c.stato;
                return (
                  <button
                    key={s.key}
                    onClick={() => onPatch({ id: c.id, stato: s.key })}
                    className={cn(
                      "focus-ring flex items-center gap-2 border px-2.5 py-2 text-left text-[12px] transition-all duration-200 active:scale-[0.98]",
                      on ? "bg-white/8" : "border-white/8 text-ash hover:border-white/20 hover:text-bone",
                    )}
                    style={on ? { borderColor: s.tone, color: s.tone } : undefined}
                  >
                    <span className="h-2 w-2 rounded-[1px]" style={{ background: s.tone }} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <div className="mb-2 font-mono text-[10px] tracking-[0.2em] text-ash uppercase">
              valutazione commissione
            </div>
            <div className="flex items-center gap-4 border border-white/8 px-3 py-3">
              <Stars value={c.voto} onSet={(v) => onPatch({ id: c.id, voto: v })} size={19} />
              <span className="font-mono text-[11px] text-ash">{c.voto}/5</span>
              <div className="ml-auto w-20">
                <Meter value={(c.voto / 5) * 100} color={meta.color} h={4} />
              </div>
            </div>
          </section>

          <section>
            <div className="mb-2 font-mono text-[10px] tracking-[0.2em] text-ash uppercase">note interne</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => note !== c.note && onPatch({ id: c.id, note })}
              placeholder="Aggiungi un promemoria per la segreteria…"
              className="focus-ring h-24 w-full resize-none border border-white/8 bg-ink-900/60 p-3 text-[13px] text-bone placeholder:text-ash/50 focus:border-white/22"
            />
          </section>

          <section>
            <div className="mb-2 font-mono text-[10px] tracking-[0.2em] text-ash uppercase">
              provenienza del dato
            </div>
            <div className="flex items-center gap-2 border border-white/8 px-3 py-2 font-mono text-[11px] text-ash">
              <span className="h-1.5 w-1.5 rounded-full bg-musicista" />
              {c.fonte === "demo"
                ? "dati dimostrativi generati localmente"
                : c.fonte === "foglio"
                  ? "sincronizzato dal foglio Google collegato"
                  : c.fonte === "csv"
                    ? "import CSV (esportazione dal modulo)"
                    : "inserimento manuale in segreteria"}
            </div>
          </section>
        </div>

        <footer className="flex items-center gap-2 border-t border-white/8 p-4">
          <button
            onClick={() => {
              if (confirm(`Eliminare ${c.nome} dal registro?`)) {
                onRemove(c.id);
                onClose();
              }
            }}
            className="focus-ring flex items-center gap-2 border border-performer/40 px-3 py-2 text-[12px] text-performer transition-colors hover:bg-performer/12"
          >
            <Trash2 size={14} /> Scarta
          </button>
          <span className="ml-auto font-mono text-[10px] text-ash">id {c.id.slice(0, 8)}</span>
        </footer>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ registro */

export function Register({
  list,
  all,
  query,
  setQuery,
  sectors,
  toggleSector,
  statuses,
  toggleStatus,
  sort,
  setSort,
  onPatch,
  onOpen,
}: {
  list: Candidate[];
  all: Candidate[];
  query: string;
  setQuery: (v: string) => void;
  sectors: SectorKey[];
  toggleSector: (k: SectorKey) => void;
  statuses: StatusKey[];
  toggleStatus: (k: StatusKey) => void;
  sort: "recenti" | "anziani" | "voto" | "nome";
  setSort: (v: "recenti" | "anziani" | "voto" | "nome") => void;
  onPatch: (patch: Partial<Candidate> & { id: string }) => void;
  onOpen: (c: Candidate) => void;
}) {
  const [limit, setLimit] = useState(28);
  const shown = list.slice(0, limit);
  const resetFilters = () => {
    setQuery("");
    SECTORS.forEach((s) => sectors.includes(s.key) && toggleSector(s.key));
    STATUSES.forEach((s) => statuses.includes(s.key) && toggleStatus(s.key));
  };

  return (
    <Panel hover={false}>
      <div className="flex flex-col gap-3 border-b border-white/8 p-4 lg:flex-row lg:items-center sm:p-5">
        <label className="group relative flex min-w-0 flex-1 items-center">
          <Search size={14} className="absolute left-3 text-ash transition-colors group-focus-within:text-musicista" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(28);
            }}
            placeholder="Cerca nome, città, mail, testo della candidatura…"
            className="focus-ring w-full border border-white/10 bg-ink-900/70 py-2.5 pr-3 pl-9 text-[13px] text-bone placeholder:text-ash/60 transition-colors focus:border-white/25"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {SECTORS.map((s) => (
            <Chip key={s.key} active={sectors.includes(s.key)} color={s.color} onClick={() => toggleSector(s.key)}>
              {s.short}
            </Chip>
          ))}
          <span className="mx-1 hidden h-4 w-px bg-white/12 sm:block" />
          {STATUSES.filter((s) => s.step !== -1).map((s) => (
            <Chip key={s.key} active={statuses.includes(s.key)} color={s.tone} onClick={() => toggleStatus(s.key)}>
              {s.label}
            </Chip>
          ))}
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as never)}
              className="focus-ring appearance-none border border-white/10 bg-ink-900/70 py-2 pr-7 pl-2.5 font-mono text-[10.5px] tracking-[0.1em] text-bone uppercase"
            >
              <option value="recenti">ordinate: recenti</option>
              <option value="anziani">ordinate: meno recenti</option>
              <option value="voto">ordinate: voto</option>
              <option value="nome">ordinate: nome</option>
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-ash" />
          </div>
          <button
            onClick={() => download(`mosaic-candidature-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(list.length ? list : all))}
            className="focus-ring flex items-center gap-1.5 border border-white/10 px-2.5 py-2 font-mono text-[10.5px] tracking-[0.1em] text-ash uppercase transition-colors hover:border-white/25 hover:text-bone"
            title="Esporta le candidature visibili in CSV"
          >
            <Download size={13} /> csv
          </button>
        </div>
      </div>

      <div className="hidden grid-cols-[92px_minmax(160px,1.5fr)_120px_minmax(130px,1fr)_150px_120px_28px] gap-3 border-b border-white/8 px-4 py-2.5 font-mono text-[9.5px] tracking-[0.16em] text-ash uppercase lg:grid">
        <span>data</span>
        <span>nome · contatto</span>
        <span>città</span>
        <span>settore</span>
        <span>stato</span>
        <span>voto</span>
        <span />
      </div>

      <div>
        {shown.map((c, i) => {
          const meta = SECTOR_MAP[c.settore];
          return (
            <div
              key={c.id}
              onClick={() => onOpen(c)}
              className={cn(
                "group grid cursor-pointer grid-cols-[1fr_auto] items-center gap-3 border-b border-white/5 px-4 py-3 transition-colors duration-200 hover:bg-white/4 lg:grid-cols-[92px_minmax(160px,1.5fr)_120px_minmax(130px,1fr)_150px_120px_28px]",
                i % 2 ? "bg-white/[0.012]" : "",
              )}
              style={{ animation: `rowin .4s cubic-bezier(.2,.8,.2,1) ${Math.min(i, 16) * 22}ms both` }}
            >
              <span className="hidden font-mono text-[11px] text-ash lg:block">{fmtDate(c.timestamp)}</span>
              <span className="min-w-0">
                <span className="block truncate font-display text-[14.5px] font-semibold text-bone group-hover:text-musicista">
                  {c.nome}
                </span>
                <span className="mt-1 flex items-center gap-2 lg:hidden">
                  <span className="truncate font-mono text-[10.5px] text-ash">
                    {c.citta} · {meta.short}
                  </span>
                  <StatusPill s={c.stato} />
                  <Stars value={c.voto} size={11} />
                </span>
                <span className="hidden truncate font-mono text-[10.5px] text-ash lg:block">{c.mail}</span>
              </span>
              <span className="hidden text-[12px] text-bone/80 lg:block">{c.citta}</span>
              <span className="hidden items-center gap-2 lg:flex">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[1px]" style={{ background: meta.color }} />
                <span className="truncate font-mono text-[10.5px] tracking-[0.1em] text-ash uppercase">
                  {meta.short}
                </span>
              </span>
              <span className="hidden lg:block">
                <StatusPill s={c.stato} />
              </span>
              <span className="hidden lg:block" onClick={(e) => e.stopPropagation()}>
                <Stars value={c.voto} onSet={(v) => onPatch({ id: c.id, voto: v })} />
              </span>
              <ChevronDown size={15} className="-rotate-90 text-ash opacity-0 transition-opacity group-hover:opacity-100 lg:opacity-40" />
            </div>
          );
        })}
        {!shown.length && (
          <div className="px-4 py-12 text-center">
            <div className="font-display text-[17px] font-bold text-bone">Nessuna tessera corrisponde</div>
            <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-ash">
              Prova a togliere i filtri attivi o ad ampliare la ricerca: al momento {sectors.length} settori e{" "}
              {statuses.length} stati sono selezionati.
            </p>
            <button
              className="focus-ring mt-4 border border-white/12 px-3 py-1.5 font-mono text-[10.5px] tracking-[0.14em] text-bone uppercase hover:border-musicista/60"
              onClick={resetFilters}
            >
              azzera filtri
            </button>
          </div>
        )}
      </div>

      {list.length > shown.length && (
        <div className="flex items-center justify-center gap-3 p-4">
          <button
            onClick={() => setLimit((l) => l + 28)}
            className="focus-ring border border-white/12 px-4 py-2 font-mono text-[10.5px] tracking-[0.16em] text-bone uppercase transition-colors hover:border-musicista/60 hover:bg-musicista/10"
          >
            mostra altre {Math.min(28, list.length - shown.length)} di {list.length}
          </button>
        </div>
      )}
      {!!list.length && (
        <div className="flex items-center justify-between border-t border-white/8 px-4 py-2.5 font-mono text-[10px] text-ash">
          <span>
            {list.length} righe su {all.length} candidature · {sectors.length ? "filtro settore attivo" : "tutti i settori"}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-ok" /> salvato in locale
          </span>
        </div>
      )}
    </Panel>
  );
}
