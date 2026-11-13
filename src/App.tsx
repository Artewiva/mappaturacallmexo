import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  FileText,
  RefreshCw,
  ExternalLink,
  Link2,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  Zap,
  CircleCheck,
} from "lucide-react";
import {
  Candidate,
  FORM_ID,
  FORM_TITLE,
  SECTORS,
  SectorKey,
  StatusKey,
  fmtDate,
} from "./lib/model";
import { download, fetchSheet, toCsv } from "./lib/data";
import { filterCandidates, globalStats, sectorStats, useStore } from "./lib/store";
import { Backdrop, MosaicBoard, Ticker } from "./components/mosaic";
import { SectorMatrix } from "./components/sectors";
import { OverviewGrid } from "./components/overview";
import { CandidateSheet, Register } from "./components/register";
import { ImportPanel } from "./components/importer";
import { PdfExportModal } from "./components/pdf-exporter";
import { ArrowLink, Button, Panel, Reveal, SectionHead, SectorLegend, Stat } from "./components/ui";
import { MexoHeroVinyl, MexoLogo } from "./components/mexo-logo";
import { cn } from "./utils/cn";

const STEPS = [
  {
    n: "01",
    tag: "esportazione",
    t: "CSV dritto dal modulo",
    d: "Nel form apri Risposte e scarica il .csv: il cruscotto riconosce da sé timestamp, nome, mail, telefono, città, categoria e testo libero, anche con intestazioni leggermente diverse.",
  },
  {
    n: "02",
    tag: "foglio live",
    t: "Pubblica il foglio collegato",
    d: "Se le risposte confluiscono in un Google Foglio, pubblicalo sul web come valori separati da virgola e incolla l'URL: «Sincronizza» o la modalità auto rileggeranno l'intero archivio.",
  },
  {
    n: "03",
    tag: "privacy e stampa",
    t: "Dossier PDF e dati in locale",
    d: "Stati, voti e note della segreteria vivono in localStorage su questa macchina. L'esportazione CSV e l'impaginazione PDF avvengono interamente nel browser.",
  },
];

