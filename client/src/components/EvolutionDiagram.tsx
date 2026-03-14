/*
 * EvolutionDiagram — SVG-based 3-tier evolution visualization
 * Compact layout: SVG + info panel visible together in one viewport
 * Concentric rings with auto-cycling info panel + hover interaction
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useI18n } from "@/contexts/I18nContext";

interface TierData {
  level: string;
  nameKey: string;
  descKey: string;
  metricKeys: string[];
  color: string;
  ringRadius: number;
}

const TIERS: TierData[] = [
  {
    level: "L1",
    nameKey: "evo.tier0.name",
    descKey: "evo.tier0.desc",
    metricKeys: ["evo.tier0.m0", "evo.tier0.m1", "evo.tier0.m2"],
    color: "#00d4ff",
    ringRadius: 65,
  },
  {
    level: "L2",
    nameKey: "evo.tier1.name",
    descKey: "evo.tier1.desc",
    metricKeys: ["evo.tier1.m0", "evo.tier1.m1", "evo.tier1.m2"],
    color: "#a78bfa",
    ringRadius: 130,
  },
  {
    level: "L3",
    nameKey: "evo.tier2.name",
    descKey: "evo.tier2.desc",
    metricKeys: ["evo.tier2.m0", "evo.tier2.m1", "evo.tier2.m2"],
    color: "#ffb347",
    ringRadius: 195,
  },
];

export default function EvolutionDiagram() {
  const { t } = useI18n();
  const [hoveredTier, setHoveredTier] = useState<number | null>(null);
  const [activeTier, setActiveTier] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isVisibleRef = useRef(true);

  const displayedTier = hoveredTier !== null ? hoveredTier : activeTier;

  // Spacious dimensions — rings well separated, still compact overall
  const W = 800;
  const H = 320;
  const CX = W / 2;
  const CY = 155;
  const ELLIPSE_RATIO = 0.48; // slightly rounder ellipses for better separation

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActiveTier((prev) => (prev + 1) % 3);
    }, 3000);
  }, []);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  const handleMouseEnter = useCallback((i: number) => {
    setHoveredTier(i);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredTier(null);
    startTimer();
  }, [startTimer]);

  // Visibility observer — pause animation when off-screen
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { isVisibleRef.current = entry.isIntersecting; },
      { rootMargin: "100px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Canvas particle animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    interface OrbitalParticle {
      tier: number;
      angle: number;
      speed: number;
      size: number;
      offset: number;
    }

    const particles: OrbitalParticle[] = [];
    TIERS.forEach((tier, i) => {
      const count = 5 + i * 3;
      for (let j = 0; j < count; j++) {
        particles.push({
          tier: i,
          angle: (Math.PI * 2 * j) / count + Math.random() * 0.5,
          speed: (0.003 + Math.random() * 0.004) * (i === 0 ? 1.5 : i === 1 ? 1 : 0.7),
          size: 1 + Math.random() * 1.2,
          offset: (Math.random() - 0.5) * 6,
        });
      }
    });

    interface RisingParticle {
      x: number;
      y: number;
      speed: number;
      life: number;
      maxLife: number;
      size: number;
    }
    const risingParticles: RisingParticle[] = [];
    for (let i = 0; i < 10; i++) {
      risingParticles.push({
        x: CX + (Math.random() - 0.5) * 20,
        y: CY + (Math.random() - 0.5) * 20,
        speed: 0.2 + Math.random() * 0.4,
        life: Math.random() * 60,
        maxLife: 50 + Math.random() * 30,
        size: 0.5 + Math.random() * 0.8,
      });
    }

    function animate() {
      if (!ctx || !canvas) return;
      animRef.current = requestAnimationFrame(animate);
      if (!isVisibleRef.current) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.angle += p.speed;
        const r = TIERS[p.tier].ringRadius + p.offset;
        const x = CX + r * Math.cos(p.angle);
        const y = CY + r * Math.sin(p.angle) * ELLIPSE_RATIO;

        const color = TIERS[p.tier].color;
        const cr = parseInt(color.slice(1, 3), 16);
        const cg = parseInt(color.slice(3, 5), 16);
        const cb = parseInt(color.slice(5, 7), 16);
        const alpha = 0.3 + Math.sin(p.angle * 2) * 0.3;

        ctx.beginPath();
        ctx.arc(x, y, p.size * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha * 0.1})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
        ctx.fill();
      });

      risingParticles.forEach((p) => {
        p.life++;
        if (p.life > p.maxLife) {
          p.life = 0;
          p.x = CX + (Math.random() - 0.5) * 20;
          p.y = CY + (Math.random() - 0.5) * 20;
        }
        p.y -= p.speed;
        p.x += Math.sin(p.life * 0.1) * 0.2;
        const progress = p.life / p.maxLife;
        const alpha = Math.sin(progress * Math.PI) * 0.35;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,212,255,${alpha})`;
        ctx.fill();
      });

    }

    animate();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  function ellipsePath(rx: number, ry: number): string {
    return `M${CX - rx},${CY} A${rx},${ry} 0 1,1 ${CX + rx},${CY} A${rx},${ry} 0 1,1 ${CX - rx},${CY}`;
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* SVG diagram — compact, no extra whitespace */}
      <div className="overflow-x-auto">
        <div className="min-w-[500px] relative" style={{ aspectRatio: `${W}/${H}` }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-full"
            style={{ filter: "drop-shadow(0 0 15px rgba(0,212,255,0.05))" }}
          >
            <defs>
              <filter id="evo-glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feFlood floodColor="#00d4ff" floodOpacity="0.5" />
                <feComposite in2="blur" operator="in" />
                <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="evo-glow-purple" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feFlood floodColor="#a78bfa" floodOpacity="0.5" />
                <feComposite in2="blur" operator="in" />
                <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="evo-glow-amber" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feFlood floodColor="#ffb347" floodOpacity="0.5" />
                <feComposite in2="blur" operator="in" />
                <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <radialGradient id="evo-center-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#00d4ff" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Center glow */}
            <circle cx={CX} cy={CY} r={28} fill="url(#evo-center-grad)" />

            {/* Center core hexagon */}
            {(() => {
              const r = 18;
              const pts: string[] = [];
              for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i - Math.PI / 2;
                const x = CX + r * Math.cos(angle);
                const y = CY + r * Math.sin(angle);
                pts.push(`${i === 0 ? "M" : "L"}${x},${y}`);
              }
              const path = pts.join(" ") + " Z";
              return (
                <>
                  <path d={path} fill="#00d4ff" opacity={0.08} />
                  <path d={path} fill="none" stroke="#00d4ff" strokeWidth={1.5} opacity={0.6} />
                </>
              );
            })()}

            {/* Center label */}
            <text x={CX} y={CY - 2} textAnchor="middle" fill="#00d4ff" fontSize="7" fontFamily="'JetBrains Mono', monospace" fontWeight="bold" opacity={0.8}>
              PRISM
            </text>
            <text x={CX} y={CY + 8} textAnchor="middle" fill="#8892b0" fontSize="6" fontFamily="'JetBrains Mono', monospace" opacity={0.6}>
              CORE
            </text>

            {/* Concentric elliptical rings */}
            {TIERS.map((tier, i) => {
              const isDisplayed = displayedTier === i;
              const rx = tier.ringRadius;
              const ry = tier.ringRadius * ELLIPSE_RATIO;
              const filterName = i === 0 ? "evo-glow-cyan" : i === 1 ? "evo-glow-purple" : "evo-glow-amber";

              // Label badge position — stagger around the top
              const labelAngle = -Math.PI / 2 + (i - 1) * 0.45;
              const labelX = CX + rx * Math.cos(labelAngle);
              const labelY = CY + ry * Math.sin(labelAngle);

              // Metric node positions
              const metricPositions = tier.metricKeys.map((_, mi) => {
                const baseAngle = Math.PI / 4 + (mi * Math.PI * 2) / 3;
                return {
                  x: CX + rx * Math.cos(baseAngle),
                  y: CY + ry * Math.sin(baseAngle),
                };
              });

              return (
                <g
                  key={tier.level}
                  onMouseEnter={() => handleMouseEnter(i)}
                  onMouseLeave={handleMouseLeave}
                  style={{ cursor: "pointer" }}
                >
                  {/* Main ring */}
                  <path
                    d={ellipsePath(rx, ry)}
                    fill="none"
                    stroke={tier.color}
                    strokeWidth={isDisplayed ? 2 : 0.8}
                    opacity={isDisplayed ? 0.7 : 0.2}
                    strokeDasharray={isDisplayed ? "none" : "4,6"}
                    filter={isDisplayed ? `url(#${filterName})` : undefined}
                    style={{ transition: "all 0.5s ease" }}
                  />

                  {/* Inner ring for depth */}
                  <path
                    d={ellipsePath(rx - 5, ry - 2.25)}
                    fill="none"
                    stroke={tier.color}
                    strokeWidth={0.3}
                    opacity={isDisplayed ? 0.2 : 0.05}
                    style={{ transition: "opacity 0.5s ease" }}
                  />

                  {/* Clickable hit area (invisible) */}
                  <path
                    d={ellipsePath(rx, ry)}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={20}
                  />

                  {/* Level badge */}
                  <circle cx={labelX} cy={labelY} r={isDisplayed ? 16 : 12} fill={tier.color} opacity={isDisplayed ? 0.15 : 0.06} style={{ transition: "all 0.4s ease" }} />
                  <circle cx={labelX} cy={labelY} r={isDisplayed ? 16 : 12} fill="none" stroke={tier.color} strokeWidth={isDisplayed ? 1.5 : 0.8} opacity={isDisplayed ? 0.8 : 0.3} style={{ transition: "all 0.4s ease" }} />
                  <text x={labelX} y={labelY - 1} textAnchor="middle" fill={tier.color} fontSize="8" fontFamily="'JetBrains Mono', monospace" fontWeight="bold" opacity={isDisplayed ? 1 : 0.5} style={{ transition: "opacity 0.4s ease" }}>
                    {tier.level}
                  </text>
                  <text x={labelX} y={labelY + 8} textAnchor="middle" fill={tier.color} fontSize="5.5" fontFamily="'Space Grotesk', sans-serif" fontWeight="600" opacity={isDisplayed ? 0.8 : 0.35} style={{ transition: "opacity 0.4s ease" }}>
                    {t(tier.nameKey)}
                  </text>

                  {/* Metric nodes */}
                  {metricPositions.map((pos, mi) => (
                    <g key={mi}>
                      <circle cx={pos.x} cy={pos.y} r={isDisplayed ? 3.5 : 2} fill={tier.color} opacity={isDisplayed ? 0.6 : 0.2} style={{ transition: "all 0.4s ease" }} />
                      {isDisplayed && (
                        <text x={pos.x} y={pos.y + (pos.y > CY ? 12 : -7)} textAnchor="middle" fill={tier.color} fontSize="6" fontFamily="'Space Grotesk', sans-serif" opacity={0.65}>
                          {t(tier.metricKeys[mi])}
                        </text>
                      )}
                    </g>
                  ))}

                  {/* Connecting line from center */}
                  <line x1={CX} y1={CY} x2={labelX} y2={labelY} stroke={tier.color} strokeWidth={isDisplayed ? 0.6 : 0.2} opacity={isDisplayed ? 0.25 : 0.06} strokeDasharray="3,4" style={{ transition: "all 0.5s ease" }} />
                </g>
              );
            })}

            {/* Evolution direction arrows */}
            {[0, 1].map((i) => {
              const fromR = TIERS[i].ringRadius;
              const toR = TIERS[i + 1].ringRadius;
              const midR = (fromR + toR) / 2;
              const angle = Math.PI * 0.75 + i * 0.4;
              const ax = CX + midR * Math.cos(angle);
              const ay = CY + midR * ELLIPSE_RATIO * Math.sin(angle);
              const arrowColor = TIERS[i + 1].color;
              return (
                <g key={`arrow-${i}`}>
                  <circle cx={ax} cy={ay} r={5} fill={arrowColor} opacity={0.08} />
                  <text x={ax} y={ay + 3} textAnchor="middle" fill={arrowColor} fontSize="8" fontWeight="bold" opacity={0.5}>↑</text>
                </g>
              );
            })}
          </svg>

          {/* Canvas overlay */}
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ mixBlendMode: "screen" }}
          />
        </div>
      </div>

      {/* Info panel — tight spacing, directly below diagram */}
      <div
        className="mt-2 rounded-lg p-3 sm:p-4 transition-all duration-500 border"
        style={{
          borderColor: TIERS[displayedTier].color + "40",
          backgroundColor: TIERS[displayedTier].color + "08",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
          <span
            className="text-xs font-mono font-bold px-2.5 py-1 rounded shrink-0 w-fit"
            style={{
              color: TIERS[displayedTier].color,
              backgroundColor: TIERS[displayedTier].color + "18",
              border: `1px solid ${TIERS[displayedTier].color}30`,
            }}
          >
            {TIERS[displayedTier].level}
          </span>
          <div className="flex-1">
            <span className="text-base font-display font-bold block mb-0.5" style={{ color: TIERS[displayedTier].color }}>
              {t(TIERS[displayedTier].nameKey)}
            </span>
            <span className="text-muted-foreground text-sm leading-relaxed block">
              {t(TIERS[displayedTier].descKey)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2.5">
          {TIERS[displayedTier].metricKeys.map((mk, i) => (
            <div key={i} className="flex items-center gap-2 text-xs font-mono">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TIERS[displayedTier].color + "90" }} />
              <span className="text-muted-foreground">{t(mk)}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-2.5">
          {TIERS.map((tier, i) => (
            <button
              key={i}
              onClick={() => { setActiveTier(i); setHoveredTier(null); startTimer(); }}
              className="transition-all duration-300"
              style={{
                width: displayedTier === i ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: displayedTier === i ? tier.color : tier.color + "40",
              }}
              aria-label={`Tier ${tier.level}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
