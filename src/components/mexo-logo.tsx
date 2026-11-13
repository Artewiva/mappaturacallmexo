import { cn } from "../utils/cn";
import mexoDark from "@/assets/mexo-logo-dark.png";
import mexoLight from "@/assets/mexo-logo-light.png";
import vinyl from "@/assets/mexo-logo-vinyl.jpg";

type Variant = "dark" | "light";
type Size = "sm" | "md" | "lg" | "xl" | "hero";

interface Props {
  variant?: Variant;
  size?: Size;
  className?: string;
  showSubtitle?: boolean; // deprecated: logo PNG già include subtitle, ma mantenuto per compat
  vinyl?: boolean; // mostra il vinile oro dietro al logo (poster)
  compact?: boolean; // senza subtitle, solo MEXO
  alt?: string;
}

/**
 * MEXO Logo ufficiale
 * M = tessere mosaic (pattern estratto dal poster), EXO = #e9a23b arancio
 * Sottotitolo: MOSAIC EXHIBITION ORCHESTRA
 *
 * Il file PNG è generato da PIL ritagliando il poster Storia Mexo.jpg
 * e ricostruendo la M con pattern mosaic autentico (bottom-right corner).
 * Due varianti: dark (per header scuro) e light (per PDF carta chiara).
 */
export function MexoLogo({
  variant = "dark",
  size = "md",
  className,
  compact = false,
  vinyl: withVinyl = false,
  alt = "MEXO — Mosaic Exhibition Orchestra",
}: Props) {
  const src = variant === "dark" ? mexoDark : mexoLight;

  const sizeClasses: Record<Size, string> = {
    sm: "h-7 w-auto",
    md: "h-9 w-auto",
    lg: "h-12 w-auto",
    xl: "h-16 w-auto",
    hero: "h-[72px] w-auto sm:h-[84px]",
  };

  if (withVinyl) {
    // Versione vinile: il crop centrale del poster (vinile oro + MEXO)
    return (
      <div className={cn("relative inline-flex items-center justify-center overflow-hidden", className)}>
        <img
          src={vinyl}
          alt={alt}
          className={cn(
            "object-cover",
            size === "hero" ? "h-[280px] w-[280px] rounded-full sm:h-[340px] sm:w-[340px]" : "h-24 w-24 rounded-full object-cover"
          )}
          loading="eager"
        />
        {/* Luce riflessa vinile */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full opacity-30 mix-blend-screen"
          style={{
            background:
              "linear-gradient(115deg, transparent 42%, rgba(255,255,255,0.45) 48%, transparent 56%)",
          }}
        />
      </div>
    );
  }

  // Logo standard: PNG trasparente con M mosaic + EXO arancio + subtitle
  return (
    <img
      src={src}
      alt={alt}
      className={cn(
        "block select-none object-contain",
        sizeClasses[size],
        compact && "h-8",
        className
      )}
      draggable={false}
      loading="eager"
      decoding="async"
    />
  );
}

/**
 * Mark compatto per header sticky (solo "MEXO" senza subtitle quando spazio ridotto)
 * Usa lo stesso PNG ma con cropping visivo; in alternativa testo vettoriale.
 */
export function MexoMark({ variant = "dark", className }: { variant?: Variant; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-[3px]",
        className
      )}
      aria-label="MEXO"
    >
      {/* Tessere colorate come nel poster (angoli) */}
      <div className="hidden gap-[2px] sm:flex">
        {["#e9a23b", "#e05a45", "#21b3a4", "#5f8fd9", "#a9bf4a"].map((c) => (
          <span key={c} className="h-3 w-3 rounded-[2px]" style={{ background: c }} />
        ))}
      </div>
      <MexoLogo variant={variant} size="sm" className="ml-1 sm:ml-2" />
    </div>
  );
}

/**
 * Blocco celebrativo con vinile + logo grande + claim del poster
 * Replica fedele del poster "OPEN CALL FOR ARTIST" su fondo nero con vinile.
 */
