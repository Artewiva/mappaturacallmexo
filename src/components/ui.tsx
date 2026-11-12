import { ReactNode } from "react";
import {
  AudioLines,
  Clapperboard,
  Disc3,
  Shapes,
  Music2,
  Star,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "../utils/cn";
import { SECTOR_MAP, SectorKey, STATUS_MAP, StatusKey, SECTORS } from "../lib/model";
import { useReveal, useCountUp } from "../lib/store";

export const SECTOR_ICON = {
  musicista: Music2,
  performer: AudioLines,
  dj: Disc3,
  visual: Clapperboard,
  altro: Shapes,
} as const;

/* ------------------------------------------------------------------- reveal */

export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn(className, "will-change-transform")}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : `translateY(${y}px)`,
        transition: `opacity .75s cubic-bezier(.2,.8,.2,1) ${delay}ms, transform .75s cubic-bezier(.2,.8,.2,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------- panel */

export function Panel({
  children,
  className,
  hover = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "panel relative overflow-hidden",
        hover && "transition-[border-color,transform,box-shadow] duration-300",
        hover && "hover:border-white/16 hover:[transform:translateY(-2px)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHead({
  index,
  kicker,
  title,
  hint,
  right,
}: {
  index: string;
  kicker: string;
  title: ReactNode;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-5 border-b border-white/8 pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-3">
          <span className="font-mono text-[11px] tracking-[0.28em] text-musicista">{index}</span>
          <span className="h-px w-8 bg-white/20" />
          <span className="font-mono text-[11px] tracking-[0.28em] text-ash uppercase">
            {kicker}
          </span>
        </div>
        <h2 className="font-display text-[clamp(1.9rem,4.2vw,3.1rem)] leading-[0.95] font-extrabold tracking-[-0.02em] text-bone">
          {title}
        </h2>
        {hint && <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-ash">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

/* ---------------------------------------------------------------------- stat */

export function Stat({
  label,
  value,
  suffix = "",
  sub,
  accent = "#ece5d8",
  decimals = 0,
}: {
  label: string;
  value: number;
  suffix?: string;
  sub?: string;
  accent?: string;
  decimals?: number;
}) {
  const n = useCountUp(value);
  return (
    <div className="group relative min-w-0">
      <div className="font-mono text-[10.5px] tracking-[0.2em] text-ash uppercase">{label}</div>
      <div
        className="font-display mt-1 text-[clamp(1.7rem,3.4vw,2.6rem)] leading-none font-extrabold tabular-nums transition-colors duration-300"
        style={{ color: accent }}
      >
        {n.toFixed(decimals)}
        <span className="text-[0.5em] font-semibold opacity-70">{suffix}</span>
      </div>
      {sub && <div className="mt-1.5 text-[11.5px] text-ash/80">{sub}</div>}
      <span
        className="absolute -bottom-2 left-0 h-px w-0 transition-[width] duration-500 group-hover:w-full"
        style={{ background: accent }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ indicators */

export function SectorDot({ k, size = 9 }: { k: SectorKey; size?: number }) {
  const s = SECTOR_MAP[k];
  return (
    <span
      className="inline-block shrink-0 rounded-[2px]"
      style={{
        width: size,
        height: size,
        background: s.color,
        boxShadow: `0 0 ${size}px ${s.glow}`,
      }}
    />
  );
}

export function StatusPill({ s, className }: { s: StatusKey; className?: string }) {
  const st = STATUS_MAP[s];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-[3px] font-mono text-[10px] tracking-[0.1em] uppercase",
        className,
      )}
      style={{
        color: st.tone,
        borderColor: st.tone + "44",
        background: st.tone + "14",
        borderRadius: 2,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.tone }} />
      {st.label}
    </span>
  );
}

export function Meter({
  value,
  color,
  track = "rgba(255,255,255,0.08)",
  h = 6,
}: {
  value: number; // 0..100
  color: string;
  track?: string;
  h?: number;
}) {
  return (
    <div className="w-full overflow-hidden rounded-[2px]" style={{ height: h, background: track }}>
      <div
        className="h-full rounded-[2px] transition-[width] duration-700 ease-out"
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: `linear-gradient(90deg,${color}aa,${color})`,
        }}
      />
    </div>
  );
}

export function Stars({
  value,
  onSet,
  size = 13,
}: {
  value: number;
  onSet?: (v: number) => void;
  size?: number;
}) {
  return (
    <div className="inline-flex items-center gap-[2px]">
      {[1, 2, 3, 4, 5].map((i) => {
        const on = i <= value;
        const btn = (
          <Star
            size={size}
            className={cn(
              "transition-transform duration-200",
              on ? "fill-musicista text-musicista" : "text-white/22",
              onSet && "hover:scale-125 cursor-pointer",
            )}
            onClick={
              onSet
                ? (e) => {
                    e.stopPropagation();
                    onSet(value === i ? i - 1 : i);
                  }
                : undefined
            }
          />
        );
        return <span key={i}>{btn}</span>;
      })}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "ghost",
  icon: Icon,
  className,
  title,
}: {
  children?: ReactNode;
  onClick?: () => void;
  variant?: "solid" | "ghost" | "quiet";
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  className?: string;
  title?: string;
}) {
  const styles =
    variant === "solid"
      ? "bg-bone text-ink-950 hover:bg-white border-transparent"
      : variant === "quiet"
        ? "bg-white/4 text-ash hover:text-bone border-white/8 hover:border-white/18"
        : "bg-ink-800/70 text-bone border-white/12 hover:border-musicista/60 hover:bg-ink-700";
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "focus-ring inline-flex items-center gap-2 border px-3.5 py-2 text-[12.5px] font-medium transition-all duration-200 hover:-translate-y-px active:scale-[0.97]",
        styles,
        className,
      )}
      style={{ borderRadius: 2 }}
    >
      {Icon && <Icon size={15} className="opacity-80" />}
      {children}
    </button>
  );
}

export function Chip({
  active,
  children,
  onClick,
  color,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
  color?: string;
}) {
  const c = color || "#ece5d8";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring group inline-flex items-center gap-2 border px-2.5 py-1.5 font-mono text-[10.5px] tracking-[0.12em] uppercase transition-all duration-200 hover:-translate-y-px active:scale-[0.97]",
      )}
      style={{
        borderRadius: 2,
        color: active ? "#0a1017" : c,
        background: active ? c : "transparent",
        borderColor: active ? c : c + "3a",
      }}
    >
      {children}
    </button>
  );
}

export function ArrowLink({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      className="focus-ring group inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.16em] text-ash uppercase transition-colors hover:text-bone"
    >
      {label}
      <ArrowUpRight
        size={14}
        className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      />
    </a>
  );
}

export function SectorLegend({
  selected,
  onToggle,
}: {
  selected: SectorKey[];
  onToggle: (k: SectorKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SECTORS.map((s) => {
        const on = selected.includes(s.key);
        return (
          <Chip key={s.key} active={on} color={s.color} onClick={() => onToggle(s.key)}>
            <span
              className="h-2 w-2 rounded-[1px]"
              style={{ background: on ? "#0a1017" : s.color }}
            />
            {s.short}
          </Chip>
        );
      })}
    </div>
  );
}
