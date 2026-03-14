/*
 * PipelineDiagram — SVG-based pipeline visualization
 * Precisely maps to the 6 phases + 5 quality gates with i18n support
 * Design: horizontal flow with hexagonal phase nodes, gate checkpoints, and animated data flow
 */
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";

interface PhaseData {
  nameKey: string;
  gateKey: string;
  descKey: string;
  color: string;
  icon: string; // SVG path data for a simple icon
}

const PHASES: PhaseData[] = [
  {
    nameKey: "pipeline.phase0.name",
    gateKey: "pipeline.phase0.gate",
    descKey: "pipeline.phase0.desc",
    color: "#00d4ff",
    icon: "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z", // Search
  },
  {
    nameKey: "pipeline.phase1.name",
    gateKey: "pipeline.phase1.gate",
    descKey: "pipeline.phase1.desc",
    color: "#00d4ff",
    icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5", // Strategy layers
  },
  {
    nameKey: "pipeline.phase2.name",
    gateKey: "pipeline.phase2.gate",
    descKey: "pipeline.phase2.desc",
    color: "#00d4ff",
    icon: "M3 3h18v2H3V3zm0 16h18v2H3v-2zm0-8h18v2H3v-2zm4-4h10v2H7V7zm0 8h10v2H7v-2z", // Scaffold
  },
  {
    nameKey: "pipeline.phase3.name",
    gateKey: "pipeline.phase3.gate",
    descKey: "pipeline.phase3.desc",
    color: "#ffb347",
    icon: "M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z", // Build hammer
  },
  {
    nameKey: "pipeline.phase4.name",
    gateKey: "pipeline.phase4.gate",
    descKey: "pipeline.phase4.desc",
    color: "#ffb347",
    icon: "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z", // Shield check
  },
  {
    nameKey: "pipeline.phase5.name",
    gateKey: "pipeline.phase5.gate",
    descKey: "pipeline.phase5.desc",
    color: "#ffb347",
    icon: "M9.51 3.5L6 7.01V18h12V7.01l-3.51-3.51H9.51zM12 16l-4-4h2.5V8h3v4H16l-4 4z", // Launch/deploy
  },
];

// Hexagon path generator
function hexPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    pts.push(`${i === 0 ? "M" : "L"}${x},${y}`);
  }
  return pts.join(" ") + " Z";
}

