import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Layers,
  LayoutGrid,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import {
  Candidate,
  SECTORS,
  SECTOR_MAP,
  STATUS_MAP,
  SectorKey,
  StatusKey,
} from "../lib/model";
import {
  DEFAULT_PDF_OPTIONS,
  PdfExportOptions,
  PdfGrouping,
  PdfOrientation,
  PdfScope,
  createPdfPreviewUrl,
  estimatePdfPages,
  savePdfReport,
} from "../lib/pdf";
import { download, toCsv } from "../lib/data";
import { cn } from "../utils/cn";

type PresetId = "completo" | "sintesi" | "commissione" | "pubblico";

const PRESETS: {
  id: PresetId;
  label: string;
  hint: string;
  apply: Partial<PdfExportOptions>;
}[] = [
  {
    id: "completo",
    label: "Dossier integrale",
    hint: "KPI, settori, registro e schede",
    apply: {
      includeSummary: true,
      includeSectors: true,
      includeRegister: true,
      includeCards: true,
      includeContacts: true,
      includeNotes: true,
      orientation: "portrait",
      groupBy: "settore",
    },
  },
  {
    id: "sintesi",
    label: "Sintesi direzione",
    hint: "Solo indicatori, grafici e settori",
    apply: {
      includeSummary: true,
      includeSectors: true,
      includeRegister: false,
      includeCards: false,
      orientation: "portrait",
    },
  },
  {
    id: "commissione",
    label: "Foglio audizioni",
    hint: "Registro orizzontale + schede",
    apply: {
      includeSummary: false,
      includeSectors: false,
      includeRegister: true,
      includeCards: true,
      includeContacts: true,
      includeNotes: true,
      orientation: "landscape",
      groupBy: "settore",
    },
  },
  {
    id: "pubblico",
    label: "Versione riservata",
    hint: "Senza contatti ne note interne",
    apply: {
      includeSummary: true,
      includeSectors: true,
      includeRegister: true,
      includeCards: false,
      includeContacts: false,
      includeNotes: false,
      orientation: "portrait",
    },
  },
];

