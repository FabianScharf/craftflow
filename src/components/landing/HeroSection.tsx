"use client"

import { ArrowRight, FileText, Mic, Camera, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Design tokens ──────────────────────────────────────────
const T = {
  bg:        "#0D0D0D",
  surface:   "#141414",
  border:    "#1F1F1F",
  copper:    "#C8885A",
  copperMid: "#A36B3F",
  white:     "#FFFFFF",
  muted:     "#6B6B6B",
  text:      "#E8E8E8",
} as const

// ── Primitives ────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost"
  size?: "sm" | "md" | "lg"
  children: React.ReactNode
}

function Button({ variant = "primary", size = "md", className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium rounded-md cursor-pointer",
        "transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && [
          "text-[#0D0D0D] bg-[#C8885A] hover:bg-[#A36B3F]",
          "focus-visible:ring-[#C8885A] focus-visible:ring-offset-[#0D0D0D]",
        ],
        variant === "ghost" && [
          "text-[#E8E8E8] bg-transparent border border-[#1F1F1F] hover:border-[#C8885A] hover:text-[#C8885A]",
          "focus-visible:ring-[#C8885A] focus-visible:ring-offset-[#0D0D0D]",
        ],
        size === "sm" && "px-4 py-2 text-sm",
        size === "md" && "px-5 py-2.5 text-sm",
        size === "lg" && "px-7 py-3.5 text-base",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

// ── Feature pill ──────────────────────────────────────────

function FeaturePill({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
      style={{ background: "#141414", border: "1px solid #1F1F1F", color: "#6B6B6B" }}
    >
      <Icon size={13} style={{ color: "#C8885A" }} aria-hidden />
      {label}
    </div>
  )
}

// ── Social proof bar ──────────────────────────────────────

const BENEFITS = [
  "Angebot in unter 5 Minuten",
  "Kein Tippfehler mehr",
  "DATEV-ready PDF-Export",
] as const

function BenefitRow() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
      {BENEFITS.map((b) => (
        <span key={b} className="inline-flex items-center gap-1.5 text-xs" style={{ color: "#6B6B6B" }}>
          <CheckCircle2 size={13} style={{ color: "#C8885A" }} aria-hidden />
          {b}
        </span>
      ))}
    </div>
  )
}

// ── Mock UI card ──────────────────────────────────────────

function MockCard() {
  const rows = [
    { pos: "01", label: "Einbauschrank Eiche, 3-türig", preis: "4.320,00 €" },
    { pos: "02", label: "Schubladen Blum Legrabox (5×)", preis:   "680,00 €" },
    { pos: "03", label: "Montage vor Ort, 2 Tage",       preis:   "960,00 €" },
  ] as const

  return (
    <div
      className="w-full max-w-md rounded-xl overflow-hidden"
      style={{
        background:  "#141414",
        border:      "1px solid #1F1F1F",
        boxShadow:   "0 0 0 1px #1F1F1F, 0 32px 64px -16px rgba(0,0,0,0.6)",
      }}
      aria-hidden
    >
      {/* Window chrome */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor: "#1F1F1F" }}
      >
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <span key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />
        ))}
        <span className="ml-2 text-xs" style={{ color: "#6B6B6B" }}>
          craftflow — Angebot #2024-047
        </span>
      </div>

      {/* Table header */}
      <div
        className="grid grid-cols-[auto_1fr_auto] gap-4 px-5 py-2.5 text-xs font-medium"
        style={{ color: "#6B6B6B", borderBottom: "1px solid #1F1F1F" }}
      >
        <span>Pos</span>
        <span>Bezeichnung</span>
        <span className="text-right">Gesamt</span>
      </div>

      {/* Rows */}
      {rows.map((r, i) => (
        <div
          key={r.pos}
          className="grid grid-cols-[auto_1fr_auto] gap-4 px-5 py-3 text-sm"
          style={{
            color:        "#E8E8E8",
            borderBottom: i < rows.length - 1 ? "1px solid #1A1A1A" : undefined,
          }}
        >
          <span style={{ color: "#6B6B6B" }}>{r.pos}</span>
          <span>{r.label}</span>
          <span className="font-medium tabular-nums" style={{ color: "#C8885A" }}>
            {r.preis}
          </span>
        </div>
      ))}

      {/* Summenblock */}
      <div className="px-5 py-4" style={{ borderTop: "1px solid #1F1F1F" }}>
        <div className="flex justify-between text-xs mb-1" style={{ color: "#6B6B6B" }}>
          <span>Netto</span>
          <span className="tabular-nums">5.960,00 €</span>
        </div>
        <div className="flex justify-between text-xs mb-3" style={{ color: "#6B6B6B" }}>
          <span>MwSt. 19 %</span>
          <span className="tabular-nums">1.132,40 €</span>
        </div>
        <div
          className="flex justify-between text-sm font-semibold"
          style={{ color: "#E8E8E8" }}
        >
          <span>Gesamtbetrag</span>
          <span className="tabular-nums" style={{ color: "#C8885A" }}>7.092,40 €</span>
        </div>
      </div>

      {/* AI badge */}
      <div
        className="px-5 py-3 flex items-center gap-2 text-xs"
        style={{ background: "#0F0F0F", borderTop: "1px solid #1F1F1F", color: "#6B6B6B" }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: "#C8885A" }}
        />
        KI-Kalkulation erstellt in 8 Sekunden
      </div>
    </div>
  )
}