export default function PipelineDiagram() {
  const { t } = useI18n();
  const [hoveredPhase, setHoveredPhase] = useState<number | null>(null);
  const [activeGate, setActiveGate] = useState<number>(-1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // Dimensions
  const W = 960;
  const H = 320;
  const Y_CENTER = 140;
  const PHASE_SPACING = 145;
  const START_X = 75;
  const HEX_R = 38;
  const GATE_R = 12;

  // Auto-cycle active gate animation
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveGate((prev) => (prev + 1) % 6);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Canvas particle animation for data flow between phases
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    interface Particle {
      x: number;
      y: number;
      fromPhase: number;
      progress: number;
      speed: number;
      size: number;
    }

    const particles: Particle[] = [];
    // Create particles for each connection
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 3; j++) {
        particles.push({
          x: 0,
          y: 0,
          fromPhase: i,
          progress: Math.random(),
          speed: 0.003 + Math.random() * 0.004,
          size: 1.5 + Math.random() * 1.5,
        });
      }
    }

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.progress += p.speed;
        if (p.progress > 1) p.progress = 0;

        const x1 = START_X + p.fromPhase * PHASE_SPACING + HEX_R + 5;
        const x2 = START_X + (p.fromPhase + 1) * PHASE_SPACING - HEX_R - 5;
        p.x = x1 + (x2 - x1) * p.progress;
        p.y = Y_CENTER + Math.sin(p.progress * Math.PI * 2) * 3;

        const alpha = Math.sin(p.progress * Math.PI) * 0.9;
        const color = PHASES[p.fromPhase].color;
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        // Glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.15})`;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fill();
      });

      animRef.current = requestAnimationFrame(animate);
    }

    animate();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <div className="relative w-full overflow-x-auto">
      <div className="min-w-[800px]" style={{ aspectRatio: `${W}/${H}` }}>
        {/* SVG Pipeline Diagram */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-full"
          style={{ filter: "drop-shadow(0 0 15px rgba(0,212,255,0.08))" }}
        >
          <defs>
            <filter id="pipe-glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feFlood floodColor="#00d4ff" floodOpacity="0.6" />
              <feComposite in2="blur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="pipe-glow-amber" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feFlood floodColor="#ffb347" floodOpacity="0.6" />
              <feComposite in2="blur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="pipe-line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.6" />
              <stop offset="60%" stopColor="#00d4ff" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#ffb347" stopOpacity="0.6" />
            </linearGradient>

            {/* Progress gradient for each phase */}
            <linearGradient id="progress-cyan" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00d4ff" />
              <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="progress-amber" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ffb347" />
              <stop offset="100%" stopColor="#ffb347" stopOpacity="0.5" />
            </linearGradient>
          </defs>

          {/* Main connection line */}
          <line
            x1={START_X + HEX_R}
            y1={Y_CENTER}
            x2={START_X + 5 * PHASE_SPACING - HEX_R}
            y2={Y_CENTER}
            stroke="url(#pipe-line-grad)"
            strokeWidth={1.5}
            strokeDasharray="6,4"
          />

          {/* Render phases */}
          {PHASES.map((phase, i) => {
            const cx = START_X + i * PHASE_SPACING;
            const isHovered = hoveredPhase === i;
            const isActive = activeGate === i;
            const filterName = phase.color === "#00d4ff" ? "pipe-glow-cyan" : "pipe-glow-amber";

            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredPhase(i)}
                onMouseLeave={() => setHoveredPhase(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Hexagon background */}
                <path
                  d={hexPath(cx, Y_CENTER, HEX_R)}
                  fill={phase.color}
                  opacity={isHovered ? 0.12 : 0.04}
                  style={{ transition: "opacity 0.3s ease" }}
                />

                {/* Hexagon border */}
                <path
                  d={hexPath(cx, Y_CENTER, HEX_R)}
                  fill="none"
                  stroke={phase.color}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  opacity={isHovered ? 1 : isActive ? 0.9 : 0.5}
                  filter={isHovered || isActive ? `url(#${filterName})` : undefined}
                  style={{ transition: "all 0.3s ease" }}
                />

                {/* Inner hexagon */}
                <path
                  d={hexPath(cx, Y_CENTER, HEX_R * 0.6)}
                  fill="none"
                  stroke={phase.color}
                  strokeWidth={0.5}
                  opacity={isHovered ? 0.4 : 0.15}
                  style={{ transition: "opacity 0.3s ease" }}
                />

                {/* Icon */}
                <g transform={`translate(${cx - 12}, ${Y_CENTER - 12}) scale(1)`}>
                  <path
                    d={phase.icon}
                    fill={phase.color}
                    opacity={isHovered ? 1 : 0.7}
                    style={{ transition: "opacity 0.3s ease" }}
                  />
                </g>

                {/* Phase number */}
                <text
                  x={cx}
                  y={Y_CENTER - HEX_R - 14}
                  textAnchor="middle"
                  fill={phase.color}
                  fontSize="10"
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight="bold"
                  opacity={0.5}
                >
                  {`0${i}`}
                </text>

                {/* Phase name */}
                <text
                  x={cx}
                  y={Y_CENTER + HEX_R + 22}
                  textAnchor="middle"
                  fill={phase.color}
                  fontSize="12"
                  fontFamily="'Space Grotesk', sans-serif"
                  fontWeight="700"
                  opacity={isHovered ? 1 : 0.8}
                  style={{ transition: "opacity 0.3s ease" }}
                >
                  {t(phase.nameKey)}
                </text>

                {/* Phase description (shown on hover) */}
                <text
                  x={cx}
                  y={Y_CENTER + HEX_R + 40}
                  textAnchor="middle"
                  fill="#8892b0"
                  fontSize="9"
                  fontFamily="'Space Grotesk', sans-serif"
                  opacity={isHovered ? 0.8 : 0}
                  style={{ transition: "opacity 0.3s ease" }}
                >
                  {t(phase.descKey)}
                </text>

                {/* Progress bar under phase */}
                <rect
                  x={cx - 30}
                  y={Y_CENTER + HEX_R + 48}
                  width={60}
                  height={3}
                  rx={1.5}
                  fill={phase.color}
                  opacity={0.1}
                />
                <rect
                  x={cx - 30}
                  y={Y_CENTER + HEX_R + 48}
                  width={isActive || (activeGate > i) ? 60 : 0}
                  height={3}
                  rx={1.5}
                  fill={phase.color === "#00d4ff" ? "url(#progress-cyan)" : "url(#progress-amber)"}
                  opacity={0.7}
                  style={{ transition: "width 0.8s ease" }}
                />

                {/* Corner dots on hexagon */}
                {Array.from({ length: 6 }).map((_, j) => {
                  const angle = (Math.PI / 3) * j - Math.PI / 2;
                  const px = cx + HEX_R * Math.cos(angle);
                  const py = Y_CENTER + HEX_R * Math.sin(angle);
                  return (
                    <circle
                      key={j}
                      cx={px}
                      cy={py}
                      r={isHovered ? 3 : 2}
                      fill={phase.color}
                      opacity={isHovered ? 0.9 : 0.4}
                      style={{ transition: "all 0.3s ease" }}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Gate checkpoints between phases */}
          {[0, 1, 2, 3, 4].map((i) => {
            const x = START_X + i * PHASE_SPACING + PHASE_SPACING / 2;
            const isGateActive = activeGate > i;
            const gateColor = i < 2 ? "#00d4ff" : "#ffb347";

            return (
              <g key={`gate-${i}`}>
                {/* Gate diamond */}
                <rect
                  x={x - GATE_R}
                  y={Y_CENTER - GATE_R}
                  width={GATE_R * 2}
                  height={GATE_R * 2}
                  rx={3}
                  fill={gateColor}
                  opacity={isGateActive ? 0.15 : 0.05}
                  transform={`rotate(45, ${x}, ${Y_CENTER})`}
                  style={{ transition: "opacity 0.5s ease" }}
                />
                <rect
                  x={x - GATE_R}
                  y={Y_CENTER - GATE_R}
                  width={GATE_R * 2}
                  height={GATE_R * 2}
                  rx={3}
                  fill="none"
                  stroke={gateColor}
                  strokeWidth={isGateActive ? 1.5 : 0.8}
                  opacity={isGateActive ? 0.9 : 0.3}
                  transform={`rotate(45, ${x}, ${Y_CENTER})`}
                  style={{ transition: "all 0.5s ease" }}
                />

                {/* Checkmark or dot */}
                {isGateActive ? (
                  <g transform={`translate(${x - 6}, ${Y_CENTER - 6}) scale(0.5)`}>
                    <path
                      d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"
                      fill="#4ade80"
                      opacity={0.9}
                    />
                  </g>
                ) : (
                  <circle cx={x} cy={Y_CENTER} r={2} fill={gateColor} opacity={0.4} />
                )}

                {/* Gate label */}
                <text
                  x={x}
                  y={Y_CENTER + GATE_R + 24}
                  textAnchor="middle"
                  fill={isGateActive ? "#4ade80" : "#8892b0"}
                  fontSize="8"
                  fontFamily="'JetBrains Mono', monospace"
                  opacity={isGateActive ? 0.9 : 0.4}
                  style={{ transition: "all 0.5s ease" }}
                >
                  {`GATE ${i + 1}`}
                </text>

                {/* Gate description */}
                <text
                  x={x}
                  y={Y_CENTER + GATE_R + 36}
                  textAnchor="middle"
                  fill={isGateActive ? "#4ade80" : "#8892b0"}
                  fontSize="7"
                  fontFamily="'Space Grotesk', sans-serif"
                  opacity={isGateActive ? 0.7 : 0.3}
                  style={{ transition: "all 0.5s ease" }}
                >
                  {t(PHASES[i].gateKey)}
                </text>
              </g>
            );
          })}

          {/* Decorative: scanning line */}
          <line
            x1={START_X + activeGate * PHASE_SPACING}
            y1={Y_CENTER - 55}
            x2={START_X + activeGate * PHASE_SPACING}
            y2={Y_CENTER + 55}
            stroke={activeGate < 3 ? "#00d4ff" : "#ffb347"}
            strokeWidth={0.5}
            opacity={0.2}
            style={{ transition: "all 1.2s ease" }}
          />
        </svg>

        {/* Canvas overlay for particle flow */}
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ mixBlendMode: "screen" }}
        />
      </div>

      {/* Hover tooltip */}
      {hoveredPhase !== null && (
        <div
          className="absolute bottom-2 left-4 right-4 glass-card rounded-lg p-3 transition-all duration-300"
          style={{
            borderColor: PHASES[hoveredPhase].color,
            borderWidth: 1,
            borderStyle: "solid",
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="text-xs font-mono font-bold px-2 py-0.5 rounded"
              style={{
                color: PHASES[hoveredPhase].color,
                backgroundColor: PHASES[hoveredPhase].color + "15",
              }}
            >
              Phase {hoveredPhase}
            </span>
            <span
              className="text-sm font-display font-semibold"
              style={{ color: PHASES[hoveredPhase].color }}
            >
              {t(PHASES[hoveredPhase].nameKey)}
            </span>
            <span className="text-muted-foreground text-xs">—</span>
            <span className="text-muted-foreground text-xs">
              {t(PHASES[hoveredPhase].descKey)}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-xs font-mono">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400/80" />
            <span className="text-green-400/70">
              Gate: {t(PHASES[hoveredPhase].gateKey)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
