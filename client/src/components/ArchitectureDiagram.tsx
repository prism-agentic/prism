/*
 * ArchitectureDiagram — SVG-based layered architecture visualization
 * Precisely maps to the 4 architecture layers with i18n support
 * Design: concentric hexagonal rings with glowing accents
 * Mobile: smaller viewBox with responsive scaling, touch-friendly
 */
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";

interface LayerConfig {
  nameKey: string;
  descKey: string;
  color: string;
  glowColor: string;
  radius: number;
  mobileRadius: number;
  iconPaths: string[];
}

const LAYERS: LayerConfig[] = [
  {
    nameKey: "arch.layer3.name",
    descKey: "arch.layer3.desc",
    color: "#ffb347",
    glowColor: "rgba(255,179,71,0.3)",
    radius: 180,
    mobileRadius: 120,
    iconPaths: ["M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"],
  },
  {
    nameKey: "arch.layer2.name",
    descKey: "arch.layer2.desc",
    color: "#00d4ff",
    glowColor: "rgba(0,212,255,0.3)",
    radius: 135,
    mobileRadius: 90,
    iconPaths: ["M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"],
  },
  {
    nameKey: "arch.layer1.name",
    descKey: "arch.layer1.desc",
    color: "#ffb347",
    glowColor: "rgba(255,179,71,0.3)",
    radius: 90,
    mobileRadius: 60,
    iconPaths: ["M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"],
  },
  {
    nameKey: "arch.layer0.name",
    descKey: "arch.layer0.desc",
    color: "#00d4ff",
    glowColor: "rgba(0,212,255,0.3)",
    radius: 48,
    mobileRadius: 32,
    iconPaths: ["M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"],
  },
];

function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return pts.join(" ");
}