export function MexoHeroVinyl({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-[4px] border border-white/10 bg-[#050a10] px-6 py-10 text-center sm:px-10 sm:py-14",
        className
      )}
    >
      {/* Mosaic corners come nel poster */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-10 -top-10 h-[220px] w-[220px] rotate-12 opacity-90"
        style={{
          background:
            "linear-gradient(135deg, #e9a23b 0 22%, #5f8fd9 22% 38%, #e05a45 38% 55%, #a9bf4a 55% 72%, #ece5d8 72% 100%)",
          clipPath: "polygon(0 0, 100% 0, 0 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-14 -right-10 h-[260px] w-[260px] -rotate-12 opacity-90"
        style={{
          background:
            "linear-gradient(135deg, #ece5d8 0 14%, #21b3a4 14% 30%, #e9a23b 30% 52%, #5f8fd9 52% 68%, #e05a45 68% 100%)",
          clipPath: "polygon(100% 100%, 100% 0, 0 100%)",
        }}
      />
      {/* Vinile sottile sullo sfondo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          background:
            "repeating-radial-gradient(circle at 50% 52%, transparent 0 2px, rgba(239,224,180,0.35) 3px, transparent 4px)",
        }}
      />
      <div className="relative z-10 flex flex-col items-center">
        <div className="font-mono text-[11px] tracking-[0.32em] text-[#e9a23b] sm:text-[13px]">OPEN CALL</div>
        <div className="font-mono text-[11px] tracking-[0.32em] text-[#e9a23b] sm:text-[13px]">FOR ARTIST</div>

        {/* Vinile + MEXO */}
        <div className="relative mt-6">
          <img
            src={vinyl}
            alt="Vinile MEXO"
            className="h-[280px] w-[280px] rounded-full object-cover shadow-[0_20px_60px_rgba(0,0,0,0.75),0_0_80px_rgba(233,162,59,0.15)] sm:h-[360px] sm:w-[360px]"
          />
          <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/10 to-white/25" />
          {/* Overlay logo MEXO centrato sul vinile (come poster) */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="flex items-baseline gap-0 font-display text-[72px] font-black leading-none tracking-[-0.03em] sm:text-[88px]">
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: "url(/assets/mosaic_clean.jpg)",
                  backgroundSize: "160px",
                  WebkitBackgroundClip: "text",
                  filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.6))",
                }}
              >
                M
              </span>
              <span className="text-[#e9a23b] drop-shadow-[0_2px_12px_rgba(233,162,59,0.45)]">EXO</span>
            </div>
            <div className="mt-1 font-mono text-[10px] tracking-[0.26em] text-[#ece5d8]/90 sm:text-[11px]">
              MOSAIC EXHIBITION ORCHESTRA
            </div>
          </div>
        </div>

        <p className="mt-8 max-w-[32ch] font-serif text-[15px] italic leading-relaxed text-[#d6e0ea]/90 sm:text-[16px]">
          Una giovane orchestra
          <br />
          senza schemi dove la musica accade.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="#registro"
            className="bg-[#e9a23b] px-5 py-2.5 font-mono text-[11px] font-semibold tracking-[0.16em] text-[#0a0f14] transition hover:bg-[#f0ad4a]"
          >
            PARTECIPA ALLA CALL
          </a>
          <a
            href="#manifesto"
            className="border border-white/25 px-5 py-2.5 font-mono text-[11px] tracking-[0.16em] text-white transition hover:border-white/50 hover:text-white"
          >
            IL MANIFESTO
          </a>
        </div>

        <div className="mt-8 flex flex-col items-center gap-1.5">
          <span className="font-mono text-[9px] tracking-[0.3em] text-white/50">SCORRI</span>
          <span className="h-6 w-px bg-gradient-to-b from-[#e9a23b] to-transparent" />
        </div>
      </div>
    </div>
  );
}
