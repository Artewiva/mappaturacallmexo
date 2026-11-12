import {
  Candidate,
  SectorKey,
  StatusKey,
  sectorFromText,
  statusFromText,
  uid,
  SECTORS,
} from "./model";

/* ------------------------------------------------------------------ CSV core */

/** Delimitatore automatico (Google Forms esporta in CSV con virgole, Sheets in EU a volte ;). */
function detectDelimiter(sample: string) {
  const line = sample.split(/\r?\n/)[0] || "";
  const counts: Record<string, number> = {
    ",": (line.match(/,/g) || []).length,
    ";": (line.match(/;/g) || []).length,
    "\t": (line.match(/\t/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ",";
}

/** Parser CSV RFC-4180: supporta campi quotati, virgolette escape e CRLF. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "");
  const delim = detectDelimiter(clean);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

function pick(headers: string[], keys: string[]) {
  for (let i = 0; i < headers.length; i++) {
    const h = norm(headers[i]);
    if (keys.some((k) => h === k || h.includes(k))) return i;
  }
  return -1;
}

function parseTimestamp(raw: string, fallbackDays: number): string {
  const v = (raw || "").trim();
  if (v) {
    // export Google in italiano: 12/03/2026 18:42:11  →  giorno prima del mese
    const it = v.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2}))?/);
    if (it) {
      const a = +it[1];
      const b = +it[2];
      // il modulo è in italiano: giorno prima del mese, a meno che il secondo numero
      // non possa essere un mese (in quel caso l'export è in formato US)
      const us = b > 12 && a <= 12;
      const day = us ? b : a;
      const month = us ? a : b;
      const y = it[3].length === 2 ? 2000 + +it[3] : +it[3];
      const m = Math.max(1, Math.min(12, month)) - 1;
      const d = new Date(y, m, Math.min(31, Math.max(1, day)), +(it[4] || 9), +(it[5] || 0));
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    // ISO (colonna "Stato" esportata da Sheets, o fogli in formato EN-US)
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
      const iso = Date.parse(v.replace(" ", "T"));
      if (!Number.isNaN(iso)) return new Date(iso).toISOString();
    }
    // ultimi tentativi: 14 Mar 2026, timestamp unix, ecc.
    if (/^(\d{1,2})-([a-z]{3,})-(\d{2,4})$/i.test(v)) {
      const iso = Date.parse(v);
      if (!Number.isNaN(iso)) return new Date(iso).toISOString();
    }
    const unix = Number(v);
    if (Number.isFinite(unix) && unix > 1_000_000_000)
      return new Date(unix * (v.length > 12 ? 1 : 1000)).toISOString();
  }
  return new Date(Date.now() - fallbackDays * 86_400_000).toISOString();
}

/** Converte un CSV di risposte (export Google Forms / foglio collegato) in Candidate[]. */
export function candidatesFromCsv(text: string, fonte: Candidate["fonte"] = "csv"): Candidate[] {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("Il file non contiene righe di risposta.");
  const headers = rows[0];
  const idx = {
    ts: pick(headers, ["timestamp", "data", "orario", "time"]),
    nome: pick(headers, ["nomeecognome", "nome", "cognome", "fullname", "partecipante"]),
    mail: pick(headers, ["mail", "email", "posta"]),
    tel: pick(headers, ["telefono", "cellulare", "numero", "phone", "whatsapp"]),
    citta: pick(headers, ["citta", "city", "localita", "provincia"]),
    cat: pick(headers, ["categoria", "settore", "sector", "category", "ruolo", "linguaggio"]),
    bio: pick(headers, ["raccontaci", "presentati", "bio", "about", "descrizione", "motivazione"]),
    stato: pick(headers, ["stato", "status", "esito", "fasedelselettivo"]),
    voto: pick(headers, ["voto", "punteggio", "score", "rating", "giudizio"]),
    note: pick(headers, ["note", "annotazioni", "commenti", "noteinterne"]),
  };
  const out: Candidate[] = [];
  rows.slice(1).forEach((r, i) => {
    const get = (n: number) => (n >= 0 ? (r[n] ?? "").trim() : "");
    const nome = get(idx.nome) || `Anonimo ${i + 1}`;
    const rawCat = get(idx.cat);
    const first = idx.nome >= 0 ? idx.nome : 1;
    // se non c'è una colonna nome, usa la prima colonna libera come identificativo
    const name = idx.nome >= 0 ? nome : get(first) || `Anonimo ${i + 1}`;
    const votoRaw = parseInt(get(idx.voto).replace(",", "."), 10);
    out.push({
      id: uid(),
      timestamp: parseTimestamp(get(idx.ts), 60 - Math.floor(i / 3)),
      nome: name.replace(/\s+/g, " ").slice(0, 60),
      mail: get(idx.mail),
      telefono: get(idx.tel),
      citta: get(idx.citta) || "n.d.",
      settore: sectorFromText(rawCat),
      presentazione: get(idx.bio),
      stato: statusFromText(get(idx.stato)),
      voto: Number.isFinite(votoRaw) ? Math.max(0, Math.min(5, votoRaw)) : 0,
      note: get(idx.note),
      fonte,
    });
  });
  if (!out.length) throw new Error("Nessuna risposta riconosciuta nel file.");
  return out.reverse();
}

export function toCsv(list: Candidate[]): string {
  const head = [
    "Timestamp",
    "NOME E COGNOME",
    "MAIL",
    "TELEFONO",
    "CITTÀ",
    "CATEGORIA",
    "RACCONTACI CHI SEI",
    "STATO",
    "VOTO",
    "NOTE",
  ];
  const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = list.map((c) =>
    [
      new Date(c.timestamp).toLocaleString("it-IT"),
      c.nome,
      c.mail,
      c.telefono,
      c.citta,
      SECTORS.find((s) => s.key === c.settore)?.label ?? "ALTRO",
      c.presentazione.replace(/\s+/g, " "),
      c.stato,
      String(c.voto),
      c.note,
    ]
      .map(esc)
      .join(","),
  );
  return [head.map(esc).join(","), ...body].join("\n");
}

export function download(name: string, content: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

/* ------------------------------------------- Lettura da foglio Google pubblicato */

/** Accetta URL di "Pubblica sul web" (CSV) o link foglio: converte in endpoint gviz. */
export function normalizeSheetUrl(url: string) {
  const u = url.trim();
  const spid = u.match(/\/spreadsheets\/(?:d\/)?(?:e\/)?([a-zA-Z0-9-_]+)/)?.[1];
  const gid = u.match(/[#&?]gid=(\d+)/)?.[1] ?? "0";
  if (spid && /docs\.google\.com/.test(u)) {
    if (/output=(csv|tsv)/.test(u)) return u;
    return `https://docs.google.com/spreadsheets/d/e/${spid}/pub?gid=${gid}&single=true&output=csv`;
  }
  return u;
}

export async function fetchSheet(url: string): Promise<Candidate[]> {
  const target = normalizeSheetUrl(url);
  const res = await fetch(target, { redirect: "follow" });
  if (!res.ok) throw new Error(`Il foglio ha risposto ${res.status}.`);
  const text = await res.text();
  if (/<html/i.test(text.slice(0, 200)))
    throw new Error("L'URL restituisce una pagina HTML: pubblica il foglio su web come CSV.");
  return candidatesFromCsv(text, "foglio");
}

/* ------------------------------------------------------- Dataset dimostrativo */

const NOMI = [
  "Giulia Ferrante","Matteo Bianchi","Aurora De Luca","Karim Haddad","Sofia Ricci","Luca Moretti",
  "Elena Costa","Davide Romano","Miriam Scalvi","Tommaso Greco","Nadia Ferrario","Pietro Amato",
  "Chiara Villani","Filippo Conti","Martina Longo","Youssef Barakat","Alice Gambino","Niccolò Pira",
  "Bianca Sanna","Edoardo Milani","Sara Colombo","Gabriele Orlando","Ilaria Rizzo","Marco Pellegrini",
  "Zoe D'Amico","Antonio Sechi","Valentina Fabbri","Lorenzo Bruni","Asia Carlozzi","Samuele Pinto",
  "Greta Tosi","Hassan Nasser","Ottavia Ferri","Daniele Sarti","Nicole Barone","Cristian Einaudi",
  "Rebecca Monti","Stefano Lanza","Asia Riva","Michele Girardi","Carlotta Esposito","Bruno Palomba",
  "Vittoria Neri","Elia Colombo","Farah Zein","Diego Fontana","Lucia Marra","Giacomo Tidei",
  "Nina Baudoin","Sebastiano Crudo","Olimpia Rossi","Alessio Gatti","Fatima Sule","Leonardo Firpo",
  "Beatrix Rota","Godfrey Onwuka","Viola Mancini","Tito Salvi","Penelope Lorusso","Ivan Petrov",
];

const CITTA = [
  "Milano","Torino","Bologna","Napoli","Roma","Firenze","Palermo","Trieste","Venezia","Bari",
  "Catania","Genova","Lecce","Trento","Parma","Cagliari","Ravenna","Urbino","Berlino","Lisbona",
  "Bruxelles","Amsterdam","Barcellona","Lione","Zagabria","Vienna",
];

const FRASI: Record<SectorKey, string[]> = {
  musicista: [
    "Viola nel quartetto Arkadia, da tre anni improvviso con elettronica su loop station.",
    "Formazione classica al Conservatorio, oggi scrivo musiche per cortometraggi e teatro civile.",
    "Contrabbassista jazz, ho suonato in formazioni itineranti per piazze e fabbriche dismesse.",
    "Trombettista, cerco contesti in cui l'orchestra non stia ferma dietro i leggii.",
  ],
  performer: [
    "Teatro fisico e acrobatica aerea, ho lavorato con due compagnie di strada in Francia.",
    "Danza contemporanea: mi interessa il rapporto fra respiro collettivo e partitura.",
    "Attrice e giocoliera, porto il corpo come strumento che sbaglia apposta.",
    "Coreografa, ricerca su rituali di gruppo e sincronia nel movimento.",
  ],
  dj: [
    "Produco ambient techno, ho un live A/V con reattore modulare e proiezioni reattive.",
    "DJ resident in un circolo ARCI, catalogo di field recording e musiche di protesta.",
    "Sound designer, realizzo impianti diffusi in multicanale per installazioni site specific.",
    "Live electronics e tromba processata, pubblico su netlabel indipendente.",
  ],
  visual: [
    "VJ dal 2016, uso TouchDesigner e una libreria di pellicole Super8 rielaborate.",
    "Mapping su architetture industriali, anche per concerti all'aperto.",
    "Fotografa di scena: documento orchestre e bande da quando esistevano ancora i flash.",
    "Motion designer, animo partiture grafiche sincronizzate con l'audio.",
  ],
  altro: [
    "Curatrice di festival, posso occuparmi di dramaturgy e rapporti con i luoghi.",
    "Liutaio: costruisco strumenti con materiali di recupero, cerco un linguaggio nuovo.",
    "Poeta e performer testuale, scrivo didascalie per ciò che non si vede.",
    "Lighting designer, arrivo dal teatro di figura e dal circo contemporaneo.",
  ],
};

const STATI_POOL: StatusKey[] = [
  "nuovo","nuovo","nuovo","valutato","valutato","contattato","provino","provino","accettato","escluso",
];

/** PRNG deterministico: dati demo stabili fra un reload e l'altro. */
function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeDemo(count = 112): Candidate[] {
  const rnd = mulberry(20260214);
  const pickOne = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
  // pesi di affluenza per settore (il form riceve più musicisti)
  const weights: [SectorKey, number][] = [
    ["musicista", 0.34],
    ["performer", 0.22],
    ["dj", 0.18],
    ["visual", 0.17],
    ["altro", 0.09],
  ];
  const out: Candidate[] = [];
  for (let i = 0; i < count; i++) {
    const r = rnd();
    let acc = 0;
    let settore: SectorKey = "altro";
    for (const [k, w] of weights) {
      acc += w;
      if (r <= acc) {
        settore = k;
        break;
      }
    }
    // i candidati più vecchi sono stati lavorati di più
    const giorniFa = Math.floor(rnd() * 84);
    const maturita = 1 - giorniFa / 84;
    let stato: StatusKey = pickOne(STATI_POOL);
    if (maturita < 0.3) stato = rnd() > 0.75 ? stato : "nuovo";
    if (maturita > 0.75 && rnd() > 0.55) stato = rnd() > 0.35 ? "accettato" : "provino";
    const nome = pickOne(NOMI);
    const cognomePart = nome.split(" ");
    const mail = `${cognomePart[0].toLowerCase().replace(/[^a-z]/g, "")}.${cognomePart[1]
      .toLowerCase()
      .replace(/[^a-z]/g, "")}${Math.floor(rnd() * 89) + 10}@${pickOne([
      "gmail.com",
      "outlook.it",
      "libero.it",
      "proton.me",
      "unimi.it",
    ])}`;
    out.push({
      id: uid() + i,
      timestamp: new Date(Date.now() - giorniFa * 86_400_000 - Math.floor(rnd() * 8) * 3_600_000)
        .toISOString(),
      nome,
      mail,
      telefono: `+39 ${300 + Math.floor(rnd() * 60)} ${Math.floor(rnd() * 90000000)
        .toString()
        .padStart(8, "0")}`,
      citta: pickOne(CITTA),
      settore,
      presentazione: pickOne(FRASI[settore]),
      stato,
      voto: stato === "nuovo" ? 0 : Math.min(5, 2 + Math.floor(rnd() * 4)),
      note: rnd() > 0.72 ? pickOne([
        "Da approfondire la disponibilità alle prove.",
        "Ha già esperienza con formazioni allargate.",
        "Da ricontattare: strumento raro nella rosa.",
        "Disponibile solo nel weekend.",
      ]) : "",
      fonte: "demo",
    });
  }
  return out.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
}
