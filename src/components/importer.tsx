import { useEffect, useRef, useState } from "react";
import {
  ClipboardPaste,
  FileSpreadsheet,
  Link2,
  Plus,
  RefreshCw,
  Upload,
  X,
  TriangleAlert,
} from "lucide-react";
import { Candidate, SECTORS, SectorKey, nowIso, uid, FORM_ID } from "../lib/model";
import { candidatesFromCsv } from "../lib/data";
import { cn } from "../utils/cn";

type Tab = "csv" | "foglio" | "manuale";

export function ImportPanel({
  open,
  initialTab = "csv",
  onClose,
  onReplace,
  onAdd,
  sheetUrl,
  setSheetUrl,
  onSync,
  syncing,
  lastSync,
}: {
  open: boolean;
  initialTab?: Tab;
  onClose: () => void;
  onReplace: (list: Candidate[]) => void;
  onAdd: (c: Candidate) => void;
  sheetUrl: string;
  setSheetUrl: (u: string) => void;
  onSync: () => Promise<number>;
  syncing: boolean;
  lastSync: string | null;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setMsg(null);
    }
  }, [open, initialTab]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);
  const [paste, setPaste] = useState("");
  const [drag, setDrag] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    nome: "",
    mail: "",
    telefono: "",
    citta: "",
    settore: "musicista" as SectorKey,
    presentazione: "",
  });

  if (!open) return null;

  const ingest = (text: string) => {
    try {
      const parsed = candidatesFromCsv(text);
      setMsg({ tone: "ok", text: `${parsed.length} candidature lette e suddivise per settore.` });
      onReplace(parsed);
      setTimeout(onClose, 700);
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
    }
  };

  const readFile = (f: File) => {
    const r = new FileReader();
    r.onload = () => ingest(String(r.result || ""));
    r.onerror = () => setMsg({ tone: "err", text: "Impossibile leggere il file." });
    r.readAsText(f, "utf-8");
  };

  return (
    <div className="fixed inset-0 z-60 flex items-start justify-center overflow-y-auto p-4 pt-[8vh]">
      <button aria-label="Chiudi" onClick={onClose} className="fixed inset-0 bg-ink-950/78 backdrop-blur-[3px]" />
      <div
        className="panel relative w-full max-w-2xl shadow-[0_40px_120px_rgba(0,0,0,0.65)]"
        style={{ animation: "popin .32s cubic-bezier(.2,.9,.3,1.05) both" }}
      >
        <header className="flex items-start gap-3 border-b border-white/8 p-5">
          <div className="flex-1">
            <div className="font-mono text-[10px] tracking-[0.22em] text-musicista uppercase">
              allaccio del modulo
            </div>
            <h3 className="font-display text-[22px] leading-tight font-extrabold tracking-tight">
              Porta le risposte dentro il cruscotto
            </h3>
            <p className="mt-1 text-[12px] text-ash">
              Il form <span className="font-mono text-bone/80">{FORM_ID.slice(0, 14)}…</span> non espone un endpoint
              pubblico: i dati arrivano dall'export CSV o dal foglio collegato, e restano solo sul tuo browser.
            </p>
          </div>
          <button
            onClick={onClose}
            className="focus-ring rounded-[2px] border border-white/12 p-1.5 text-ash hover:border-white/30 hover:text-bone"
          >
            <X size={16} />
          </button>
        </header>

        <nav className="flex gap-1 border-b border-white/8 px-5">
          {(
            [
              ["csv", "Importa CSV", Upload],
              ["foglio", "Foglio collegato", Link2],
              ["manuale", "Candidatura manuale", Plus],
            ] as [Tab, string, typeof Upload][]
          ).map(([k, l, Ico]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "focus-ring -mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 font-mono text-[10.5px] tracking-[0.14em] uppercase transition-colors",
                tab === k ? "border-musicista text-bone" : "border-transparent text-ash hover:text-bone",
              )}
            >
              <Ico size={13} /> {l}
            </button>
          ))}
        </nav>

        <div className="p-5">
          {msg && (
            <div
              className={cn(
                "mb-4 flex items-center gap-2 border px-3 py-2 text-[12px]",
                msg.tone === "ok"
                  ? "border-ok/40 bg-ok/10 text-ok"
                  : "border-performer/40 bg-performer/10 text-performer",
              )}
            >
              <TriangleAlert size={14} /> {msg.text}
            </div>
          )}

          {tab === "csv" && (
            <div className="space-y-4">
              <ol className="space-y-1.5 text-[12.5px] text-ash">
                <li>
                  <span className="font-mono text-musicista">01</span> Apri il modulo → <em>Risposte</em> → icona
                  foglio → <em>Scarica risposte (.csv)</em>
                </li>
                <li>
                  <span className="font-mono text-musicista">02</span> trascina qui il file, oppure incolla il
                  contenuto testuale
                </li>
                <li>
                  <span className="font-mono text-musicista">03</span> categorie, città e date vengono riconosciute
                  in automatico
                </li>
              </ol>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) readFile(f);
                }}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-2 border border-dashed px-4 py-8 text-center transition-colors",
                  drag ? "border-musicista bg-musicista/10" : "border-white/15 hover:border-white/30 hover:bg-white/4",
                )}
              >
                <FileSpreadsheet size={22} className="text-musicista" />
                <div className="font-display text-[15px] font-bold">Trascina il CSV delle risposte</div>
                <div className="font-mono text-[10.5px] text-ash">oppure clicca per selezionare il file</div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) readFile(f);
                  }}
                />
              </div>
              <div>
                <div className="mb-1.5 flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-ash uppercase">
                  <ClipboardPaste size={12} /> incolla il contenuto
                </div>
                <textarea
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  placeholder={'"Timestamp","NOME E COGNOME","MAIL","TELEFONO","CITTÀ","CATEGORIA","RACCONTACI CHI SEI"\n…'}
                  className="focus-ring h-28 w-full resize-none border border-white/10 bg-ink-900/70 p-3 font-mono text-[11px] text-bone placeholder:text-ash/45 focus:border-white/25"
                />
                <button
                  disabled={!paste.trim()}
                  onClick={() => ingest(paste)}
                  className="focus-ring mt-2 w-full bg-bone py-2.5 font-mono text-[11px] tracking-[0.16em] text-ink-950 uppercase transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  carica {paste.trim() ? "le risposte incollate" : "– attende testo"}
                </button>
              </div>
            </div>
          )}

          {tab === "foglio" && (
            <div className="space-y-4">
              <p className="text-[12.5px] leading-relaxed text-ash">
                Se le risposte confluiscano in un Google Foglio, pubblica il foglio (<em>File → Pubblica sul web →
                Valori separati da virgola</em>) e incolla qui l'URL: il cruscotto lo rileggerà a ogni pressione di
                «Sincronizza».
              </p>
              <input
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/e/…/pub?output=csv"
                className="focus-ring w-full border border-white/10 bg-ink-900/70 px-3 py-2.5 font-mono text-[11.5px] text-bone placeholder:text-ash/50 focus:border-white/25"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={busy || syncing || !sheetUrl.trim()}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const n = await onSync();
                      setMsg({ tone: "ok", text: `${n} risposte aggiornate dal foglio.` });
                    } catch (e) {
                      setMsg({ tone: "err", text: (e as Error).message });
                    }
                    setBusy(false);
                  }}
                  className="focus-ring flex items-center gap-2 border border-white/15 bg-ink-800 px-4 py-2.5 font-mono text-[11px] tracking-[0.14em] text-bone uppercase transition-colors hover:border-musicista/60 disabled:opacity-40"
                >
                  <RefreshCw size={13} className={busy || syncing ? "animate-spin" : ""} /> prova e importa
                </button>
                <button
                  disabled={!sheetUrl.trim()}
                  onClick={() => setMsg({ tone: "ok", text: "Indirizzo salvato: usa «Sincronizza» nella barra." })}
                  className="focus-ring border border-white/12 px-4 py-2.5 font-mono text-[11px] tracking-[0.14em] text-ash uppercase transition-colors hover:text-bone disabled:opacity-40"
                >
                  salva indirizzo
                </button>
              </div>
              {lastSync && (
                <div className="font-mono text-[10.5px] text-ash">
                  ultima sincronizzazione: <span className="text-bone">{lastSync}</span>
                </div>
              )}
            </div>
          )}

          {tab === "manuale" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["nome", "NOME E COGNOME", "text"],
                  ["mail", "MAIL", "email"],
                  ["telefono", "TELEFONO", "text"],
                  ["citta", "CITTÀ", "text"],
                ] as [keyof typeof form, string, string][]
              ).map(([k, label, type]) => (
                <label key={k} className="block">
                  <span className="mb-1 block font-mono text-[9.5px] tracking-[0.18em] text-ash uppercase">
                    {label}
                  </span>
                  <input
                    type={type}
                    value={form[k] as string}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    className="focus-ring w-full border border-white/10 bg-ink-900/70 px-3 py-2 text-[13px] text-bone focus:border-white/25"
                  />
                </label>
              ))}
              <label className="block sm:col-span-2">
                <span className="mb-1 block font-mono text-[9.5px] tracking-[0.18em] text-ash uppercase">
                  CATEGORIA
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SECTORS.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setForm({ ...form, settore: s.key })}
                      className={cn(
                        "focus-ring border px-2.5 py-1.5 font-mono text-[10px] tracking-[0.12em] uppercase transition-all",
                        form.settore === s.key ? "text-ink-950" : "text-ash hover:text-bone",
                      )}
                      style={{
                        borderColor: form.settore === s.key ? s.color : s.color + "33",
                        background: form.settore === s.key ? s.color : "transparent",
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block font-mono text-[9.5px] tracking-[0.18em] text-ash uppercase">
                  RACCONTACI CHI SEI
                </span>
                <textarea
                  value={form.presentazione}
                  onChange={(e) => setForm({ ...form, presentazione: e.target.value })}
                  className="focus-ring h-24 w-full resize-none border border-white/10 bg-ink-900/70 p-3 text-[13px] text-bone focus:border-white/25"
                />
              </label>
              <button
                disabled={!form.nome.trim()}
                onClick={() => {
                  onAdd({
                    id: uid(),
                    timestamp: nowIso(),
                    nome: form.nome.trim(),
                    mail: form.mail.trim(),
                    telefono: form.telefono.trim(),
                    citta: form.citta.trim() || "n.d.",
                    settore: form.settore,
                    presentazione: form.presentazione.trim(),
                    stato: "nuovo",
                    voto: 0,
                    note: "",
                    fonte: "manuale",
                  });
                  setForm({ ...form, nome: "", mail: "", telefono: "", citta: "", presentazione: "" });
                  setMsg({ tone: "ok", text: "Candidatura aggiunta al registro." });
                }}
                className="focus-ring sm:col-span-2 bg-bone py-2.5 font-mono text-[11px] tracking-[0.16em] text-ink-950 uppercase transition-opacity hover:opacity-90 disabled:opacity-30"
              >
                aggiungi al mosaico
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