// ── Hero Section ───────────────────────────────────────────

export function HeroSection() {
  return (
    <section
      className="relative min-h-dvh flex flex-col"
      style={{ background: T.bg }}
      aria-label="CraftFlow Hero"
    >
      {/* Subtle copper glow — decorative only */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-[0.04]"
          style={{ background: `radial-gradient(circle, ${T.copper} 0%, transparent 70%)` }}
        />
      </div>

      {/* ── Nav bar ── */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold tracking-tight" style={{ color: T.white }}>
            Craft<span style={{ color: T.copper }}>Flow</span>
          </span>
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{ background: "#1A1A1A", color: T.copper, border: `1px solid ${T.border}` }}
          >
            Beta
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-6" aria-label="Hauptnavigation">
          {["Funktionen", "Preise", "Demo"].map((l) => (
            <a
              key={l}
              href="#"
              className="text-sm transition-colors duration-150 hover:opacity-80"
              style={{ color: T.muted }}
            >
              {l}
            </a>
          ))}
        </nav>
        <Button variant="ghost" size="sm">
          Kostenlos starten
        </Button>
      </header>

      {/* ── Main content ── */}
      <main className="relative z-10 flex-1 flex flex-col lg:flex-row items-center gap-16 lg:gap-24 px-6 py-16 lg:py-24 max-w-6xl mx-auto w-full">

        {/* Left — copy */}
        <div className="flex-1 flex flex-col items-start max-w-xl">

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mb-8">
            <FeaturePill icon={Mic}      label="Spracheingabe" />
            <FeaturePill icon={Camera}   label="Foto-Upload" />
            <FeaturePill icon={FileText} label="PDF-Angebot" />
          </div>

          {/* Headline */}
          <h1
            className="text-4xl sm:text-5xl lg:text-[56px] font-semibold leading-[1.1] tracking-tight mb-6"
            style={{ color: T.white }}
          >
            Angebote in{" "}
            <span style={{ color: T.copper }}>Minuten</span>
            {" "}statt Stunden.
          </h1>

          {/* Sub-headline */}
          <p
            className="text-base sm:text-lg leading-relaxed mb-10 max-w-md"
            style={{ color: T.muted }}
          >
            CraftFlow liest Fotos, Skizzen und Spracheingaben — und erstellt
            daraus professionelle Holzhandwerk-Angebote mit korrekten
            Kostenstellen und Stundensätzen.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-10">
            <Button variant="primary" size="lg">
              Jetzt kostenlos testen
              <ArrowRight size={16} aria-hidden />
            </Button>
            <Button variant="ghost" size="lg">
              Demo ansehen
            </Button>
          </div>

          {/* Benefit row */}
          <BenefitRow />
        </div>

        {/* Right — mock UI */}
        <div className="flex-shrink-0 w-full lg:w-auto flex justify-center">
          <MockCard />
        </div>
      </main>

      {/* ── Social proof strip ── */}
      <footer
        className="relative z-10 border-t px-6 py-6 max-w-6xl mx-auto w-full"
        style={{ borderColor: T.border }}
      >
        <p className="text-center text-xs mb-4" style={{ color: T.muted }}>
          Entwickelt für Schreiner- und Tischlermeister
        </p>
        <div className="flex flex-wrap justify-center gap-8">
          {[
            { value: "< 5 min",  label: "Angebotszeit" },
            { value: "30+",      label: "Kostenstellen" },
            { value: "100 %",    label: "Individuell" },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="text-xl font-semibold tabular-nums" style={{ color: T.copper }}>
                {value}
              </div>
              <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </footer>
    </section>
  )
}

export default HeroSection
