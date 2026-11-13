import { jsPDF } from "jspdf";
import {
  Candidate,
  FORM_TITLE,
  SECTORS,
  SECTOR_MAP,
  STATUSES,
  STATUS_MAP,
  SectorKey,
  StatusKey,
  fmtDate,
  pct,
} from "./model";
import { cityRanking, globalStats, sectorStats } from "./store";

export type PdfOrientation = "portrait" | "landscape";
export type PdfScope = "filtrate" | "tutte";
export type PdfGrouping = "settore" | "stato" | "cronologico";

export interface PdfExportOptions {
  /** Titolo principale del dossier */
  title: string;
  /** Sottotitolo / nota di redazione */
  subtitle: string;
  /** Quali candidature includere */
  scope: PdfScope;
  /** Orientamento foglio A4 */
  orientation: PdfOrientation;
  /** Criterio di raggruppamento nel registro e nelle schede */
  groupBy: PdfGrouping;
  /** Sezioni da impaginare */
  includeSummary: boolean;
  includeSectors: boolean;
  includeRegister: boolean;
  includeCards: boolean;
  /** Visibilità dati sensibili e note */
  includeContacts: boolean;
  includeNotes: boolean;
  /** Tema tipografico del foglio */
  theme: "editoriale" | "dark";
}

export const DEFAULT_PDF_OPTIONS: PdfExportOptions = {
  title: "Dossier Candidature · Mosaic Exhibition Orchestra",
  subtitle: "Report impaginato di monitoraggio per settore, stato del processo e registro analitico",
  scope: "filtrate",
  orientation: "portrait",
  groupBy: "settore",
  includeSummary: true,
  includeSectors: true,
  includeRegister: true,
  includeCards: true,
  includeContacts: true,
  includeNotes: true,
  theme: "editoriale",
};

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface Palette {
  pageBg: RGB;
  cardBg: RGB;
  cardAltBg: RGB;
  headerBg: RGB;
  ink: RGB;
  muted: RGB;
  subtle: RGB;
  border: RGB;
  accent: RGB;
  ok: RGB;
}

const PALETTES: Record<PdfExportOptions["theme"], Palette> = {
  editoriale: {
    pageBg: { r: 251, g: 249, b: 245 },
    cardBg: { r: 255, g: 255, b: 255 },
    cardAltBg: { r: 245, g: 242, b: 235 },
    headerBg: { r: 13, g: 21, b: 30 },
    ink: { r: 15, g: 23, b: 32 },
    muted: { r: 92, g: 106, b: 121 },
    subtle: { r: 142, g: 155, b: 168 },
    border: { r: 222, g: 217, b: 207 },
    accent: { r: 233, g: 162, b: 59 },
    ok: { r: 64, g: 156, b: 96 },
  },
  dark: {
    pageBg: { r: 11, g: 17, b: 24 },
    cardBg: { r: 19, g: 29, b: 40 },
    cardAltBg: { r: 15, g: 23, b: 33 },
    headerBg: { r: 7, g: 11, b: 16 },
    ink: { r: 236, g: 229, b: 216 },
    muted: { r: 147, g: 163, b: 179 },
    subtle: { r: 102, g: 118, b: 135 },
    border: { r: 38, g: 53, b: 69 },
    accent: { r: 233, g: 162, b: 59 },
    ok: { r: 99, g: 192, b: 127 },
  },
};

function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return { r: 140, g: 150, b: 160 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

/** Normalizza caratteri fuori da WinAnsi per i font standard PDF Helvetica/Courier. */
function pdfSafe(input: string | number | undefined | null): string {
  if (input === null || input === undefined) return "";
  return String(input)
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u2192/g, "->")
    .replace(/\u2713|\u2714/g, "OK")
    .replace(/[\u2605\u2606]/g, "*")
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "")
    .trim();
}

function setFill(doc: jsPDF, c: RGB) {
  doc.setFillColor(c.r, c.g, c.b);
}
function setStroke(doc: jsPDF, c: RGB) {
  doc.setDrawColor(c.r, c.g, c.b);
}
function setText(doc: jsPDF, c: RGB) {
  doc.setTextColor(c.r, c.g, c.b);
}

function drawRatingDots(doc: jsPDF, x: number, y: number, voto: number, activeColor: RGB, emptyColor: RGB) {
  const r = 1.05;
  const gap = 3.0;
  for (let i = 1; i <= 5; i++) {
    if (i <= voto) {
      setFill(doc, activeColor);
      doc.circle(x + (i - 1) * gap, y, r, "F");
    } else {
      setStroke(doc, emptyColor);
      doc.setLineWidth(0.25);
      doc.circle(x + (i - 1) * gap, y, r, "S");
    }
  }
}

export interface PdfGenerationContext {
  candidates: Candidate[];
  allCandidates: Candidate[];
  activeSectors: SectorKey[];
  activeStatuses: StatusKey[];
  searchQuery: string;
  options: PdfExportOptions;
}

/** Stima indicativa delle pagine per l'anteprima nel modale. */
export function estimatePdfPages(count: number, opts: PdfExportOptions): number {
  let pages = 0;
  if (opts.includeSummary) pages += 1;
  if (opts.includeSectors) pages += 1;
  if (opts.includeRegister && count > 0) {
    const perPage = opts.orientation === "landscape" ? 22 : 28;
    pages += Math.max(1, Math.ceil(count / perPage));
  }
  if (opts.includeCards && count > 0) {
    const perPage = opts.orientation === "landscape" ? 6 : 4;
    pages += Math.max(1, Math.ceil(count / perPage));
  }
  return Math.max(1, pages);
}