export default function ArchitectureDiagram() {
  const { t } = useI18n();
  const [hoveredLayer, setHoveredLayer] = useState<number | null>(null);
  const [activeMobileLayer, setActiveMobileLayer] = useState<number | null>(null);
  const [animPhase, setAnimPhase] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Mobile dimensions
  const MCX = 160;
  const MCY = 145;
  const MW = 320;
  const MH = 290;

  // Desktop dimensions
  const CX = 300;
  const CY = 220;
  const W = 600;
  const H = 440;

  const cx = isMobile ? MCX : CX;
  const cy = isMobile ? MCY : CY;
  const w = isMobile ? MW : W;
  const h = isMobile ? MH : H;

  // Particle animation on canvas overlay (desktop only)
  useEffect(() => {
    if (isMobile) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const particles: { x: number; y: number; angle: number; speed: number; ring: number; life: number; maxLife: number }[] = [];

    for (let ring = 0; ring < 4; ring++) {
      const r = LAYERS[ring].radius;
      for (let j = 0; j < 8; j++) {
        const angle = (Math.PI * 2 * j) / 8 + Math.random() * 0.5;
        particles.push({
          x: CX + r * Math.cos(angle),
          y: CY + r * Math.sin(angle),
          angle,
          speed: 0.005 + Math.random() * 0.008,
          ring,
          life: Math.random() * 100,
          maxLife: 80 + Math.random() * 60,
        });
      }
    }

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.angle += p.speed;
        p.life += 1;
        if (p.life > p.maxLife) p.life = 0;

        const r = LAYERS[p.ring].radius;
        p.x = CX + r * Math.cos(p.angle);
        p.y = CY + r * Math.sin(p.angle);

        const alpha = Math.sin((p.life / p.maxLife) * Math.PI) * 0.8;
        const color = LAYERS[p.ring].color;
        const r2 = parseInt(color.slice(1, 3), 16);
        const g2 = parseInt(color.slice(3, 5), 16);
        const b2 = parseInt(color.slice(5, 7), 16);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r2},${g2},${b2},${alpha})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r2},${g2},${b2},${alpha * 0.3})`;
        ctx.fill();
      });

      animRef.current = requestAnimationFrame(animate);
    }

    animate();
    return () => cancelAnimationFrame(animRef.current);
  }, [isMobile]);

  // Pulse animation
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimPhase((p) => (p + 1) % 4);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleLayerInteraction = (i: number) => {
    if (isMobile) {
      setActiveMobileLayer(activeMobileLayer === i ? null : i);
    }
  };

  const displayedLayer = isMobile ? activeMobileLayer : hoveredLayer;

  return (
    <div className="relative w-full" style={{ aspectRatio: `${w}/${h}` }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-full"
        style={{ filter: "drop-shadow(0 0 20px rgba(0,212,255,0.1))" }}
      >
        <defs>
          <filter id="glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feFlood floodColor="#00d4ff" floodOpacity="0.5" />
            <feComposite in2="blur" operator="in" />
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-amber" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feFlood floodColor="#ffb347" floodOpacity="0.5" />
            <feComposite in2="blur" operator="in" />
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-strong-cyan" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feFlood floodColor="#00d4ff" floodOpacity="0.8" />
            <feComposite in2="blur" operator="in" />
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-strong-amber" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feFlood floodColor="#ffb347" floodOpacity="0.8" />
            <feComposite in2="blur" operator="in" />
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="bg-gradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,212,255,0.05)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        {/* Background glow */}
        <circle cx={cx} cy={cy} r={isMobile ? 140 : 200} fill="url(#bg-gradient)" />

        {/* Render layers from outermost to innermost */}
        {LAYERS.map((layer, i) => {
          const isActive = displayedLayer === i;
          const isPulsing = animPhase === i;
          const r = isMobile ? layer.mobileRadius : layer.radius;
          const filterName = layer.color === "#00d4ff"
            ? (isActive ? "glow-strong-cyan" : "glow-cyan")
            : (isActive ? "glow-strong-amber" : "glow-amber");

          return (
            <g
              key={i}
              onMouseEnter={() => !isMobile && setHoveredLayer(i)}
              onMouseLeave={() => !isMobile && setHoveredLayer(null)}
              onClick={() => handleLayerInteraction(i)}
              style={{ cursor: "pointer" }}
            >
              <polygon
                points={hexPoints(cx, cy, r)}
                fill="none"
                stroke={layer.color}
                strokeWidth={isActive ? 2.5 : 1.5}
                opacity={isActive ? 1 : isPulsing ? 0.9 : 0.5}
                filter={isActive || isPulsing ? `url(#${filterName})` : undefined}
                style={{ transition: "all 0.4s ease" }}
              />
              <polygon
                points={hexPoints(cx, cy, r)}
                fill={layer.color}
                opacity={isActive ? 0.08 : 0.02}
                style={{ transition: "opacity 0.4s ease" }}
              />
              {Array.from({ length: 6 }).map((_, j) => {
                const angle = (Math.PI / 3) * j - Math.PI / 2;
                const px = cx + r * Math.cos(angle);
                const py = cy + r * Math.sin(angle);
                return (
                  <circle
                    key={j}
                    cx={px}
                    cy={py}
                    r={isActive ? 3 : 2}
                    fill={layer.color}
                    opacity={isActive ? 1 : 0.6}
                    style={{ transition: "all 0.3s ease" }}
                  />
                );
              })}
            </g>
          );
        })}

        {/* Center icon */}
        <circle cx={cx} cy={cy} r={isMobile ? 16 : 22} fill="rgba(0,212,255,0.1)" stroke="#00d4ff" strokeWidth={1.5} opacity={0.8} />
        <text x={cx} y={cy - (isMobile ? 2 : 3)} textAnchor="middle" fill="#00d4ff" fontSize={isMobile ? "7" : "9"} fontFamily="'JetBrains Mono', monospace" fontWeight="bold" opacity={0.9}>
          PRISM
        </text>
        <text x={cx} y={cy + (isMobile ? 6 : 8)} textAnchor="middle" fill="#00d4ff" fontSize={isMobile ? "5" : "6"} fontFamily="'JetBrains Mono', monospace" opacity={0.6}>
          CORE
        </text>

        {/* Layer labels — desktop only (mobile uses bottom panel) */}
        {!isMobile && (
          <>
            <g opacity={hoveredLayer === 3 ? 1 : 0.75} style={{ transition: "opacity 0.3s" }}>
              <text x={CX - 130} y={CY + 65} textAnchor="end" fill="#00d4ff" fontSize="11" fontFamily="'Space Grotesk', sans-serif" fontWeight="600">
                {t("arch.layer0.name")}
              </text>
              <line x1={CX - 125} y1={CY + 60} x2={CX - 48} y2={CY + 25} stroke="#00d4ff" strokeWidth={0.8} opacity={0.4} strokeDasharray="3,3" />
            </g>
            <g opacity={hoveredLayer === 2 ? 1 : 0.75} style={{ transition: "opacity 0.3s" }}>
              <text x={CX - 155} y={CY - 60} textAnchor="end" fill="#ffb347" fontSize="11" fontFamily="'Space Grotesk', sans-serif" fontWeight="600">
                {t("arch.layer1.name")}
              </text>
              <line x1={CX - 150} y1={CY - 55} x2={CX - 78} y2={CY - 30} stroke="#ffb347" strokeWidth={0.8} opacity={0.4} strokeDasharray="3,3" />
            </g>
            <g opacity={hoveredLayer === 1 ? 1 : 0.75} style={{ transition: "opacity 0.3s" }}>
              <text x={CX + 155} y={CY - 100} textAnchor="start" fill="#00d4ff" fontSize="11" fontFamily="'Space Grotesk', sans-serif" fontWeight="600">
                {t("arch.layer2.name")}
              </text>
              <line x1={CX + 150} y1={CY - 95} x2={CX + 90} y2={CY - 65} stroke="#00d4ff" strokeWidth={0.8} opacity={0.4} strokeDasharray="3,3" />
            </g>
            <g opacity={hoveredLayer === 0 ? 1 : 0.75} style={{ transition: "opacity 0.3s" }}>
              <text x={CX + 155} y={CY + 120} textAnchor="start" fill="#ffb347" fontSize="11" fontFamily="'Space Grotesk', sans-serif" fontWeight="600">
                {t("arch.layer3.name")}
              </text>
              <line x1={CX + 150} y1={CY + 115} x2={CX + 100} y2={CY + 85} stroke="#ffb347" strokeWidth={0.8} opacity={0.4} strokeDasharray="3,3" />
            </g>
          </>
        )}

        {/* Mobile: layer number badges around hexagons */}
        {isMobile && LAYERS.map((layer, i) => {
          const r = layer.mobileRadius;
          const angle = -Math.PI / 2 + (i * Math.PI) / 5;
          const bx = cx + (r + 12) * Math.cos(angle);
          const by = cy + (r + 12) * Math.sin(angle);
          const layerNum = 3 - i + 1;
          return (
            <g key={`m-badge-${i}`} opacity={displayedLayer === i ? 1 : 0.5} style={{ transition: "opacity 0.3s" }}>
              <circle cx={bx} cy={by} r={7} fill={layer.color} opacity={0.15} />
              <circle cx={bx} cy={by} r={7} fill="none" stroke={layer.color} strokeWidth={0.8} opacity={0.4} />
              <text x={bx} y={by + 3} textAnchor="middle" fill={layer.color} fontSize="7" fontFamily="'JetBrains Mono', monospace" fontWeight="bold">
                {layerNum}
              </text>
            </g>
          );
        })}

        {/* Desktop: data flow arrows */}
        {!isMobile && [0, 1, 2].map((i) => {
          const innerR = LAYERS[i + 1].radius;
          const outerR = LAYERS[i].radius;
          const midR = (innerR + outerR) / 2;
          const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
          return angles.map((angle, j) => {
            const x1 = CX + innerR * Math.cos(angle);
            const y1 = CY + innerR * Math.sin(angle);
            const x2 = CX + outerR * Math.cos(angle);
            const y2 = CY + outerR * Math.sin(angle);
            const mx = CX + midR * Math.cos(angle);
            const my = CY + midR * Math.sin(angle);
            return (
              <g key={`arrow-${i}-${j}`} opacity={0.3}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={LAYERS[i].color} strokeWidth={0.5} strokeDasharray="2,4" />
                <circle cx={mx} cy={my} r={1.5} fill={LAYERS[i].color} opacity={0.6}>
                  <animate attributeName="opacity" values="0.2;0.8;0.2" dur="2s" begin={`${j * 0.5}s`} repeatCount="indefinite" />
                </circle>
              </g>
            );
          });
        })}

        {/* Desktop: orbiting dots */}
        {!isMobile && [0, 1, 2, 3, 4, 5].map((i) => {
          const angle = (Math.PI / 3) * i;
          const r = 200;
          return (
            <circle key={`orbit-${i}`} cx={CX + r * Math.cos(angle)} cy={CY + r * Math.sin(angle)} r={1} fill="#00d4ff" opacity={0.3}>
              <animate attributeName="opacity" values="0.1;0.5;0.1" dur="3s" begin={`${i * 0.5}s`} repeatCount="indefinite" />
            </circle>
          );
        })}

        {/* Desktop: layer number badges */}
        {!isMobile && LAYERS.map((layer, i) => {
          const positions = [
            { x: CX + 190, y: CY - 10 },
            { x: CX + 145, y: CY - 10 },
            { x: CX + 100, y: CY - 10 },
            { x: CX + 55, y: CY - 10 },
          ];
          const pos = positions[i];
          const layerNum = 3 - i + 1;
          return (
            <g key={`badge-${i}`} opacity={hoveredLayer === i ? 1 : 0.5} style={{ transition: "opacity 0.3s" }}>
              <circle cx={pos.x} cy={pos.y} r={8} fill={layer.color} opacity={0.15} />
              <text x={pos.x} y={pos.y + 3.5} textAnchor="middle" fill={layer.color} fontSize="8" fontFamily="'JetBrains Mono', monospace" fontWeight="bold">
                {layerNum}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Canvas overlay for particle effects (desktop only) */}
      {!isMobile && (
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ mixBlendMode: "screen" }}
        />
      )}

      {/* Tooltip / info panel */}
      {displayedLayer !== null && (
        <div
          className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3 glass-card rounded-lg p-2.5 sm:p-3 transition-all duration-300"
          style={{
            borderColor: LAYERS[displayedLayer].color,
            borderWidth: 1,
            borderStyle: "solid",
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: LAYERS[displayedLayer].color }}
            />
            <span
              className="text-xs font-mono font-bold"
              style={{ color: LAYERS[displayedLayer].color }}
            >
              {t(LAYERS[displayedLayer].nameKey)}
            </span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {t(LAYERS[displayedLayer].descKey)}
          </p>
        </div>
      )}

      {/* Mobile: tap hint */}
      {isMobile && displayedLayer === null && (
        <div className="absolute bottom-2 left-2 right-2 text-center">
          <span className="text-[10px] font-mono text-muted-foreground/50">
            {t("net.legend.tech") === "技术智能体" ? "点击六边形查看详情" : "Tap hexagons to explore"}
          </span>
        </div>
      )}
    </div>
  );
}