export function PdfExportModal({
  open,
  onClose,
  filtered,
  all,
  activeSectors,
  activeStatuses,
  searchQuery,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  filtered: Candidate[];
  all: Candidate[];
  activeSectors: SectorKey[];
  activeStatuses: StatusKey[];
  searchQuery: string;
  onDone: (msg: string) => void;
}) {
  const hasFilters =
    activeSectors.length > 0 ||
    activeStatuses.length > 0 ||
    searchQuery.trim().length > 0 ||
    filtered.length !== all.length;

  const [opts, setOpts] = useState<PdfExportOptions>(() => ({
    ...DEFAULT_PDF_OPTIONS,
    scope: hasFilters ? "filtrate" : "tutte",
  }));
  const [activePreset, setActivePreset] = useState<PresetId | null>("completo");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewPages, setPreviewPages] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (open) {
      setOpts((prev) => ({
        ...prev,
        scope: hasFilters ? "filtrate" : "tutte",
      }));
    } else if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPreviewPages(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasFilters]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);

  const targetList = opts.scope === "filtrate" ? filtered : all;
  const anySectionSelected =
    opts.includeSummary || opts.includeSectors || opts.includeRegister || opts.includeCards;

  const estimatedPages = useMemo(
    () => estimatePdfPages(targetList.length, opts),
    [targetList.length, opts],
  );

  // Invalida l'anteprima quando cambiano le opzioni
  useEffect(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPreviewPages(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts, targetList.length]);

  if (!open) return null;

  const patch = (partial: Partial<PdfExportOptions>, preset: PresetId | null = null) => {
    setActivePreset(preset);
    setOpts((prev) => ({ ...prev, ...partial }));
  };

  const handlePreview = () => {
    if (!anySectionSelected) return;
    setGenerating(true);
    setTimeout(() => {
      try {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const res = createPdfPreviewUrl({
          candidates: filtered,
          allCandidates: all,
          activeSectors,
          activeStatuses,
          searchQuery,
          options: opts,
        });
        setPreviewUrl(res.url);
        setPreviewPages(res.pages);
      } finally {
        setGenerating(false);
      }
    }, 20);
  };

  const handleDownloadPdf = () => {
    if (!anySectionSelected) return;
    setGenerating(true);
    setTimeout(() => {
      try {
        const res = savePdfReport({
          candidates: filtered,
          allCandidates: all,
          activeSectors,
          activeStatuses,
          searchQuery,
          options: opts,
        });
        onDone(`PDF impaginato esportato (${res.pages} pagine · ${res.file}).`);
        onClose();
      } finally {
        setGenerating(false);
      }
    }, 20);
  };

  return (
    <div className="fixed inset-0 z-60 flex items-start justify-center overflow-y-auto p-3 pt-[4vh] sm:p-5 sm:pt-[6vh]">
      <button
        aria-label="Chiudi"
        onClick={onClose}
        className="fixed inset-0 bg-ink-950/82 backdrop-blur-[4px]"
      />
      <div
        className={cn(
          "panel relative w-full shadow-[0_40px_130px_rgba(0,0,0,0.75)] transition-all duration-300",
          previewUrl ? "max-w-6xl" : "max-w-3xl",
        )}
        style={{ animation: "popin .3s cubic-bezier(.2,.9,.3,1.04) both" }}
      >
        {/* Striscia settori in testa */}
        <div className="flex h-1 w-full">
          {SECTORS.map((s) => (
            <span key={s.key} className="h-full flex-1" style={{ background: s.color }} />
          ))}
        </div>

        <header className="flex items-start gap-3 border-b border-white/8 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[3px] border border-musicista/40 bg-musicista/14 text-musicista">
            <FileText size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] tracking-[0.22em] text-musicista uppercase">
              impaginazione tipografica · a4 vettoriale
            </div>
            <h3 className="font-display text-[22px] leading-tight font-extrabold tracking-tight text-bone">
              Esporta dossier PDF impaginato
            </h3>
            <p className="mt-1 text-[12.5px] text-ash">
              Componi il fascicolo di stampa con copertina dati, analisi per settore, tabella registro
              multi-pagina e schede individuali numerate. Tutto generato in locale sul browser.
            </p>
          </div>
          <button
            onClick={onClose}
            className="focus-ring rounded-[2px] border border-white/12 p-1.5 text-ash hover:border-white/30 hover:text-bone"
          >
            <X size={16} />
          </button>
        </header>

        <div className={cn("grid gap-0", previewUrl ? "lg:grid-cols-12" : "grid-cols-1")}>
          {/* Colonna configurazione */}
          <div className={cn("space-y-5 p-5", previewUrl && "lg:col-span-6 lg:border-r lg:border-white/8")}>
            {/* Preset rapidi */}
            <div>
              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-ash uppercase">
                <Sparkles size={12} className="text-musicista" /> modelli rapidi di impaginazione
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PRESETS.map((pr) => {
                  const on = activePreset === pr.id;
                  return (
                    <button
                      key={pr.id}
                      type="button"
                      onClick={() => patch(pr.apply, pr.id)}
                      className={cn(
                        "focus-ring border p-2.5 text-left transition-all",
                        on
                          ? "border-musicista bg-musicista/12 text-bone"
                          : "border-white/10 bg-ink-900/50 text-ash hover:border-white/25 hover:text-bone",
                      )}
                      style={{ borderRadius: 2 }}
                    >
                      <div className="font-display text-[12.5px] leading-tight font-bold text-bone">
                        {pr.label}
                      </div>
                      <div className="mt-0.5 text-[10.5px] leading-snug text-ash">{pr.hint}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Intestazione documento */}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block font-mono text-[9.5px] tracking-[0.18em] text-ash uppercase">
                  titolo del fascicolo
                </span>
                <input
                  type="text"
                  value={opts.title}
                  onChange={(e) => patch({ title: e.target.value }, activePreset)}
                  className="focus-ring w-full border border-white/10 bg-ink-900/70 px-3 py-2 text-[12.5px] text-bone focus:border-white/25"
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-mono text-[9.5px] tracking-[0.18em] text-ash uppercase">
                  sottotitolo / nota di edizione
                </span>
                <input
                  type="text"
                  value={opts.subtitle}
                  onChange={(e) => patch({ subtitle: e.target.value }, activePreset)}
                  className="focus-ring w-full border border-white/10 bg-ink-900/70 px-3 py-2 text-[12.5px] text-bone focus:border-white/25"
                />
              </label>
            </div>

            {/* Perimetro dati, Orientamento, Raggruppamento, Tema */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 font-mono text-[9.5px] tracking-[0.18em] text-ash uppercase">
                  perimetro candidature
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      ["filtrate", `Vista attuale (${filtered.length})`],
                      ["tutte", `Tutte (${all.length})`],
                    ] as [PdfScope, string][]
                  ).map(([k, lbl]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => patch({ scope: k }, activePreset)}
                      className={cn(
                        "focus-ring border px-2.5 py-2 font-mono text-[10px] tracking-[0.1em] uppercase transition-colors",
                        opts.scope === k
                          ? "border-bone bg-bone text-ink-950 font-semibold"
                          : "border-white/10 text-ash hover:border-white/25 hover:text-bone",
                      )}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
                {opts.scope === "filtrate" && hasFilters && (
                  <div className="mt-1.5 flex flex-wrap gap-1 text-[10.5px] text-ash">
                    {activeSectors.map((sk) => (
                      <span
                        key={sk}
                        className="border px-1.5 py-0.5 font-mono text-[9px] uppercase"
                        style={{
                          borderColor: SECTOR_MAP[sk].color + "55",
                          color: SECTOR_MAP[sk].color,
                        }}
                      >
                        {SECTOR_MAP[sk].short}
                      </span>
                    ))}
                    {activeStatuses.map((st) => (
                      <span
                        key={st}
                        className="border px-1.5 py-0.5 font-mono text-[9px] uppercase"
                        style={{
                          borderColor: STATUS_MAP[st].tone + "55",
                          color: STATUS_MAP[st].tone,
                        }}
                      >
                        {STATUS_MAP[st].label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-1.5 font-mono text-[9.5px] tracking-[0.18em] text-ash uppercase">
                  formato pagina a4 & tema
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      ["portrait", "A4 Verticale"],
                      ["landscape", "A4 Orizzontale"],
                    ] as [PdfOrientation, string][]
                  ).map(([k, lbl]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => patch({ orientation: k })}
                      className={cn(
                        "focus-ring border px-2.5 py-2 font-mono text-[10px] tracking-[0.1em] uppercase transition-colors",
                        opts.orientation === k
                          ? "border-musicista bg-musicista/18 text-bone"
                          : "border-white/10 text-ash hover:border-white/25 hover:text-bone",
                      )}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 font-mono text-[9.5px] tracking-[0.18em] text-ash uppercase">
                  raggruppamento elenco
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ["settore", "Per settore"],
                      ["stato", "Per stato"],
                      ["cronologico", "Unico"],
                    ] as [PdfGrouping, string][]
                  ).map(([k, lbl]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => patch({ groupBy: k })}
                      className={cn(
                        "focus-ring border px-2 py-1.5 font-mono text-[9.5px] tracking-[0.1em] uppercase transition-colors",
                        opts.groupBy === k
                          ? "border-dj bg-dj/18 text-bone"
                          : "border-white/10 text-ash hover:border-white/25 hover:text-bone",
                      )}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1.5 font-mono text-[9.5px] tracking-[0.18em] text-ash uppercase">
                  resa cromatica foglio
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      ["editoriale", "Carta chiara (stampa)"],
                      ["dark", "Notturno Mosaic"],
                    ] as [PdfExportOptions["theme"], string][]
                  ).map(([k, lbl]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => patch({ theme: k }, activePreset)}
                      className={cn(
                        "focus-ring border px-2 py-1.5 font-mono text-[9.5px] tracking-[0.08em] uppercase transition-colors",
                        opts.theme === k
                          ? "border-visual bg-visual/20 text-bone"
                          : "border-white/10 text-ash hover:border-white/25 hover:text-bone",
                      )}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sezioni da includere */}
            <div>
              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-ash uppercase">
                <Layers size={12} className="text-dj" /> sezioni impaginate nel documento
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    [
                      "includeSummary",
                      "01 · Quadratura e mosaico",
                      "6 KPI, barre funnel, città e mappa tessere",
                      LayoutGrid,
                    ],
                    [
                      "includeSectors",
                      "02 · Analisi per settore",
                      "Schede comparative dei 5 linguaggi artistici",
                      Layers,
                    ],
                    [
                      "includeRegister",
                      "03 · Tabella registro",
                      "Elenco tabellare multi-pagina con intestazione",
                      FileText,
                    ],
                    [
                      "includeCards",
                      "04 · Schede individuali",
                      "Profili completi con bio «Raccontaci chi sei»",
                      BookOpen,
                    ],
                  ] as [
                    keyof Pick<
                      PdfExportOptions,
                      "includeSummary" | "includeSectors" | "includeRegister" | "includeCards"
                    >,
                    string,
                    string,
                    typeof FileText,
                  ][]
                ).map(([key, title, desc, Icon]) => {
                  const checked = opts[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => patch({ [key]: !checked })}
                      className={cn(
                        "focus-ring flex items-start gap-2.5 border p-3 text-left transition-all",
                        checked
                          ? "border-white/22 bg-white/[0.045] text-bone"
                          : "border-white/8 bg-transparent text-ash/70 hover:border-white/16",
                      )}
                      style={{ borderRadius: 2 }}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[2px] border transition-colors",
                          checked
                            ? "border-ok bg-ok text-ink-950"
                            : "border-white/20 bg-transparent",
                        )}
                      >
                        {checked && <Check size={11} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 font-display text-[13px] font-bold">
                          <Icon size={13} className="text-musicista" /> {title}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-ash">
                          {desc}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {!anySectionSelected && (
                <p className="mt-2 font-mono text-[11px] text-performer">
                  Seleziona almeno una sezione per generare il PDF.
                </p>
              )}
            </div>

            {/* Opzioni privacy / note */}
            <div className="flex flex-wrap items-center gap-4 border-t border-white/8 pt-3.5">
              <div className="flex items-center gap-1.5 font-mono text-[9.5px] tracking-[0.16em] text-ash uppercase">
                <ShieldAlert size={12} className="text-warn" /> riservatezza:
              </div>
              {(
                [
                  ["includeContacts", "Mostra mail e telefono"],
                  ["includeNotes", "Includi note interne commissione"],
                ] as [keyof Pick<PdfExportOptions, "includeContacts" | "includeNotes">, string][]
              ).map(([k, label]) => {
                const on = opts[k];
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => patch({ [k]: !on })}
                    className="focus-ring inline-flex items-center gap-2 text-[12px] text-bone/90 hover:text-bone"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-[2px] border",
                        on ? "border-musicista bg-musicista text-ink-950" : "border-white/20",
                      )}
                    >
                      {on && <Check size={11} strokeWidth={3} />}
                    </span>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Colonna Anteprima Live PDF */}
          {previewUrl && (
            <div className="flex flex-col border-t border-white/8 bg-[#070b10] p-4 lg:col-span-6 lg:border-t-0">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-[0.18em] text-ok uppercase">
                  anteprima impaginato · {previewPages} {previewPages === 1 ? "pagina" : "pagine"} a4
                </span>
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                    setPreviewPages(null);
                  }}
                  className="font-mono text-[10px] tracking-[0.12em] text-ash uppercase hover:text-bone"
                >
                  chiudi anteprima
                </button>
              </div>
              <iframe
                title="Anteprima PDF impaginato"
                src={previewUrl}
                className="min-h-[460px] w-full flex-1 rounded-[2px] border border-white/12 bg-white"
              />
            </div>
          )}
        </div>

        {/* Footer azioni */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 bg-[#0a1017]/80 px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-3 font-mono text-[10.5px] text-ash">
            <span>
              <strong className="text-bone">{targetList.length}</strong> candidature
            </span>
            <span className="opacity-40">·</span>
            <span>
              stima <strong className="text-musicista">~{previewPages ?? estimatedPages}</strong> pag. A4
            </span>
            <button
              type="button"
              onClick={() => {
                download(
                  `mosaic-risultati-${new Date().toISOString().slice(0, 10)}.csv`,
                  toCsv(targetList),
                );
                onDone("Esportazione CSV completata.");
              }}
              className="focus-ring ml-1 inline-flex items-center gap-1 border border-white/10 px-2 py-1 text-[9.5px] tracking-[0.12em] text-ash uppercase hover:border-white/25 hover:text-bone"
              title="Scarica invece i dati grezzi in formato CSV"
            >
              <FileSpreadsheet size={11} /> scarica anche csv
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!anySectionSelected || generating}
              onClick={handlePreview}
              className="focus-ring inline-flex items-center gap-2 border border-white/15 bg-ink-800 px-3.5 py-2 font-mono text-[11px] tracking-[0.14em] text-bone uppercase transition-colors hover:border-musicista/60 disabled:opacity-40"
            >
              <Eye size={14} /> {previewUrl ? "aggiorna anteprima" : "anteprima"}
            </button>
            <button
              type="button"
              disabled={!anySectionSelected || generating}
              onClick={handleDownloadPdf}
              className="focus-ring inline-flex items-center gap-2 bg-bone px-4 py-2 font-mono text-[11px] font-semibold tracking-[0.15em] text-ink-950 uppercase transition-opacity hover:bg-white disabled:opacity-40"
            >
              <Download size={14} /> {generating ? "impagino…" : "scarica pdf"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
