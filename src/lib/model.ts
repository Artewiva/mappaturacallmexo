/** Modello dati allineato al Google Form "CANDIDATURA MOSAIC EXHIBITION ORCHESTRA".
 *  Domande rilevate: NOME E COGNOME · MAIL · TELEFONO · CITTÀ · CATEGORIA · RACCONTACI CHI SEI
 */

export const FORM_ID = "1rA9D0YTVlFgOYelrqQrsTWBq5QAJq5NYZ13oEFdxzG8";
export const FORM_TITLE = "Candidatura Mosaic Exhibition Orchestra";

export type SectorKey = "musicista" | "performer" | "dj" | "visual" | "altro";

export type StatusKey = "nuovo" | "valutato" | "contattato" | "provino" | "accettato" | "escluso";

export interface Candidate {
  id: string;
  timestamp: string; // ISO
  nome: string;
  mail: string;
  telefono: string;
  citta: string;
  settore: SectorKey;
  presentazione: string;
  stato: StatusKey;
  voto: number; // 0-5
  note: string;
  fonte: "demo" | "csv" | "foglio" | "manuale";
}

export interface Sector {
  key: SectorKey;
  label: string; // etichetta esatta del form
  short: string;
  color: string;
  glow: string;
  icon: "music" | "mic" | "disc" | "film" | "shapes";
  blurb: string;
}

export const SECTORS: Sector[] = [
  {
    key: "musicista",
    label: "MUSICISTA",
    short: "Musica",
    color: "#e9a23b",
    glow: "rgba(233,162,59,0.35)",
    icon: "music",
    blurb: "Archi · fiati · corde · tastiere",
  },
  {
    key: "performer",
    label: "PERFORMER",
    short: "Corpo",
    color: "#e05a45",
    glow: "rgba(224,90,69,0.32)",
    icon: "mic",
    blurb: "Teatro fisico · danza · voce dal vivo",
  },
  {
    key: "dj",
    label: "DJ/PRODUCER",
    short: "Elettronica",
    color: "#21b3a4",
    glow: "rgba(33,179,164,0.32)",
    icon: "disc",
    blurb: "Live set · sound design · produzione",
  },
  {
    key: "visual",
    label: "VIDEO & VISUAL ARTIST",
    short: "Visivo",
    color: "#5f8fd9",
    glow: "rgba(95,143,217,0.32)",
    icon: "film",
    blurb: "VJ · mapping · fotografia · motion",
  },
  {
    key: "altro",
    label: "ALTRO",
    short: "Altro",
    color: "#a9bf4a",
    glow: "rgba(169,191,74,0.3)",
    icon: "shapes",
    blurb: "Figure ibride fuori categoria",
  },
];

export const SECTOR_MAP = Object.fromEntries(SECTORS.map((s) => [s.key, s])) as Record<
  SectorKey,
  Sector
>;

export const STATUSES: { key: StatusKey; label: string; tone: string; step: number }[] = [
  { key: "nuovo", label: "Da valutare", tone: "#8ea3b8", step: 0 },
  { key: "valutato", label: "Valutato", tone: "#5f8fd9", step: 1 },
  { key: "contattato", label: "Contattato", tone: "#a9bf4a", step: 2 },
  { key: "provino", label: "Provino fissato", tone: "#21b3a4", step: 3 },
  { key: "accettato", label: "Accettato", tone: "#63c07f", step: 4 },
  { key: "escluso", label: "Fuori rosa", tone: "#e05a45", step: -1 },
];

export const STATUS_MAP = Object.fromEntries(
  STATUSES.map((s) => [s.key, { label: s.label, tone: s.tone, step: s.step }]),
) as Record<StatusKey, { label: string; tone: string; step: number }>;

/** Ordine del funnel (esclusi gli scartati) */
export const FUNNEL: StatusKey[] = ["nuovo", "valutato", "contattato", "provino", "accettato"];

export function sectorFromText(raw: string | undefined): SectorKey {
  const t = (raw || "").toLowerCase().trim();
  if (!t) return "altro";
  if (t.includes("visual") || t.includes("video") || t.includes("artist") && t.includes("vis")) return "visual";
  if (t.includes("dj") || t.includes("producer") || t.includes("produt")) return "dj";
  if (t.includes("perform")) return "performer";
  if (t.includes("music") || t.includes("strument") || t.includes("cant")) return "musicista";
  return "altro";
}

export function statusFromText(raw: string | undefined): StatusKey {
  const t = (raw || "").toLowerCase().trim();
  if (!t) return "nuovo";
  if (t.includes("accett") || t.includes("pres") || t.includes("conferm")) return "accettato";
  if (t.includes("prov") || t.includes("audition") || t.includes("call")) return "provino";
  if (t.includes("contatt") || t.includes("email") || t.includes("chiamat")) return "contattato";
  if (t.includes("escl") || t.includes("rifiut") || t.includes("no")) return "escluso";
  if (t.includes("valut")) return "valutato";
  return "nuovo";
}

export const nowIso = () => new Date().toISOString();

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function fmtDate(iso: string, withTime = false) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  if (!withTime) return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
  return `${date} · ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
}

export function daysAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / 86_400_000);
}

export function relative(iso: string) {
  const d = daysAgo(iso);
  if (d <= 0) return "oggi";
  if (d === 1) return "ieri";
  if (d < 7) return `${d} giorni fa`;
  if (d < 30) return `${Math.round(d / 7)} sett. fa`;
  return `${Math.round(d / 30)} mesi fa`;
}

export function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}
