import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Clipboard,
  ExternalLink,
  Mail,
  Send,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { Candidate } from "../lib/model";
import { cn } from "../utils/cn";

type RecipientScope = "tutti" | "selezionati";

interface RecipientSet {
  recipients: { candidate: Candidate; email: string }[];
  skipped: number;
}

const DEFAULT_SUBJECT = "MEXO — aggiornamento sulla candidatura";
const DEFAULT_BODY = `Ciao,

scriviamo dalla segreteria di MEXO — Mosaic Exhibition Orchestra in merito alla candidatura inviata.


Un saluto,
Segreteria MEXO`;

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function collectRecipients(candidates: Candidate[]): RecipientSet {
  const seen = new Set<string>();
  const recipients: RecipientSet["recipients"] = [];

  candidates.forEach((candidate) => {
    const email = candidate.mail.trim();
    const key = email.toLocaleLowerCase();
    if (!isEmail(email) || seen.has(key)) return;
    seen.add(key);
    recipients.push({ candidate, email });
  });

  return {
    recipients,
    skipped: candidates.length - recipients.length,
  };
}

/**
 * Prepara l'URL di composizione di Gmail: apre una bozza con oggetto, testo
 * e destinatari in CCN (bcc), senza inviare nulla.
 * Usa l'endpoint classico "view=cm" di mail.google.com.
 */
function createGmailComposeUrl(emails: string[], subject: string, body: string) {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    su: subject,
    body,
    bcc: emails.join(","),
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Prova il fallback compatibile con browser meno recenti o permessi negati.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Copia non riuscita");
}

