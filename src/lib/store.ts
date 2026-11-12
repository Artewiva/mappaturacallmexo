import { useCallback, useEffect, useRef, useState } from "react";
import { Candidate, FUNNEL, SectorKey, STATUSES, StatusKey, pct, SECTORS } from "./model";
import { makeDemo } from "./data";

const KEY = "mosaic.dashboard.v1";

interface Persisted {
  candidates: Candidate[];
  sheetUrl: string;
  demo: boolean;
  savedAt: string;
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Persisted;
      if (Array.isArray(p.candidates))
        return {
          candidates: p.candidates,
          sheetUrl: p.sheetUrl ?? "",
          demo: p.demo ?? false,
          savedAt: p.savedAt ?? new Date().toISOString(),
        };
    }
  } catch {
    /* storage corrotto: si riparte dai dati dimostrativi */
  }
  return { candidates: makeDemo(), sheetUrl: "", demo: true, savedAt: new Date().toISOString() };
}

export function useStore() {
  const initial = useRef<Persisted | null>(null);
  if (!initial.current) initial.current = load();

  const [candidates, setCandidates] = useState<Candidate[]>(initial.current.candidates);
  const [sheetUrl, setSheetUrl] = useState(initial.current.sheetUrl);
  const [demo, setDemo] = useState(initial.current.demo);
  const [savedAt, setSavedAt] = useState(initial.current.savedAt);

  useEffect(() => {
    const t = setTimeout(() => {
      const payload: Persisted = { candidates, sheetUrl, demo, savedAt: new Date().toISOString() };
      try {
        localStorage.setItem(KEY, JSON.stringify(payload));
      } catch {
        /* quota locale esaurita: i dati restano comunque in memoria */
      }
      setSavedAt(payload.savedAt);
    }, 260);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, sheetUrl, demo]);

  const upsert = useCallback((patch: Partial<Candidate> & { id: string }) => {
    setDemo(false);
    setCandidates((prev) => prev.map((c) => (c.id === patch.id ? { ...c, ...patch } : c)));
  }, []);

  const addMany = useCallback((list: Candidate[]) => {
    setDemo(false);
    setCandidates(list);
  }, []);

  const addOne = useCallback((c: Candidate) => {
    setDemo(false);
    setCandidates((prev) => [c, ...prev]);
  }, []);

  const remove = useCallback((id: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const resetDemo = useCallback(() => {
    setDemo(true);
    setCandidates(makeDemo());
  }, []);

  const wipe = useCallback(() => {
    setDemo(false);
    setCandidates([]);
  }, []);

  return {
    candidates,
    sheetUrl,
    setSheetUrl,
    demo,
    savedAt,
    upsert,
    addMany,
    addOne,
    remove,
    resetDemo,
    wipe,
  };
}

export type Store = ReturnType<typeof useStore>;

/* --------------------------------------------------------------- Aggregazioni */

export interface SectorStats {
  key: SectorKey;
  totale: number;
  nuovi7: number;
  inAttesa: number;
  accettati: number;
  esclusi: number;
  tasso: number; // % accettazione
  votoMedio: number;
  contattoTasso: number; // % contattati+ (avanzati nel funnel)
  cittaUniche: number;
  funnel: Record<StatusKey, number>;
  serie: number[]; // nuove candidature per settimana (12 settimane)
}

const WEEKS = 12;

export function sectorStats(list: Candidate[]): SectorStats[] {
  const now = Date.now();
  return SECTORS.map((s) => {
    const mine = list.filter((c) => c.settore === s.key);
    const funnel = Object.fromEntries(STATUSES.map((st) => [st.key, 0])) as Record<StatusKey, number>;
    mine.forEach((c) => (funnel[c.stato] += 1));
    const serie = new Array(WEEKS).fill(0);
    let nuovi7 = 0;
    mine.forEach((c) => {
      const dt = new Date(c.timestamp).getTime();
      const weeksBack = Math.floor((now - dt) / (7 * 86_400_000));
      if (weeksBack >= 0 && weeksBack < WEEKS) serie[WEEKS - 1 - weeksBack] += 1;
      if (now - dt < 7 * 86_400_000) nuovi7 += 1;
    });
    const valutati = mine.filter((c) => c.voto > 0);
    return {
      key: s.key,
      totale: mine.length,
      nuovi7,
      inAttesa: funnel.nuovo + funnel.valutato,
      accettati: funnel.accettato,
      esclusi: funnel.escluso,
      tasso: pct(funnel.accettato, mine.length),
      votoMedio: valutati.length
        ? Math.round((valutati.reduce((a, c) => a + c.voto, 0) / valutati.length) * 10) / 10
        : 0,
      contattoTasso: pct(
        funnel.contattato + funnel.provino + funnel.accettato,
        mine.length,
      ),
      cittaUniche: new Set(mine.map((c) => c.citta.toLowerCase())).size,
      funnel,
      serie,
    };
  }).sort((a, b) => b.totale - a.totale);
}

export function globalStats(list: Candidate[]) {
  const now = Date.now();
  const nuovi7 = list.filter((c) => now - new Date(c.timestamp).getTime() < 7 * 86_400_000).length;
  const Accepted = list.filter((c) => c.stato === "accettato").length;
  const inAttesa = list.filter((c) => c.stato === "nuovo").length;
  const provini = list.filter((c) => c.stato === "provino").length;
  const serie = new Array(WEEKS).fill(0).map((_, i) => {
    const start = now - (WEEKS - i) * 7 * 86_400_000;
    const end = start + 7 * 86_400_000;
    return list.filter((c) => {
      const t = new Date(c.timestamp).getTime();
      return t >= start && t < end;
    }).length;
  });
  const labelSerie = new Array(WEEKS).fill(0).map((_, i) => {
    const d = new Date(now - (WEEKS - 1 - i) * 7 * 86_400_000);
    return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
  });
  return {
    totale: list.length,
    nuovi7,
    accettati: Accepted,
    tassoAccettazione: pct(Accepted, list.length),
    inAttesa,
    provini,
    serie,
    labelSerie,
    settoriCoperti: new Set(list.map((c) => c.settore)).size,
    citta: new Set(list.map((c) => c.citta.toLowerCase())).size,
    etaMediaGiorni: list.length
      ? Math.round(
          list.reduce((a, c) => a + (now - new Date(c.timestamp).getTime()) / 86_400_000, 0) /
            list.length,
        )
      : 0,
    funnel: FUNNEL.map((k) => ({
      key: k,
      n: list.filter((c) => c.stato === k).length,
    })),
  };
}

export function cityRanking(list: Candidate[], limit = 7) {
  const map = new Map<string, { n: number; acc: number; sector: Set<SectorKey> }>();
  list.forEach((c) => {
    const k = c.citta.replace(/\s+/g, " ").trim() || "n.d.";
    const cur = map.get(k) ?? { n: 0, acc: 0, sector: new Set<SectorKey>() };
    cur.n += 1;
    if (c.stato === "accettato") cur.acc += 1;
    cur.sector.add(c.settore);
    map.set(k, cur);
  });
  return [...map.entries()]
    .map(([citta, v]) => ({ citta, n: v.n, acc: v.acc, mix: [...v.sector] }))
    .sort((a, b) => b.n - a.n)
    .slice(0, limit);
}

export function filterCandidates(
  list: Candidate[],
  q: {
    query: string;
    sectors: SectorKey[];
    statuses: StatusKey[];
    sort: "recenti" | "anziani" | "voto" | "nome";
    soloDaLavorare?: boolean;
  },
) {
  const needle = q.query.trim().toLowerCase();
  let out = list.filter((c) => {
    if (q.sectors.length && !q.sectors.includes(c.settore)) return false;
    if (q.statuses.length && !q.statuses.includes(c.stato)) return false;
    if (q.soloDaLavorare && c.stato !== "nuovo") return false;
    if (!needle) return true;
    return (
      c.nome.toLowerCase().includes(needle) ||
      c.mail.toLowerCase().includes(needle) ||
      c.citta.toLowerCase().includes(needle) ||
      c.presentazione.toLowerCase().includes(needle) ||
      c.note.toLowerCase().includes(needle)
    );
  });
  out = [...out].sort((a, b) => {
    if (q.sort === "voto") return b.voto - a.voto || +new Date(b.timestamp) - +new Date(a.timestamp);
    if (q.sort === "nome") return a.nome.localeCompare(b.nome, "it");
    if (q.sort === "anziani") return +new Date(a.timestamp) - +new Date(b.timestamp);
    return +new Date(b.timestamp) - +new Date(a.timestamp);
  });
  return out;
}

export function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else prev.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setShown(true)),
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, shown]);
  return { ref, shown };
}