/** Costruisce l'istanza jsPDF completamente impaginata, con intestazioni, piè di pagina e numerazione N / Tot. */
export function buildPdfDocument(ctx: PdfGenerationContext): jsPDF {
  const { options: opts } = ctx;
  const list = opts.scope === "filtrate" ? ctx.candidates : ctx.allCandidates;
  const pal = PALETTES[opts.theme];

  const doc = new jsPDF({
    orientation: opts.orientation,
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentW = pageW - marginX * 2;
  const topY = 20;
  const bottomLimit = pageH - 15;

  const generatedAt = new Date();
  const dateLabel = fmtDate(generatedAt.toISOString(), true);

  let currentSectionLabel = "RIEPILOGO";
  const pageSections: string[] = [];

  const paintPageBackground = () => {
    setFill(doc, pal.pageBg);
    doc.rect(0, 0, pageW, pageH, "F");
  };

  const addFreshPage = (sectionLabel: string) => {
    currentSectionLabel = sectionLabel;
    doc.addPage("a4", opts.orientation);
    paintPageBackground();
    pageSections.push(sectionLabel);
    return topY;
  };

  // Prima pagina
  paintPageBackground();
  pageSections.push(currentSectionLabel);
  let y = topY;

  const ensureSpace = (needed: number, sectionLabel = currentSectionLabel): number => {
    if (y + needed > bottomLimit) {
      y = addFreshPage(sectionLabel);
    }
    return y;
  };

  const drawSectionHeading = (index: string, kicker: string, title: string, subtitle?: string) => {
    ensureSpace(22, kicker.toUpperCase());
    currentSectionLabel = kicker.toUpperCase();
    pageSections[pageSections.length - 1] = currentSectionLabel;

    setFill(doc, pal.accent);
    doc.rect(marginX, y, 2.2, 10.5, "F");

    doc.setFont("courier", "bold");
    doc.setFontSize(7.5);
    setText(doc, pal.accent);
    doc.text(pdfSafe(`${index} // ${kicker.toUpperCase()}`), marginX + 5, y + 3.2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14.5);
    setText(doc, pal.ink);
    doc.text(pdfSafe(title), marginX + 5, y + 9.6);

    y += 12.5;
    if (subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      setText(doc, pal.muted);
      const lines = doc.splitTextToSize(pdfSafe(subtitle), contentW - 5);
      doc.text(lines, marginX + 5, y + 2.5);
      y += lines.length * 3.8 + 2;
    }

    setStroke(doc, pal.border);
    doc.setLineWidth(0.25);
    doc.line(marginX, y + 1, pageW - marginX, y + 1);
    y += 5.5;
  };

  const stats = sectorStats(list);
  const g = globalStats(list);
  const cities = cityRanking(list, 8);
  const votedList = list.filter((c) => c.voto > 0);
  const avgVote = votedList.length
    ? (votedList.reduce((acc, c) => acc + c.voto, 0) / votedList.length).toFixed(2)
    : "—";

  // Descrizione perimetro filtri
  const filterParts: string[] = [];
  if (opts.scope === "filtrate") {
    if (ctx.activeSectors.length) {
      filterParts.push(
        `Settori: ${ctx.activeSectors.map((k) => SECTOR_MAP[k].short).join(", ")}`,
      );
    }
    if (ctx.activeStatuses.length) {
      filterParts.push(
        `Stati: ${ctx.activeStatuses.map((k) => STATUS_MAP[k].label).join(", ")}`,
      );
    }
    if (ctx.searchQuery.trim()) {
      filterParts.push(`Ricerca: "${ctx.searchQuery.trim()}"`);
    }
  }
  const scopeSummary =
    opts.scope === "tutte" || filterParts.length === 0
      ? `Archivio completo (${list.length} candidature)`
      : `Selezione filtrata (${list.length} su ${ctx.allCandidates.length}) · ${filterParts.join(" · ")}`;

  /* ========================================================================
   * BANNER DI TESTATA DEL DOSSIER (Pagina 1)
   * ======================================================================== */
  const bannerH = 38;
  setFill(doc, pal.headerBg);
  doc.roundedRect(marginX, 12, contentW, bannerH, 1.5, 1.5, "F");

  // Striscia cromatica dei 5 settori in alto sul banner
  const segW = contentW / SECTORS.length;
  SECTORS.forEach((s, idx) => {
    setFill(doc, hexToRgb(s.color));
    doc.rect(marginX + idx * segW, 12, segW, 2.2, "F");
  });

  // Tessere logo MOSAIC
  SECTORS.forEach((s, idx) => {
    setFill(doc, hexToRgb(s.color));
    doc.roundedRect(marginX + 6 + idx * 4.4, 18, 3.3, 3.3, 0.5, 0.5, "F");
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(236, 229, 216);
  doc.text("MOSAIC EXHIBITION ORCHESTRA", marginX + 30, 20.8);

  doc.setFont("courier", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(147, 163, 179);
  doc.text(pdfSafe(`GENERATO IL ${dateLabel.toUpperCase()}`), pageW - marginX - 6, 20.8, {
    align: "right",
  });

  // Titolo dossier
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16.5);
  doc.setTextColor(236, 229, 216);
  const titleLines = doc.splitTextToSize(pdfSafe(opts.title || FORM_TITLE), contentW - 12);
  doc.text(titleLines.slice(0, 2), marginX + 6, 29.5);

  // Sottotitolo + perimetro
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.3);
  doc.setTextColor(175, 188, 201);
  const subText = opts.subtitle ? `${opts.subtitle} — ${scopeSummary}` : scopeSummary;
  const subLines = doc.splitTextToSize(pdfSafe(subText), contentW - 12);
  doc.text(subLines.slice(0, 2), marginX + 6, titleLines.length > 1 ? 39.5 : 36);

  // Metadati in basso nel banner
  doc.setFont("courier", "normal");
  doc.setFontSize(7);
  doc.setTextColor(233, 162, 59);
  doc.text(
    pdfSafe(
      `MODULO: ${FORM_TITLE.toUpperCase()}  |  SETTORI COPERTI: ${g.settoriCoperti}/${SECTORS.length}  |  CITTA: ${g.citta}`,
    ),
    marginX + 6,
    46.8,
  );

  y = 56;

  if (list.length === 0) {
    setFill(doc, pal.cardBg);
    setStroke(doc, pal.border);
    doc.roundedRect(marginX, y, contentW, 34, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    setText(doc, pal.ink);
    doc.text("Nessuna candidatura disponibile per l'esportazione", marginX + contentW / 2, y + 15, {
      align: "center",
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setText(doc, pal.muted);
    doc.text(
      "Modifica i filtri attivi oppure importa nuove risposte nel cruscotto prima di generare il dossier.",
      marginX + contentW / 2,
      y + 22,
      { align: "center" },
    );
  } else {
    /* ======================================================================
     * SEZIONE 01 · SINTESI ESECUTIVA, MOSAICO E GEOGRAFIA
     * ====================================================================== */
    if (opts.includeSummary) {
      drawSectionHeading(
        "01",
        "Quadratura generale",
        " Indicatori chiave, avanzamento e distribuzione",
        "Fotografia sintetica del flusso di candidature, stato di lavorazione della segreteria e copertura geografica.",
      );

      // 6 KPI Cards su griglia
      const cols = opts.orientation === "landscape" ? 6 : 3;
      const gap = 3.2;
      const cardW = (contentW - gap * (cols - 1)) / cols;
      const cardH = 21;

      const kpis: { label: string; value: string; sub: string; color: RGB }[] = [
        {
          label: "CANDIDATURE",
          value: String(g.totale),
          sub: `${g.nuovi7} negli ultimi 7 giorni`,
          color: pal.ink,
        },
        {
          label: "ACCETTATE IN ROSA",
          value: String(g.accettati),
          sub: `${g.tassoAccettazione}% sul totale`,
          color: pal.ok,
        },
        {
          label: "AI PROVINI",
          value: String(g.provini),
          sub: "convocate all'ascolto",
          color: hexToRgb("#21b3a4"),
        },
        {
          label: "DA VALUTARE",
          value: String(g.inAttesa),
          sub: `attesa media ${g.etaMediaGiorni} gg`,
          color: hexToRgb("#e9a23b"),
        },
        {
          label: "VOTO MEDIO",
          value: avgVote === "—" ? "—" : `${avgVote}/5`,
          sub: `${votedList.length} schede valutate`,
          color: hexToRgb("#5f8fd9"),
        },
        {
          label: "COPERTURA CITTA",
          value: String(g.citta),
          sub: `${g.settoriCoperti} su ${SECTORS.length} settori attivi`,
          color: hexToRgb("#a9bf4a"),
        },
      ];

      kpis.forEach((k, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = marginX + col * (cardW + gap);
        const cy = y + row * (cardH + gap);

        setFill(doc, pal.cardBg);
        setStroke(doc, pal.border);
        doc.setLineWidth(0.25);
        doc.roundedRect(cx, cy, cardW, cardH, 1.2, 1.2, "FD");

        // Barra colore laterale
        setFill(doc, k.color);
        doc.rect(cx, cy, 1.4, cardH, "F");

        doc.setFont("courier", "bold");
        doc.setFontSize(6.6);
        setText(doc, pal.muted);
        doc.text(pdfSafe(k.label), cx + 4, cy + 5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(14.5);
        setText(doc, k.color);
        doc.text(pdfSafe(k.value), cx + 4, cy + 13);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.2);
        setText(doc, pal.subtle);
        doc.text(pdfSafe(k.sub), cx + 4, cy + 18);
      });

      const kpiRows = Math.ceil(kpis.length / cols);
      y += kpiRows * (cardH + gap) + 3;

      // Blocco a due colonne: Funnel di selezione + Top Città
      const splitGap = 4;
      const leftW = contentW * 0.56 - splitGap / 2;
      const rightW = contentW * 0.44 - splitGap / 2;
      const boxH = 56;
      ensureSpace(boxH + 4, "QUADRATURA GENERALE");

      // Box sinistro: Avanzamento nel processo (Funnel)
      setFill(doc, pal.cardBg);
      setStroke(doc, pal.border);
      doc.roundedRect(marginX, y, leftW, boxH, 1.2, 1.2, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      setText(doc, pal.ink);
      doc.text("Funnel di selezione", marginX + 4.5, y + 6.5);

      doc.setFont("courier", "normal");
      doc.setFontSize(6.8);
      setText(doc, pal.muted);
      doc.text("STATI DEL PROCESSO", pageW - marginX - rightW - splitGap - 4.5, y + 6.5, {
        align: "right",
      });

      let fy = y + 12.5;
      STATUSES.forEach((st) => {
        const count = list.filter((c) => c.stato === st.key).length;
        const ratio = pct(count, list.length);
        const barMaxW = leftW - 48;
        const stRgb = hexToRgb(st.tone);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.8);
        setText(doc, pal.ink);
        doc.text(pdfSafe(st.label), marginX + 4.5, fy + 2.6);

        // Track
        setFill(doc, pal.cardAltBg);
        doc.roundedRect(marginX + 34, fy, barMaxW, 3.4, 0.6, 0.6, "F");
        // Fill
        if (count > 0) {
          setFill(doc, stRgb);
          doc.roundedRect(
            marginX + 34,
            fy,
            Math.max(1.8, (ratio / 100) * barMaxW),
            3.4,
            0.6,
            0.6,
            "F",
          );
        }

        doc.setFont("courier", "bold");
        doc.setFontSize(7.2);
        setText(doc, pal.muted);
        doc.text(`${count} (${ratio}%)`, marginX + leftW - 4.5, fy + 2.7, { align: "right" });

        fy += 7.0;
      });

      // Box destro: Principali Città
      const rx = marginX + leftW + splitGap;
      setFill(doc, pal.cardBg);
      setStroke(doc, pal.border);
      doc.roundedRect(rx, y, rightW, boxH, 1.2, 1.2, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      setText(doc, pal.ink);
      doc.text("Principali provenienze", rx + 4.5, y + 6.5);

      doc.setFont("courier", "normal");
      doc.setFontSize(6.8);
      setText(doc, pal.muted);
      doc.text(`TOP ${Math.min(6, cities.length)} CITTA`, rx + rightW - 4.5, y + 6.5, {
        align: "right",
      });

      const topCities = cities.slice(0, 6);
      const maxCityCount = Math.max(1, ...topCities.map((c) => c.n));
      let cyCity = y + 12.5;

      topCities.forEach((ct, idx) => {
        const barAreaW = rightW - 44;
        const cColor = hexToRgb(SECTORS[idx % SECTORS.length].color);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.8);
        setText(doc, pal.ink);
        doc.text(pdfSafe(ct.citta.slice(0, 15)), rx + 4.5, cyCity + 2.6);

        setFill(doc, pal.cardAltBg);
        doc.roundedRect(rx + 29, cyCity, barAreaW, 3.4, 0.6, 0.6, "F");
        setFill(doc, cColor);
        doc.roundedRect(
          rx + 29,
          cyCity,
          Math.max(2, (ct.n / maxCityCount) * barAreaW),
          3.4,
          0.6,
          0.6,
          "F",
        );

        doc.setFont("courier", "bold");
        doc.setFontSize(7.2);
        setText(doc, pal.muted);
        const accTxt = ct.acc > 0 ? ` · ${ct.acc} ok` : "";
        doc.text(pdfSafe(`${ct.n}${accTxt}`), rx + rightW - 4.5, cyCity + 2.7, {
          align: "right",
        });

        cyCity += 7.0;
      });

      y += boxH + 5;

      // Mappa visiva a tessere del Mosaico (fino a 180 tessere)
      const tileSize = 3.1;
      const tileGap = 1.0;
      const maxTilesPerRow = Math.floor((contentW - 9) / (tileSize + tileGap));
      const tilesToDraw = list.slice(0, maxTilesPerRow * 4);
      const mosaicRows = Math.max(1, Math.ceil(tilesToDraw.length / maxTilesPerRow));
      const mosaicBoxH = 13 + mosaicRows * (tileSize + tileGap) + 3;

      if (y + mosaicBoxH <= bottomLimit) {
        setFill(doc, pal.cardBg);
        setStroke(doc, pal.border);
        doc.roundedRect(marginX, y, contentW, mosaicBoxH, 1.2, 1.2, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.8);
        setText(doc, pal.ink);
        doc.text("Mappa visiva delle tessere per settore", marginX + 4.5, y + 6);

        doc.setFont("courier", "normal");
        doc.setFontSize(6.8);
        setText(doc, pal.muted);
        const tileNote =
          list.length > tilesToDraw.length
            ? `PRIME ${tilesToDraw.length} DI ${list.length} CANDIDATURE`
            : `${tilesToDraw.length} TESSERE TOTALI`;
        doc.text(tileNote, pageW - marginX - 4.5, y + 6, { align: "right" });

        tilesToDraw.forEach((cand, idx) => {
          const r = Math.floor(idx / maxTilesPerRow);
          const col = idx % maxTilesPerRow;
          const tx = marginX + 4.5 + col * (tileSize + tileGap);
          const ty = y + 9.5 + r * (tileSize + tileGap);
          const base = hexToRgb(SECTOR_MAP[cand.settore].color);
          const tone =
            cand.stato === "accettato"
              ? base
              : cand.stato === "escluso"
                ? mixRgb(base, pal.cardBg, 0.78)
                : cand.stato === "nuovo"
                  ? mixRgb(base, pal.cardBg, 0.45)
                  : mixRgb(base, pal.cardBg, 0.2);
          setFill(doc, tone);
          doc.roundedRect(tx, ty, tileSize, tileSize, 0.4, 0.4, "F");
        });

        y += mosaicBoxH + 6;
      }
    }

    /* ======================================================================
     * SEZIONE 02 · ANALISI DETTAGLIATA PER SETTORE
     * ====================================================================== */
    if (opts.includeSectors) {
      if (opts.includeSummary && y > topY + 40) {
        y = addFreshPage("RISULTATI PER SETTORE");
      }
      drawSectionHeading(
        "02",
        "Risultati per settore",
        "Confronto analitico dei cinque linguaggi artistici",
        "Ripartizione dei volumi, avanzamento nel filtro di selezione, voto medio espresso dalla commissione e copertura territoriale.",
      );

      // Barra impilata proporzionale globale dei settori
      ensureSpace(22, "RISULTATI PER SETTORE");
      setFill(doc, pal.cardBg);
      setStroke(doc, pal.border);
      doc.roundedRect(marginX, y, contentW, 19, 1.2, 1.2, "FD");

      doc.setFont("courier", "bold");
      doc.setFontSize(6.8);
      setText(doc, pal.muted);
      doc.text("PESO PERCENTUALE DEI SETTORI SUL TOTALE CANDIDATURE", marginX + 4.5, y + 5);

      let barX = marginX + 4.5;
      const fullBarW = contentW - 9;
      stats.forEach((st) => {
        if (st.totale <= 0) return;
        const w = (st.totale / list.length) * fullBarW;
        setFill(doc, hexToRgb(SECTOR_MAP[st.key].color));
        doc.rect(barX, y + 7.2, w, 4.5, "F");
        barX += w;
      });

      // Legenda compatta sotto la barra
      let lx = marginX + 4.5;
      stats.forEach((st) => {
        const meta = SECTOR_MAP[st.key];
        setFill(doc, hexToRgb(meta.color));
        doc.rect(lx, y + 13.8, 2.2, 2.2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        setText(doc, pal.ink);
        const txt = `${meta.short}: ${st.totale} (${pct(st.totale, list.length)}%)`;
        doc.text(pdfSafe(txt), lx + 3.2, y + 15.7);
        lx += doc.getTextWidth(txt) + 8.5;
      });

      y += 23.5;

      // Scheda orizzontale per ciascuno dei 5 settori
      const sectorCardH = 26.5;
      stats.forEach((s) => {
        ensureSpace(sectorCardH + 3, "RISULTATI PER SETTORE");
        const meta = SECTOR_MAP[s.key];
        const sColor = hexToRgb(meta.color);

        setFill(doc, pal.cardBg);
        setStroke(doc, pal.border);
        doc.roundedRect(marginX, y, contentW, sectorCardH, 1.2, 1.2, "FD");

        // Banda colore settore
        setFill(doc, sColor);
        doc.rect(marginX, y, 2.4, sectorCardH, "F");

        // Intestazione settore
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        setText(doc, pal.ink);
        doc.text(pdfSafe(meta.label), marginX + 6, y + 6.5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        setText(doc, pal.muted);
        doc.text(pdfSafe(meta.blurb), marginX + 6, y + 11);

        // Numeri chiave a destra
        const metrics: [string, string][] = [
          ["TESSERE", `${s.totale} (${pct(s.totale, list.length)}%)`],
          ["ACCOLTE", `${s.accettati} (${s.tasso}%)`],
          ["CONTATTATE+", `${s.contattoTasso}%`],
          ["IN ATTESA", String(s.inAttesa)],
          ["VOTO MEDIO", s.votoMedio ? `${s.votoMedio}/5` : "—"],
          ["CITTA", String(s.cittaUniche)],
        ];

        const metricsStartX = marginX + contentW * 0.36;
        const mColW = (contentW * 0.64 - 4) / metrics.length;
        metrics.forEach(([mLabel, mVal], idx) => {
          const mx = metricsStartX + idx * mColW;
          doc.setFont("courier", "normal");
          doc.setFontSize(6.2);
          setText(doc, pal.muted);
          doc.text(mLabel, mx, y + 5.8);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.8);
          setText(doc, idx === 0 ? sColor : pal.ink);
          doc.text(pdfSafe(mVal), mx, y + 10.8);
        });

        // Mini barra funnel di settore nella parte bassa della card
        const fBarX = marginX + 6;
        const fBarW = contentW - 10.5;
        const fBarY = y + 15;
        setFill(doc, pal.cardAltBg);
        doc.roundedRect(fBarX, fBarY, fBarW, 3.2, 0.5, 0.5, "F");

        if (s.totale > 0) {
          let curX = fBarX;
          STATUSES.forEach((st) => {
            const n = s.funnel[st.key];
            if (!n) return;
            const segWidth = (n / s.totale) * fBarW;
            setFill(doc, hexToRgb(st.tone));
            doc.rect(curX, fBarY, segWidth, 3.2, "F");
            curX += segWidth;
          });
        }

        // Dettaglio numerico stati sotto la barra
        let stTextX = fBarX;
        STATUSES.forEach((st) => {
          const n = s.funnel[st.key];
          setFill(doc, hexToRgb(st.tone));
          doc.circle(stTextX + 1, y + 22.1, 0.9, "F");
          doc.setFont("courier", "normal");
          doc.setFontSize(6.5);
          setText(doc, pal.muted);
          const lbl = `${st.label}: ${n}`;
          doc.text(pdfSafe(lbl), stTextX + 2.8, y + 22.9);
          stTextX += doc.getTextWidth(lbl) + 6.8;
        });

        y += sectorCardH + 3.2;
      });
    }

    // Raggruppamento delle candidature per Registro e Schede
    const buildGroups = (): { title: string; color: RGB; items: Candidate[] }[] => {
      if (opts.groupBy === "settore") {
        return SECTORS.map((s) => ({
          title: `${s.label} — ${s.blurb}`,
          color: hexToRgb(s.color),
          items: list.filter((c) => c.settore === s.key),
        })).filter((gItem) => gItem.items.length > 0);
      }
      if (opts.groupBy === "stato") {
        return STATUSES.map((st) => ({
          title: `Stato: ${st.label}`,
          color: hexToRgb(st.tone),
          items: list.filter((c) => c.stato === st.key),
        })).filter((gItem) => gItem.items.length > 0);
      }
      return [
        {
          title: "Elenco unico ordinato",
          color: pal.accent,
          items: list,
        },
      ];
    };

    const groups = buildGroups();

    /* ======================================================================
     * SEZIONE 03 · REGISTRO TABELLARE IMPAGINATO
     * ====================================================================== */
    if (opts.includeRegister) {
      if ((opts.includeSummary || opts.includeSectors) && y > topY + 25) {
        y = addFreshPage("REGISTRO CANDIDATURE");
      }
      drawSectionHeading(
        "03",
        "Registro candidature",
        `Tabella riepilogativa (${list.length} posizioni)`,
        opts.includeContacts
          ? "Elenco completo con riferimenti di contatto, città, settore artistico, stato di avanzamento e valutazione."
          : "Elenco con contatti oscurati (modalità riservata per condivisione esterna).",
      );

      // Definizione colonne dinamiche su contentW
      const isLand = opts.orientation === "landscape";
      const colsDef: {
        key: string;
        label: string;
        w: number;
        align?: "left" | "right" | "center";
      }[] = isLand
        ? [
            { key: "idx", label: "#", w: contentW * 0.04 },
            { key: "data", label: "DATA", w: contentW * 0.09 },
            { key: "nome", label: "CANDIDATO", w: contentW * 0.19 },
            {
              key: "contatti",
              label: opts.includeContacts ? "CONTATTI" : "FONTE",
              w: contentW * 0.22,
            },
            { key: "citta", label: "CITTA", w: contentW * 0.12 },
            { key: "settore", label: "SETTORE", w: contentW * 0.13 },
            { key: "stato", label: "STATO", w: contentW * 0.13 },
            { key: "voto", label: "VOTO", w: contentW * 0.08, align: "right" },
          ]
        : [
            { key: "idx", label: "#", w: contentW * 0.05 },
            { key: "data", label: "DATA", w: contentW * 0.11 },
            { key: "nome", label: "CANDIDATO", w: contentW * 0.24 },
            {
              key: "contatti",
              label: opts.includeContacts ? "MAIL / TEL" : "CITTA",
              w: contentW * 0.24,
            },
            { key: "settore", label: opts.includeContacts ? "CITTA · SETT." : "SETTORE", w: contentW * 0.16 },
            { key: "stato", label: "STATO", w: contentW * 0.13 },
            { key: "voto", label: "VOTO", w: contentW * 0.07, align: "right" },
          ];

      const drawTableHeader = () => {
        setFill(doc, pal.headerBg);
        doc.rect(marginX, y, contentW, 6.8, "F");
        doc.setFont("courier", "bold");
        doc.setFontSize(6.6);
        doc.setTextColor(236, 229, 216);

        let cx = marginX + 2;
        colsDef.forEach((col) => {
          if (col.align === "right") {
            doc.text(col.label, cx + col.w - 4, y + 4.5, { align: "right" });
          } else {
            doc.text(col.label, cx, y + 4.5);
          }
          cx += col.w;
        });
        y += 6.8;
      };

      let globalRowIndex = 0;

      groups.forEach((grp) => {
        ensureSpace(16, "REGISTRO CANDIDATURE");

        if (groups.length > 1) {
          setFill(doc, mixRgb(grp.color, pal.cardBg, 0.85));
          doc.rect(marginX, y, contentW, 6.4, "F");
          setFill(doc, grp.color);
          doc.rect(marginX, y, 2.2, 6.4, "F");

          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.2);
          setText(doc, pal.ink);
          doc.text(pdfSafe(grp.title), marginX + 4.5, y + 4.4);

          doc.setFont("courier", "bold");
          doc.setFontSize(7);
          setText(doc, pal.muted);
          doc.text(`${grp.items.length} schede`, pageW - marginX - 3, y + 4.4, {
            align: "right",
          });
          y += 6.4;
        }

        drawTableHeader();

        grp.items.forEach((c, rIdx) => {
          globalRowIndex += 1;
          const rowH = opts.includeContacts && (c.mail || c.telefono) ? 8.2 : 7.0;

          if (y + rowH > bottomLimit) {
            y = addFreshPage("REGISTRO CANDIDATURE");
            drawTableHeader();
          }

          setFill(doc, rIdx % 2 === 0 ? pal.cardBg : pal.cardAltBg);
          doc.rect(marginX, y, contentW, rowH, "F");
          setStroke(doc, pal.border);
          doc.setLineWidth(0.15);
          doc.line(marginX, y + rowH, marginX + contentW, y + rowH);

          const sMeta = SECTOR_MAP[c.settore];
          const stMeta = STATUS_MAP[c.stato];
          let cx = marginX + 2;

          colsDef.forEach((col) => {
            const maxTextW = col.w - 3;
            const midY = y + rowH / 2 + 1.1;

            if (col.key === "idx") {
              doc.setFont("courier", "normal");
              doc.setFontSize(6.8);
              setText(doc, pal.subtle);
              doc.text(String(globalRowIndex).padStart(2, "0"), cx, midY);
            } else if (col.key === "data") {
              doc.setFont("courier", "normal");
              doc.setFontSize(7);
              setText(doc, pal.muted);
              doc.text(pdfSafe(fmtDate(c.timestamp)), cx, midY);
            } else if (col.key === "nome") {
              doc.setFont("helvetica", "bold");
              doc.setFontSize(8);
              setText(doc, pal.ink);
              const nameLine = doc.splitTextToSize(pdfSafe(c.nome), maxTextW)[0] ?? "";
              doc.text(nameLine, cx, opts.includeNotes && c.note ? y + 3.5 : midY);
              if (opts.includeNotes && c.note) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(6.3);
                setText(doc, pal.muted);
                const noteShort = doc.splitTextToSize(`Nota: ${pdfSafe(c.note)}`, maxTextW)[0] ?? "";
                doc.text(noteShort, cx, y + 6.8);
              }
            } else if (col.key === "contatti") {
              if (opts.includeContacts) {
                doc.setFont("courier", "normal");
                doc.setFontSize(6.6);
                setText(doc, pal.ink);
                const mailTxt = doc.splitTextToSize(pdfSafe(c.mail || "—"), maxTextW)[0] ?? "—";
                if (c.telefono) {
                  doc.text(mailTxt, cx, y + 3.4);
                  setText(doc, pal.muted);
                  const telTxt = doc.splitTextToSize(pdfSafe(c.telefono), maxTextW)[0] ?? "";
                  doc.text(telTxt, cx, y + 6.7);
                } else {
                  doc.text(mailTxt, cx, midY);
                }
              } else {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(7.4);
                setText(doc, pal.muted);
                const val = isLand ? c.fonte : c.citta;
                doc.text(doc.splitTextToSize(pdfSafe(val), maxTextW)[0] ?? "", cx, midY);
              }
            } else if (col.key === "citta") {
              doc.setFont("helvetica", "normal");
              doc.setFontSize(7.5);
              setText(doc, pal.ink);
              doc.text(doc.splitTextToSize(pdfSafe(c.citta), maxTextW)[0] ?? "", cx, midY);
            } else if (col.key === "settore") {
              setFill(doc, hexToRgb(sMeta.color));
              if (!isLand && opts.includeContacts) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(7.1);
                setText(doc, pal.ink);
                doc.text(doc.splitTextToSize(pdfSafe(c.citta), maxTextW)[0] ?? "", cx, y + 3.4);
                doc.rect(cx, y + 4.7, 1.8, 1.8, "F");
                doc.setFont("courier", "bold");
                doc.setFontSize(6.4);
                setText(doc, pal.muted);
                doc.text(pdfSafe(sMeta.short.toUpperCase()), cx + 2.6, y + 6.3);
              } else {
                doc.rect(cx, midY - 2.1, 2, 2, "F");
                doc.setFont("courier", "bold");
                doc.setFontSize(6.8);
                setText(doc, pal.ink);
                doc.text(pdfSafe(sMeta.short.toUpperCase()), cx + 3, midY);
              }
            } else if (col.key === "stato") {
              const stColor = hexToRgb(stMeta.tone);
              setFill(doc, mixRgb(stColor, pal.cardBg, 0.82));
              const pillW = Math.min(maxTextW, doc.getTextWidth(stMeta.label.toUpperCase()) * 0.82 + 5);
              doc.roundedRect(cx, midY - 2.9, pillW, 4.1, 0.6, 0.6, "F");
              setFill(doc, stColor);
              doc.circle(cx + 1.8, midY - 0.85, 0.7, "F");
              doc.setFont("courier", "bold");
              doc.setFontSize(6.2);
              setText(doc, stColor);
              doc.text(pdfSafe(stMeta.label.toUpperCase()), cx + 3.3, midY);
            } else if (col.key === "voto") {
              doc.setFont("courier", "bold");
              doc.setFontSize(7.2);
              setText(doc, c.voto > 0 ? pal.accent : pal.subtle);
              const vTxt = c.voto > 0 ? `${c.voto}/5` : "—";
              doc.text(vTxt, cx + col.w - 4, midY, { align: "right" });
            }

            cx += col.w;
          });

          y += rowH;
        });

        y += 5;
      });
    }

    /* ======================================================================
     * SEZIONE 04 · SCHEDE INDIVIDUALI IMPAGINATE (BIO + NOTE COMMISSIONE)
     * ====================================================================== */
    if (opts.includeCards) {
      if ((opts.includeSummary || opts.includeSectors || opts.includeRegister) && y > topY + 25) {
        y = addFreshPage("SCHEDE CANDIDATI");
      }
      drawSectionHeading(
        "04",
        "Schede individuali",
        "Profili completi, presentazioni e note di commissione",
        "Schede di lettura impaginate per le audizioni e il lavoro di segreteria, complete del testo libero inviato dal candidato.",
      );

      const cols = opts.orientation === "landscape" ? 2 : 1;
      const colGap = 4;
      const cardW = (contentW - colGap * (cols - 1)) / cols;

      const measureAndDrawCard = (c: Candidate, x: number, top: number, dryRun: boolean): number => {
        const innerW = cardW - 10;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.2);
        const bioText = c.presentazione
          ? pdfSafe(c.presentazione)
          : "Nessuna presentazione testuale inserita nel modulo.";
        const bioLines: string[] = doc.splitTextToSize(bioText, innerW - 3).slice(0, 6);

        let noteLines: string[] = [];
        if (opts.includeNotes && c.note.trim()) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(7.6);
          noteLines = doc.splitTextToSize(`Nota segreteria: ${pdfSafe(c.note)}`, innerW - 4).slice(0, 3);
        }

        const headerPart = opts.includeContacts ? 15.5 : 11.5;
        const bioH = Math.max(5, bioLines.length * 3.7) + 2;
        const noteH = noteLines.length > 0 ? noteLines.length * 3.5 + 4.5 : 0;
        const totalH = headerPart + bioH + noteH + 4.5;

        if (dryRun) return totalH;

        const meta = SECTOR_MAP[c.settore];
        const stMeta = STATUS_MAP[c.stato];
        const sColor = hexToRgb(meta.color);
        const stColor = hexToRgb(stMeta.tone);

        setFill(doc, pal.cardBg);
        setStroke(doc, pal.border);
        doc.setLineWidth(0.25);
        doc.roundedRect(x, top, cardW, totalH, 1.2, 1.2, "FD");

        // Barra settore a sinistra
        setFill(doc, sColor);
        doc.rect(x, top, 2.2, totalH, "F");

        // Settore + Data
        doc.setFont("courier", "bold");
        doc.setFontSize(6.6);
        setText(doc, sColor);
        doc.text(pdfSafe(`${meta.label} · ${c.citta.toUpperCase()}`), x + 5, top + 4.8);

        // Pill stato in alto a destra
        doc.setFont("courier", "bold");
        doc.setFontSize(6.3);
        const stLabel = pdfSafe(stMeta.label.toUpperCase());
        const pillW = doc.getTextWidth(stLabel) + 5.5;
        setFill(doc, mixRgb(stColor, pal.cardBg, 0.84));
        doc.roundedRect(x + cardW - pillW - 3.5, top + 2.2, pillW, 4.2, 0.7, 0.7, "F");
        setText(doc, stColor);
        doc.text(stLabel, x + cardW - 3.5 - pillW / 2, top + 5.0, { align: "center" });

        // Nome candidato + Pallini voto
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        setText(doc, pal.ink);
        const maxNameW = cardW - 36;
        const nameLine = doc.splitTextToSize(pdfSafe(c.nome), maxNameW)[0] ?? "";
        doc.text(nameLine, x + 5, top + 10.2);

        drawRatingDots(doc, x + cardW - 18.5, top + 9.2, c.voto, pal.accent, pal.border);

        let curY = top + 13.5;

        // Riga contatti
        if (opts.includeContacts) {
          doc.setFont("courier", "normal");
          doc.setFontSize(6.8);
          setText(doc, pal.muted);
          const contactParts = [
            c.mail ? pdfSafe(c.mail) : null,
            c.telefono ? pdfSafe(c.telefono) : null,
            `Inviata: ${pdfSafe(fmtDate(c.timestamp, true))}`,
          ].filter(Boolean);
          const contactLine = doc.splitTextToSize(contactParts.join("  ·  "), innerW)[0] ?? "";
          doc.text(contactLine, x + 5, curY + 1.5);
          curY += 4.5;
        }

        // Linea divisoria sottile
        setStroke(doc, pal.border);
        doc.setLineWidth(0.18);
        doc.line(x + 5, curY, x + cardW - 4, curY);
        curY += 3.8;

        // Presentazione / "Raccontaci chi sei"
        setFill(doc, mixRgb(sColor, pal.cardBg, 0.55));
        doc.rect(x + 5, curY - 2.6, 0.9, bioLines.length * 3.7, "F");

        doc.setFont("helvetica", c.presentazione ? "normal" : "italic");
        doc.setFontSize(8.2);
        setText(doc, c.presentazione ? pal.ink : pal.subtle);
        doc.text(bioLines, x + 7.5, curY);
        curY += bioLines.length * 3.7 + 1.5;

        // Note segreteria
        if (noteLines.length > 0) {
          const nBoxH = noteLines.length * 3.5 + 3;
          setFill(doc, pal.cardAltBg);
          doc.roundedRect(x + 5, curY - 1, innerW, nBoxH, 0.8, 0.8, "F");
          doc.setFont("helvetica", "italic");
          doc.setFontSize(7.5);
          setText(doc, pal.muted);
          doc.text(noteLines, x + 7, curY + 2);
        }

        return totalH;
      };

      groups.forEach((grp) => {
        ensureSpace(24, "SCHEDE CANDIDATI");

        if (groups.length > 1) {
          setFill(doc, mixRgb(grp.color, pal.cardBg, 0.85));
          doc.roundedRect(marginX, y, contentW, 6.8, 0.8, 0.8, "F");
          setFill(doc, grp.color);
          doc.rect(marginX, y, 2.4, 6.8, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          setText(doc, pal.ink);
          doc.text(pdfSafe(grp.title), marginX + 5, y + 4.7);
          doc.setFont("courier", "bold");
          doc.setFontSize(7);
          setText(doc, pal.muted);
          doc.text(`${grp.items.length} profili`, pageW - marginX - 3.5, y + 4.7, {
            align: "right",
          });
          y += 9.5;
        }

        if (cols === 1) {
          grp.items.forEach((cand) => {
            const h = measureAndDrawCard(cand, marginX, y, true);
            ensureSpace(h + 3, "SCHEDE CANDIDATI");
            measureAndDrawCard(cand, marginX, y, false);
            y += h + 3;
          });
        } else {
          for (let i = 0; i < grp.items.length; i += 2) {
            const cLeft = grp.items[i];
            const cRight = grp.items[i + 1];
            const hLeft = measureAndDrawCard(cLeft, marginX, y, true);
            const hRight = cRight ? measureAndDrawCard(cRight, marginX + cardW + colGap, y, true) : 0;
            const rowMaxH = Math.max(hLeft, hRight);

            ensureSpace(rowMaxH + 3.2, "SCHEDE CANDIDATI");
            measureAndDrawCard(cLeft, marginX, y, false);
            if (cRight) {
              measureAndDrawCard(cRight, marginX + cardW + colGap, y, false);
            }
            y += rowMaxH + 3.2;
          }
        }

        y += 3;
      });
    }
  }

  /* ========================================================================
   * INTESTAZIONI CORRENTI (pag. 2+) E PIE DI PAGINA CON NUMERAZIONE N / TOT
   * ======================================================================== */
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Intestazione corrente per le pagine successive alla prima
    if (p > 1) {
      setStroke(doc, pal.border);
      doc.setLineWidth(0.25);
      doc.line(marginX, 14.5, pageW - marginX, 14.5);

      SECTORS.forEach((s, idx) => {
        setFill(doc, hexToRgb(s.color));
        doc.rect(marginX + idx * 3.1, 9.6, 2.3, 2.3, "F");
      });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setText(doc, pal.ink);
      doc.text("MOSAIC", marginX + 17.5, 11.6);

      doc.setFont("courier", "normal");
      doc.setFontSize(6.8);
      setText(doc, pal.muted);
      doc.text(pdfSafe(`· ${opts.title || FORM_TITLE}`), marginX + 30, 11.6);

      doc.setFont("courier", "bold");
      doc.setFontSize(6.8);
      setText(doc, pal.accent);
      doc.text(pdfSafe(pageSections[p - 1] ?? ""), pageW - marginX, 11.6, { align: "right" });
    }

    // Piè di pagina su tutte le pagine
    const footY = pageH - 7.5;
    setStroke(doc, pal.border);
    doc.setLineWidth(0.22);
    doc.line(marginX, footY - 3.5, pageW - marginX, footY - 3.5);

    doc.setFont("courier", "normal");
    doc.setFontSize(6.8);
    setText(doc, pal.muted);
    doc.text(
      pdfSafe(`MOSAIC · ${FORM_TITLE} · Generato in locale il ${dateLabel}`),
      marginX,
      footY,
    );

    doc.setFont("courier", "bold");
    doc.setFontSize(7);
    setText(doc, pal.ink);
    doc.text(`PAGINA ${p} DI ${totalPages}`, pageW - marginX, footY, { align: "right" });
  }

  return doc;
}

  export function savePdfReport(ctx: PdfGenerationContext, filename?: string): { pages: number; file: string } {
  const doc = buildPdfDocument(ctx);
  const dateSlug = new Date().toISOString().slice(0, 10);
  const scopeSlug = ctx.options.scope === "filtrate" && ctx.candidates.length !== ctx.allCandidates.length
    ? "selezione"
    : "completo";
  const finalName = filename || `mosaic-dossier-${scopeSlug}-${dateSlug}.pdf`;
  doc.save(finalName);
  return { pages: doc.getNumberOfPages(), file: finalName };
}

/** Esporta in un PDF dedicato la scheda singola di un candidato. */
export function saveSingleCandidatePdf(c: Candidate): { file: string } {
  const slug = c.nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const file = `mosaic-scheda-${slug || c.id.slice(0, 8)}.pdf`;
  const doc = buildPdfDocument({
    candidates: [c],
    allCandidates: [c],
    activeSectors: [],
    activeStatuses: [],
    searchQuery: "",
    options: {
      ...DEFAULT_PDF_OPTIONS,
      title: `Scheda Candidato · ${c.nome}`,
      subtitle: `${SECTOR_MAP[c.settore].label} · ${c.citta} · Stato: ${STATUS_MAP[c.stato].label}`,
      scope: "filtrate",
      orientation: "portrait",
      groupBy: "cronologico",
      includeSummary: false,
      includeSectors: false,
      includeRegister: false,
      includeCards: true,
      includeContacts: true,
      includeNotes: true,
      theme: "editoriale",
    },
  });
  doc.save(file);
  return { file };
}

export function createPdfPreviewUrl(ctx: PdfGenerationContext): { url: string; pages: number } {
  const doc = buildPdfDocument(ctx);
  const blob = doc.output("blob");
  return {
    url: URL.createObjectURL(blob),
    pages: doc.getNumberOfPages(),
  };
}