export function EmailComposer({
  open,
  onClose,
  all,
  selected,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  all: Candidate[];
  selected: Candidate[];
  onDone: (message: string) => void;
}) {
  const [scope, setScope] = useState<RecipientScope>("tutti");
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [copied, setCopied] = useState(false);

  const allSet = useMemo(() => collectRecipients(all), [all]);
  const selectedSet = useMemo(() => collectRecipients(selected), [selected]);
  const target = scope === "selezionati" ? selectedSet : allSet;
  const targetCandidates = scope === "selezionati" ? selected.length : all.length;
  const emails = target.recipients.map((recipient) => recipient.email);
  const gmailUrl = createGmailComposeUrl(emails, subject, body);
  // Oltre ~1800 caratteri alcuni browser/servizi potrebbero troncare l'URL:
  // in quel caso avvisiamo l'utente e suggeriamo il copia-incolla degli indirizzi.
  const isLargeDraft = gmailUrl.length > 1800;

  useEffect(() => {
    if (!open) return;
    setScope(selected.length ? "selezionati" : "tutti");
    setCopied(false);
  }, [open, selected.length]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await copyText(emails.join(", "));
      setCopied(true);
      onDone(`${emails.length} indirizzi copiati negli appunti.`);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      onDone("Non è stato possibile copiare gli indirizzi.");
    }
  };

  const handleOpenGmail = () => {
    if (!emails.length) return;
    // Apertura in una nuova scheda: il cruscotto resta aperto e i dati
    // (in localStorage) non vengono persi. Il click diretto dell'utente
    // evita il blocco dei popup; se comunque il browser lo impedisce,
    // ripieghiamo sulla scheda corrente.
    const gmailWindow = window.open(gmailUrl, "_blank", "noopener,noreferrer");
    if (!gmailWindow) {
      window.location.href = gmailUrl;
    }
    onDone(
      `Bozza Gmail preparata per ${emails.length} ${emails.length === 1 ? "destinatario" : "destinatari"}: completa e invia da Gmail.`,
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center p-0 sm:items-center sm:p-5">
      <button
        type="button"
        aria-label="Chiudi composizione email"
        onClick={onClose}
        className="absolute inset-0 bg-ink-950/80 backdrop-blur-[4px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-composer-title"
        className="panel relative z-10 flex max-h-[94vh] w-full max-w-[820px] flex-col overflow-hidden border-white/14 bg-[#0c141d] shadow-[0_30px_100px_rgba(0,0,0,.72)]"
        style={{ animation: "popin .28s cubic-bezier(.2,.85,.25,1) both" }}
      >
        <div className="h-1 w-full bg-gradient-to-r from-musicista via-performer to-dj" />
        <header className="flex items-start gap-3 border-b border-white/8 px-5 py-4 sm:px-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[3px] border border-musicista/35 bg-musicista/12 text-musicista">
            <Mail size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[9.5px] tracking-[0.22em] text-musicista uppercase">
              comunicazione agli iscritti
            </div>
            <h2 id="email-composer-title" className="font-display text-[22px] font-extrabold tracking-tight text-bone">
              Prepara un'email collettiva
            </h2>
            <p className="mt-0.5 text-[12px] text-ash">
              Scegli tutti gli iscritti oppure le persone selezionate nel registro.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring border border-white/12 p-1.5 text-ash transition-colors hover:border-white/30 hover:text-bone"
            aria-label="Chiudi"
          >
            <X size={16} />
          </button>
        </header>

        <div className="space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <section>
            <div className="mb-2 font-mono text-[10px] tracking-[0.2em] text-ash uppercase">01 · destinatari</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setScope("tutti")}
                className={cn(
                  "focus-ring flex items-center gap-3 border p-3 text-left transition-colors",
                  scope === "tutti"
                    ? "border-musicista/65 bg-musicista/10"
                    : "border-white/9 bg-white/[0.018] hover:border-white/22",
                )}
              >
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-[2px]", scope === "tutti" ? "bg-musicista text-ink-950" : "bg-white/6 text-ash")}>
                  <Users size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[14px] font-bold text-bone">Tutti gli iscritti</span>
                  <span className="font-mono text-[10.5px] text-ash">
                    {allSet.recipients.length} indirizzi email validi
                  </span>
                </span>
                <span className={cn("flex h-4 w-4 items-center justify-center rounded-full border", scope === "tutti" ? "border-musicista bg-musicista text-ink-950" : "border-white/25")}>
                  {scope === "tutti" && <Check size={10} strokeWidth={3} />}
                </span>
              </button>

              <button
                type="button"
                disabled={!selected.length}
                onClick={() => setScope("selezionati")}
                className={cn(
                  "focus-ring flex items-center gap-3 border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                  scope === "selezionati"
                    ? "border-dj/65 bg-dj/10"
                    : "border-white/9 bg-white/[0.018] hover:border-white/22",
                )}
              >
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-[2px]", scope === "selezionati" ? "bg-dj text-ink-950" : "bg-white/6 text-ash")}>
                  <UserCheck size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[14px] font-bold text-bone">Solo selezionati</span>
                  <span className="font-mono text-[10.5px] text-ash">
                    {selected.length
                      ? `${selectedSet.recipients.length} indirizzi su ${selected.length} selezionati`
                      : "seleziona prima dal registro"}
                  </span>
                </span>
                <span className={cn("flex h-4 w-4 items-center justify-center rounded-full border", scope === "selezionati" ? "border-dj bg-dj text-ink-950" : "border-white/25")}>
                  {scope === "selezionati" && <Check size={10} strokeWidth={3} />}
                </span>
              </button>
            </div>

            <div className="mt-2.5 flex flex-col gap-3 border border-white/8 bg-[#091018] p-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {target.recipients.slice(0, 6).map(({ candidate, email }) => (
                    <span
                      key={`${candidate.id}-${email}`}
                      title={email}
                      className="max-w-[180px] truncate border border-white/10 bg-white/4 px-2 py-1 text-[10.5px] text-bone/85"
                    >
                      {candidate.nome}
                    </span>
                  ))}
                  {target.recipients.length > 6 && (
                    <span className="font-mono text-[10px] text-ash">+{target.recipients.length - 6} altri</span>
                  )}
                  {!target.recipients.length && (
                    <span className="text-[12px] text-performer">Nessun indirizzo email valido in questo gruppo.</span>
                  )}
                </div>
                {target.skipped > 0 && (
                  <p className="mt-1.5 font-mono text-[9.5px] text-warn">
                    {target.skipped} {target.skipped === 1 ? "iscritto escluso" : "iscritti esclusi"}: indirizzo assente, non valido o duplicato.
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={!emails.length}
                onClick={() => void handleCopy()}
                className="focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 border border-white/12 px-2.5 py-2 font-mono text-[10px] tracking-[0.1em] text-ash uppercase transition-colors hover:border-white/25 hover:text-bone disabled:opacity-40"
              >
                {copied ? <Check size={12} className="text-ok" /> : <Clipboard size={12} />}
                {copied ? "copiati" : "copia indirizzi"}
              </button>
            </div>
          </section>

          <section>
            <div className="mb-2 font-mono text-[10px] tracking-[0.2em] text-ash uppercase">02 · messaggio</div>
            <label className="block">
              <span className="mb-1.5 block text-[11.5px] text-ash">Oggetto</span>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Oggetto dell'email"
                className="focus-ring w-full border border-white/10 bg-ink-900/70 px-3 py-2.5 text-[13px] text-bone placeholder:text-ash/50 focus:border-musicista/55"
              />
            </label>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-[11.5px] text-ash">Testo</span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Scrivi il messaggio…"
                className="focus-ring h-40 w-full resize-y border border-white/10 bg-ink-900/70 p-3 text-[13px] leading-relaxed text-bone placeholder:text-ash/50 focus:border-musicista/55"
              />
            </label>
          </section>

          <div className="flex items-start gap-2.5 border border-ok/20 bg-ok/[0.06] p-3">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-ok" />
            <p className="text-[11.5px] leading-relaxed text-ash">
              Gli indirizzi sono inseriti in <strong className="text-bone">CCN</strong>: ogni destinatario vedrà solo il proprio. Il cruscotto apre la bozza già compilata in <strong className="text-bone">Gmail</strong> (serve un account Google collegato), ma non invia nulla senza la tua conferma.
            </p>
          </div>

          {isLargeDraft && (
            <p className="border-l-2 border-warn pl-3 text-[11.5px] leading-relaxed text-warn">
              La lista è lunga: Gmail potrebbe non includere tutti i destinatari nella bozza. Se manca qualcuno, usa “copia indirizzi” e incollali nel campo CCN di Gmail.
            </p>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 bg-[#091018] px-5 py-3.5 sm:px-6">
          <div className="font-mono text-[10.5px] text-ash">
            <strong className="text-bone">{target.recipients.length}</strong> {target.recipients.length === 1 ? "destinatario" : "destinatari"}
            <span className="mx-2 opacity-40">·</span>
            {targetCandidates} {targetCandidates === 1 ? "iscritto nel gruppo" : "iscritti nel gruppo"}
          </div>
          <button
            type="button"
            disabled={!emails.length}
            onClick={handleOpenGmail}
            className="focus-ring inline-flex items-center gap-2 bg-bone px-4 py-2.5 font-mono text-[11px] font-semibold tracking-[0.13em] text-ink-950 uppercase transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={14} /> apri in Gmail <ExternalLink size={11} />
          </button>
        </footer>
      </div>
    </div>
  );
}