export function App() {
  const store = useStore();
  const list = store.candidates;

  const [sectors, setSectors] = useState<SectorKey[]>([]);
  const [statuses, setStatuses] = useState<StatusKey[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recenti" | "anziani" | "voto" | "nome">("recenti");
  const [openC, setOpenC] = useState<Candidate | null>(null);
  const [modal, setModal] = useState<null | "csv" | "foglio" | "manuale">(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3400);
  }, []);

  const stats = useMemo(() => sectorStats(list), [list]);
  const g = useMemo(() => globalStats(list), [list]);
  const filtered = useMemo(
    () => filterCandidates(list, { query, sectors, statuses, sort }),
    [list, query, sectors, statuses, sort],
  );

  const toggleSector = (k: SectorKey) =>
    setSectors((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const toggleStatus = (k: StatusKey) =>
    setStatuses((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const sync = useCallback(async () => {
    if (!store.sheetUrl.trim()) {
      setModal("foglio");
      return 0;
    }
    setSyncing(true);
    try {
      const next = await fetchSheet(store.sheetUrl);
      store.addMany(next);
      setLastSync(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
      flash(`Sincronizzate ${next.length} risposte dal foglio collegato.`);
      return next.length;
    } catch (e) {
      flash(`Sincronizzazione non riuscita: ${(e as Error).message}`);
      return 0;
    } finally {
      setSyncing(false);
    }
  }, [store, flash]);

  useEffect(() => {
    if (!auto || !store.sheetUrl.trim()) return;
    const t = setInterval(() => void sync(), 120_000);
    return () => clearInterval(t);
  }, [auto, store.sheetUrl, sync]);

  // la scheda aperta segue le modifiche allo store
  const current = openC ? (list.find((c) => c.id === openC.id) ?? openC) : null;

  return (
    <div className="relative min-h-screen">
      <Backdrop />

      {/* ------------------------------------------------------------ header */}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#090e14]/88 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 sm:px-6">
          <a href="#" className="flex items-center gap-3 rounded-[2px] focus-ring">
            <MexoLogo variant="dark" size="md" className="h-10 sm:h-[42px]" />
            <div className="hidden items-center gap-2 border-l border-white/10 pl-3 sm:flex">
              <div className="flex gap-[3px]">
                {SECTORS.map((s, i) => (
                  <span
                    key={s.key}
                    className="h-2.5 w-2.5 rounded-[1px] sm:h-3 sm:w-3 sm:rounded-[2px]"
                    style={{
                      background: s.color,
                      opacity: sectors.length && !sectors.includes(s.key) ? 0.25 : 1,
                      animation: `tilein .5s ease-out ${i * 90}ms both`,
                    }}
                  />
                ))}
              </div>
              <div className="hidden lg:block">
                <div className="font-mono text-[9px] tracking-[0.2em] text-ash uppercase">
                  monitoraggio candidature
                </div>
                <div className="font-mono text-[9px] tracking-[0.14em] text-ash/60">Mosaic Exhibition Orchestra</div>
              </div>
            </div>
          </a>

          <div className="hidden items-center gap-2 border-l border-white/10 pl-5 lg:flex">
            <span
              className={cn("h-1.5 w-1.5 rounded-full", list.length ? "bg-ok animate-breathe" : "bg-warn")}
            />
            <span className="font-mono text-[10.5px] text-ash">
              {FORM_TITLE} · <span className="text-bone/70">{FORM_ID.slice(0, 18)}…</span>
            </span>
            {store.demo && (
              <span className="border border-warn/40 bg-warn/10 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.12em] text-warn uppercase">
                dati dimostrativi
              </span>
            )}
            <span className="font-mono text-[9.5px] text-ash/60">
              · salvato {fmtDate(store.savedAt, true)}
            </span>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              onClick={() => setAuto((a) => !a)}
              title="Sincronizzazione automatica ogni 2 minuti dal foglio collegato"
              className={cn(
                "focus-ring hidden items-center gap-1.5 border px-2.5 py-2 font-mono text-[10px] tracking-[0.14em] uppercase transition-colors sm:flex",
                auto ? "border-ok/50 bg-ok/12 text-ok" : "border-white/10 text-ash hover:text-bone",
              )}
            >
              <Zap size={13} className={auto ? "animate-pulse" : ""} /> auto
            </button>
            <Button
              icon={RefreshCw}
              onClick={() => void sync()}
              title="Rileggi il foglio collegato"
              className={cn(syncing && "pointer-events-none opacity-60")}
            >
              <span className="hidden lg:inline">{syncing ? "sincronizzo" : "sincronizza"}</span>
            </Button>
            <Button icon={Upload} onClick={() => setModal("csv")} title="Importa il CSV delle risposte">
              <span className="hidden md:inline">importa</span>
            </Button>
            <Button
              variant="quiet"
              icon={Plus}
              onClick={() => setModal("manuale")}
              title="Aggiungi una candidatura a mano"
            >
              <span className="hidden md:inline">candidatura</span>
            </Button>
            <Button
              variant="quiet"
              icon={Download}
              onClick={() => {
                download(
                  `mosaic-risultati-${new Date().toISOString().slice(0, 10)}.csv`,
                  toCsv(list),
                );
                flash("Esportazione CSV completata.");
              }}
              title="Esporta il registro in CSV"
            >
              <span className="hidden xl:inline">csv</span>
            </Button>
            <Button
              variant="solid"
              icon={FileText}
              onClick={() => setPdfOpen(true)}
              title="Esporta dossier impaginato in PDF"
            >
              <span className="hidden sm:inline">esporta pdf</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1400px] px-4 pb-24 sm:px-6">
        {/* --------------------------------------------------- MEXO poster hero (dal file Storia Mexo.jpg) */}
        <section className="pt-6 sm:pt-8">
          <MexoHeroVinyl />
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 font-mono text-[10px] tracking-[0.16em] text-ash/60 uppercase">
            <span className="flex items-center gap-1.5"><span className="h-px w-6 bg-white/15" /> MEXO Poster ufficiale</span>
            <span className="hidden h-1 w-1 rounded-full bg-white/20 sm:block" />
            <span>Open call for artist · Mosaic Exhibition Orchestra</span>
          </div>
        </section>

        {/* ---------------------------------------------------------- hero */}
        <section className="grid items-end gap-8 py-10 lg:grid-cols-12 lg:py-14">
          <div className="lg:col-span-6 xl:col-span-5">
            <Reveal>
              <div className="mb-4 flex items-center gap-3">
                <span className="font-mono text-[10.5px] tracking-[0.26em] text-musicista uppercase">
                  01 · affluenza
                </span>
                <span className="h-px w-14 bg-gradient-to-r from-musicista/60 to-transparent" />
              </div>
            </Reveal>
            <Reveal delay={60}>
              <h1 className="font-display text-[clamp(2.6rem,6.4vw,4.9rem)] leading-[0.88] font-extrabold tracking-[-0.035em] text-bone">
                Ogni candidatura
                <br />
                è una <span className="text-musicista">tessera</span>.
                <br />
                <span className="text-ash">Noi la mettiamo</span>
                <br />
                <span className="text-ash">nel suo settore.</span>
              </h1>
            </Reveal>
            <Reveal delay={140}>
              <p className="mt-5 max-w-md text-[14px] leading-relaxed text-ash">
                Cruscotto collegato al modulo Google «{FORM_TITLE.toLowerCase()}»:{list.length} risposte lette,{" "}
                {SECTORS.length} settori, un solo sguardo per capire chi chiamare all'ascolto e dove il mosaico ha
                ancora buchi.
              </p>
            </Reveal>
            <Reveal delay={200}>
              <div className="mt-7 grid max-w-lg grid-cols-2 gap-x-6 gap-y-6 border-t border-white/8 pt-6 sm:grid-cols-3">
                <Stat label="Candidature" value={g.totale} accent="#ece5d8" sub={`${g.nuovi7} negli ultimi 7 giorni`} />
                <Stat label="In rosa" value={g.accettati} accent="#63c07f" sub={`${g.tassoAccettazione}% di accettazione`} />
                <Stat label="Da valutare" value={g.inAttesa} accent="#e9a23b" sub={`media ${g.etaMediaGiorni} gg in coda`} />
              </div>
            </Reveal>
            <Reveal delay={260}>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <SectorLegend selected={sectors} onToggle={toggleSector} />
                <a href="#settori" className="focus-ring">
                  <ArrowLink label="vai ai settori" href="#settori" />
                </a>
              </div>
            </Reveal>
          </div>

          <div className="lg:col-span-6 xl:col-span-7">
            <Reveal delay={120} y={26}>
              <MosaicBoard list={list} activeSectors={sectors} onOpen={setOpenC} />
            </Reveal>
          </div>
        </section>

        <Ticker list={list} />

        {/* -------------------------------------------------- risultati settore */}
        <section id="settori" className="scroll-mt-24 pt-16">
          <SectionHead
            index="02"
            kicker="risultati divisi per settore"
            title={
              <>
                Cinque linguaggi,
                <br />
                cinque stati del mosaico
              </>
            }
            hint="La CATEGORIA del modulo diventa il criterio di lettura: volume, avanzamento del filtro, voto medio e copertura territoriale per ciascun settore. Premi una riga per filtrare il registro."
            right={
              <div className="flex items-center gap-3">
                {sectors.length > 0 && (
                  <button
                    onClick={() => setSectors([])}
                    className="focus-ring border border-white/12 px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] text-ash uppercase hover:text-bone"
                  >
                    {sectors.length} filtri attivi · pulisci
                  </button>
                )}
                <Panel hover={false} className="px-3 py-2">
                  <span className="font-mono text-[10px] text-ash">
                    settore più fecondo:{" "}
                    <span style={{ color: SECTORS.find((s) => s.key === stats[0]?.key)?.color }}>
                      {SECTORS.find((s) => s.key === stats[0]?.key)?.label ?? "—"}
                    </span>
                  </span>
                </Panel>
              </div>
            }
          />
          {list.length === 0 ? (
            <Panel hover={false} className="p-10 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center gap-[3px]">
                {SECTORS.map((s, i) => (
                  <span
                    key={s.key}
                    className="h-9 w-2 rounded-[2px] border"
                    style={{
                      borderColor: s.color + "66",
                      background: s.color + "12",
                      animation: `floaty ${5 + i}s ease-in-out ${i * 0.35}s infinite`,
                    }}
                  />
                ))}
              </div>
              <h3 className="font-display text-[24px] font-extrabold tracking-tight text-bone">
                Il mosaico è ancora vuoto
              </h3>
              <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-ash">
                Nessuna risposta in archivio. Importa l'export CSV del modulo, collega il foglio delle risposte,
                oppure registra manualmente la prima candidatura: le tessere compariranno qui.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button variant="solid" icon={Upload} onClick={() => setModal("csv")}>
                  importa il CSV
                </Button>
                <Button icon={Plus} onClick={() => setModal("manuale")}>
                  nuova candidatura
                </Button>
                <Button
                  variant="quiet"
                  icon={RotateCcw}
                  onClick={() => {
                    store.resetDemo();
                    flash("Caricato il set dimostrativo con 112 risposte.");
                  }}
                >
                  guarda i dati dimostrativi
                </Button>
              </div>
            </Panel>
          ) : (
            <SectorMatrix stats={stats} selected={sectors} onToggle={toggleSector} />
          )}
        </section>

        {/* ------------------------------------------------------------- grafici */}
        <section id="analisi" className="scroll-mt-24 pt-16">
          <SectionHead
            index="03"
            kicker="andamento e confronto"
            title="Il quadro numerico"
            hint="Grafici costruiti con Chart.js a partire dalle risposte: ripartizione, flusso settimanale, funnel di selezione, geografia e indice di salute dei settori."
            right={<ArrowLink label="apri il registro delle risposte" href="#registro" />}
          />
          {list.length > 0 ? (
            <OverviewGrid list={list} stats={stats} selected={sectors} onToggle={toggleSector} />
          ) : (
            <Panel hover={false} className="px-5 py-8 text-center">
              <p className="font-mono text-[11px] tracking-[0.14em] text-ash uppercase">
                i grafici si accendono alla prima risposta
              </p>
            </Panel>
          )}
        </section>

        {/* ------------------------------------------------------------- registro */}
        <section id="registro" className="scroll-mt-24 pt-16">
          <SectionHead
            index="04"
            kicker="registro candidature"
            title="Chi ha risposto, cosa facciamo"
            hint={`Stai valutando ${filtered.length} risposte su ${list.length}. Stato, voto e note restano qui: il modulo non viene toccato.`}
            right={
              <div className="flex flex-wrap items-center gap-2">
                <Button icon={FileText} onClick={() => setPdfOpen(true)} title="Impagina ed esporta in PDF">
                  dossier pdf
                </Button>
                <Button
                  variant="quiet"
                  icon={RotateCcw}
                  onClick={() => {
                    if (confirm("Ripristinare il set di risposte dimostrative? Le modifiche locali andranno perse.")) {
                      store.resetDemo();
                      flash("Dati dimostrativi ripristinati.");
                    }
                  }}
                >
                  dati demo
                </Button>
              </div>
            }
          />
          <Register
            list={filtered}
            all={list}
            query={query}
            setQuery={setQuery}
            sectors={sectors}
            toggleSector={toggleSector}
            statuses={statuses}
            toggleStatus={toggleStatus}
            sort={sort}
            setSort={setSort}
            onPatch={store.upsert}
            onOpen={setOpenC}
            onOpenPdf={() => setPdfOpen(true)}
          />
        </section>

        {/* ----------------------------------------------- manifesto MEXO (poster Storia) */}
        <section id="manifesto" className="scroll-mt-24 pt-16">
          <SectionHead
            index="06"
            kicker="il manifesto — open call for artist"
            title={
              <>
                MEXO è una giovane orchestra
                <br />
                senza schemi dove la musica accade.
              </>
            }
            hint="Il poster ufficiale dell'Open Call MEXO — Mosaic Exhibition Orchestra. L'immagine originale (Storia) è integrata nel cruscotto e nel dossier PDF."
          />
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <Panel hover={false} className="overflow-hidden p-0">
                <img
                  src="/assets/mexo-poster.jpg"
                  alt="Poster ufficiale MEXO — Open Call For Artist, vinile oro e M mosaic"
                  className="h-auto w-full object-cover"
                  loading="lazy"
                />
                <div className="flex items-center justify-between border-t border-white/8 bg-[#0a1017] px-3 py-2.5">
                  <span className="font-mono text-[10px] tracking-[0.16em] text-ash uppercase">
                    Storia ufficiale · 1080×1920
                  </span>
                  <a
                    href="/assets/mexo-poster.jpg"
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[10px] tracking-[0.14em] text-musicista uppercase hover:text-bone"
                  >
                    apri poster ↗
                  </a>
                </div>
              </Panel>
            </div>
            <div className="lg:col-span-7 space-y-4">
              <Panel hover={false} className="p-5 sm:p-6">
                <div className="mb-3 flex items-center gap-2">
                  <MexoLogo variant="dark" size="md" className="h-9" />
                  <span className="font-mono text-[10px] tracking-[0.2em] text-musicista uppercase">open call</span>
                </div>
                <h3 className="font-display text-[22px] font-extrabold leading-tight tracking-tight text-bone sm:text-[24px]">
                  Partecipa alla call MEXO.
                  <br />
                  <span className="text-ash">Cinque linguaggi, un unico mosaico.</span>
                </h3>
                <p className="mt-3 text-[13.5px] leading-relaxed text-ash">
                  MEXO — Mosaic Exhibition Orchestra cerca musicisti, performer, dj/producer, visual artist e figure
                  ibride per una giovane orchestra senza schemi. Il poster che vedi è l'identità visiva ufficiale:
                  il vinile oro al centro, la <span className="text-bone">M</span> a mosaico con le tessere
                  colorate dei cinque settori e <span className="text-musicista">EXO</span> in arancio. Ogni
                  candidatura che entra nel cruscotto è una tessera che compone questo mosaico.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <a
                    href={`https://docs.google.com/forms/d/${FORM_ID}/viewform`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 bg-musicista px-4 py-2.5 font-mono text-[11px] font-semibold tracking-[0.14em] text-ink-950 uppercase hover:bg-[#f0ad4a]"
                  >
                    partecipa alla call <ExternalLink size={12} />
                  </a>
                  <Button icon={Download} onClick={() => setPdfOpen(true)}>
                    scarica dossier con logo MEXO
                  </Button>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[10px] tracking-[0.14em] text-ash/70 uppercase">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-[1px] bg-[#e9a23b]" /> Mosaic
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-[1px] bg-[#e05a45]" /> Performer
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-[1px] bg-[#21b3a4]" /> DJ
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-[1px] bg-[#5f8fd9]" /> Visual
                  </span>
                </div>
              </Panel>
              <div className="grid gap-4 sm:grid-cols-2">
                <Panel hover={false} className="p-4">
                  <div className="font-mono text-[10px] tracking-[0.2em] text-musicista uppercase">Il logo</div>
                  <div className="mt-2 font-display text-[14px] font-bold text-bone">M mosaic + EXO arancio</div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ash">
                    La <span className="text-bone">M</span> è riempita con il pattern a mosaico estratto dagli angoli del poster;
                    le tre lettere <span className="text-musicista">EXO</span> in arancio #e9a23b richiamano il settore Musicista.
                    Sotto, il lettering <span className="text-bone">MOSAIC EXHIBITION ORCHESTRA</span>.
                  </p>
                </Panel>
                <Panel hover={false} className="p-4">
                  <div className="font-mono text-[10px] tracking-[0.2em] text-musicista uppercase">Nel PDF</div>
                  <div className="mt-2 font-display text-[14px] font-bold text-bone">Logo su ogni pagina</div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ash">
                    Il dossier esportato impagina il logo MEXO in testata (prima pagina), nelle intestazioni delle pagine
                    successive e nel piè di pagina con numerazione. Temi chiaro e scuro mantengono il logo leggibile.
                  </p>
                </Panel>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- fonte */}
        <section className="pt-16">
          <SectionHead
            index="05"
            kicker="allaccio dei dati"
            title="Come si tiene aggiornato"
          />
          <div className="grid gap-4 lg:grid-cols-12">
            <Panel hover={false} className="lg:col-span-7">
              <div className="flex items-center gap-2 border-b border-white/8 px-5 py-3">
                <CircleCheck size={14} className={store.sheetUrl ? "text-ok" : "text-warn"} />
                <span className="font-mono text-[10px] tracking-[0.2em] text-ash uppercase">
                  stato dell'allaccio
                </span>
                <span className="ml-auto font-mono text-[10px] text-ash">
                  {store.sheetUrl ? "foglio collegato" : "solo archivio locale"}
                </span>
              </div>
              <dl className="grid gap-px bg-white/6 sm:grid-cols-2">
                {[
                  ["Sorgente risposte", `Google Form ${FORM_ID.slice(0, 12)}…`],
                  ["Domande riconosciute", "6 su 6 · timestamp + 5 campi"],
                  ["Candidature in archivio", `${list.length}`],
                  ["Settori popolati", `${g.settoriCoperti} su ${SECTORS.length}`],
                  ["Auto-sync ogni 2 minuti", auto ? "attivo" : "spento"],
                  ["Ultima sincronizzazione", lastSync ?? "nessuna (solo import)"],
                  ["Salvataggio locale", fmtDate(store.savedAt, true)],
                  ["Scrittura sul modulo", "nessuna · lettura sola"],
                ].map(([k, v]) => (
                  <div key={k} className="group bg-[#0c141c] px-5 py-3.5 transition-colors hover:bg-[#101a24]">
                    <dt className="font-mono text-[9.5px] tracking-[0.18em] text-ash uppercase">{k}</dt>
                    <dd className="mt-1 truncate font-mono text-[12.5px] text-bone transition-colors group-hover:text-musicista">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap items-center gap-2 border-t border-white/8 px-5 py-3.5">
                <Button icon={Link2} onClick={() => setModal("foglio")}>
                  collega un foglio
                </Button>
                <Button variant="quiet" icon={Upload} onClick={() => setModal("csv")}>
                  importa csv
                </Button>
                <Button variant="quiet" icon={FileText} onClick={() => setPdfOpen(true)}>
                  esporta pdf
                </Button>
                <span className="mx-1 hidden h-4 w-px bg-white/12 sm:block" />
                <Button
                  variant="quiet"
                  icon={RotateCcw}
                  onClick={() => {
                    store.resetDemo();
                    flash("Ripristinato il set di risposte dimostrative.");
                  }}
                >
                  dati demo
                </Button>
                <Button
                  variant="quiet"
                  icon={Trash2}
                  onClick={() => {
                    if (list.length && confirm("Svuotare il registro di tutte le candidature locali?")) {
                      store.wipe();
                      flash("Registro svuotato: nessuna tessera nel mosaico.");
                    }
                  }}
                >
                  svuota registro
                </Button>
              </div>
            </Panel>

            <div className="lg:col-span-5">
              <ol className="relative space-y-5 border-l border-white/10 pl-6">
                {STEPS.map((st, i) => (
                  <Reveal key={st.n} delay={i * 90}>
                    <li className="group relative">
                      <span
                        className="absolute top-1.5 -left-[27px] h-2.5 w-2.5 rounded-[2px] transition-transform duration-300 group-hover:scale-150"
                        style={{ background: SECTORS[i].color, boxShadow: `0 0 12px ${SECTORS[i].glow}` }}
                      />
                      <div className="font-mono text-[9.5px] tracking-[0.22em] text-ash uppercase">
                        {st.n} · {st.tag}
                      </div>
                      <h3 className="font-display mt-1.5 text-[19px] leading-tight font-extrabold tracking-tight text-bone">
                        {st.t}
                      </h3>
                      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ash">{st.d}</p>
                    </li>
                  </Reveal>
                ))}
              </ol>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/8 bg-[#070b10]/60 py-8 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-5 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <MexoLogo variant="dark" size="md" className="h-9" />
            <div className="hidden h-8 w-px bg-white/10 sm:block" />
            <span className="hidden font-mono text-[10.5px] leading-tight text-ash sm:block">
              cruscotto non ufficiale
              <br />
              le risposte restano di chi le ha scritte
            </span>
            <span className="font-mono text-[10.5px] text-ash sm:hidden">cruscotto non ufficiale</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-ash">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[1px] bg-[#e9a23b]" /> Musicista
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[1px] bg-[#e05a45]" /> Performer
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[1px] bg-[#21b3a4]" /> DJ
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[1px] bg-[#5f8fd9]" /> Visual
            </span>
          </div>
          <a
            href={`https://docs.google.com/forms/d/${FORM_ID}/viewform`}
            target="_blank"
            rel="noreferrer"
            className="focus-ring ml-auto inline-flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.14em] text-ash uppercase transition-colors hover:text-bone"
          >
            apri il modulo
            <ExternalLink size={12} className="-mt-0.5" />
          </a>
        </div>
        <div className="mx-auto mt-6 max-w-[1400px] px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/6 pt-4 font-mono text-[10px] tracking-[0.14em] text-ash/60 uppercase">
            <span>© {new Date().getFullYear()} MEXO — Mosaic Exhibition Orchestra</span>
            <span className="flex items-center gap-2">
              <span>Una giovane orchestra senza schemi dove la musica accade.</span>
              <span className="hidden h-1 w-1 rounded-full bg-ash/40 sm:inline-block" />
              <span className="text-[#e9a23b]">Open call for artist</span>
            </span>
          </div>
        </div>
      </footer>

      {/* ------------------------------------------------------------ overlays */}
      <CandidateSheet
        c={current}
        onClose={() => setOpenC(null)}
        onPatch={(patch) => {
          store.upsert(patch);
          flash("Scheda aggiornata.");
        }}
        onRemove={(id) => {
          store.remove(id);
          flash("Candidatura rimossa dal registro.");
        }}
      />

      <ImportPanel
        open={!!modal}
        initialTab={modal ?? "csv"}
        onClose={() => setModal(null)}
        onReplace={store.addMany}
        onAdd={(c) => {
          store.addOne(c);
          flash(`${c.nome} aggiunto al mosaico.`);
        }}
        sheetUrl={store.sheetUrl}
        setSheetUrl={store.setSheetUrl}
        onSync={sync}
        syncing={syncing}
        lastSync={lastSync}
      />

      <PdfExportModal
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        filtered={filtered}
        all={list}
        activeSectors={sectors}
        activeStatuses={statuses}
        searchQuery={query}
        onDone={flash}
      />

      <div
        className={cn(
          "pointer-events-none fixed bottom-5 left-1/2 z-70 -translate-x-1/2 transition-all duration-400 sm:left-6 sm:translate-x-0",
          toast ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        )}
      >
        <div className="flex items-center gap-2 border border-white/14 bg-[#0d151d]/95 px-4 py-2.5 shadow-2xl backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-musicista" />
          <span className="text-[12.5px] text-bone/90">{toast}</span>
        </div>
      </div>
    </div>
  );
}

export default App;
