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
