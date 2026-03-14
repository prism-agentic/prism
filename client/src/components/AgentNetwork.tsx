/*
 * PRISM Agent Network — Interactive Multi-Agent Collaboration Visualization
 * Canvas-based animated network with auto-cycling agent highlight and info panel
 * Agents cycle in workflow order: Conductor → Researcher → PM → UX → Backend → Frontend → DevOps → Critic → Growth
 * Mobile: card-based list layout with auto-cycling; Desktop: full Canvas animation
 */
import { useRef, useEffect, useState, useCallback } from "react";
import { useI18n } from "@/contexts/I18nContext";

interface AgentNode {
  id: string;
  labelKey: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  glowColor: string;
  division: string;
  vx: number;
  vy: number;
}

interface Connection {
  from: string;
  to: string;
  strength: number;
}

interface Particle {
  fromId: string;
  toId: string;
  progress: number;
  speed: number;
  color: string;
}

const CYAN = "#00d4ff";
const AMBER = "#ffb347";
const CYAN_DIM = "rgba(0, 212, 255, 0.15)";
const AMBER_DIM = "rgba(255, 179, 71, 0.15)";

const AGENT_DEFS: Omit<AgentNode, "x" | "y" | "vx" | "vy">[] = [
  { id: "conductor", labelKey: "net.conductor", radius: 22, color: CYAN, glowColor: CYAN_DIM, division: "core" },
  { id: "backend", labelKey: "net.backend", radius: 16, color: CYAN, glowColor: CYAN_DIM, division: "eng" },
  { id: "frontend", labelKey: "net.frontend", radius: 16, color: CYAN, glowColor: CYAN_DIM, division: "eng" },
  { id: "devops", labelKey: "net.devops", radius: 14, color: CYAN, glowColor: CYAN_DIM, division: "eng" },
  { id: "ux", labelKey: "net.ux", radius: 15, color: AMBER, glowColor: AMBER_DIM, division: "design" },
  { id: "growth", labelKey: "net.growth", radius: 14, color: AMBER, glowColor: AMBER_DIM, division: "growth" },
  { id: "pm", labelKey: "net.pm", radius: 15, color: AMBER, glowColor: AMBER_DIM, division: "product" },
  { id: "critic", labelKey: "net.critic", radius: 14, color: CYAN, glowColor: CYAN_DIM, division: "core" },
  { id: "researcher", labelKey: "net.researcher", radius: 13, color: AMBER, glowColor: AMBER_DIM, division: "core" },
];

const WORKFLOW_ORDER = [
  "conductor", "researcher", "pm", "ux", "backend", "frontend", "devops", "critic", "growth",
];

const CONNECTIONS: Connection[] = [
  { from: "conductor", to: "backend", strength: 1 },
  { from: "conductor", to: "frontend", strength: 1 },
  { from: "conductor", to: "devops", strength: 0.8 },
  { from: "conductor", to: "ux", strength: 0.9 },
  { from: "conductor", to: "pm", strength: 0.9 },
  { from: "conductor", to: "critic", strength: 0.85 },
  { from: "conductor", to: "growth", strength: 0.7 },
  { from: "conductor", to: "researcher", strength: 0.7 },
  { from: "backend", to: "frontend", strength: 0.8 },
  { from: "backend", to: "devops", strength: 0.7 },
  { from: "frontend", to: "ux", strength: 0.8 },
  { from: "pm", to: "ux", strength: 0.6 },
  { from: "pm", to: "growth", strength: 0.5 },
  { from: "critic", to: "backend", strength: 0.6 },
  { from: "critic", to: "frontend", strength: 0.6 },
  { from: "researcher", to: "pm", strength: 0.5 },
];

const AGENT_INFO: Record<string, { roleKey: string; divKey: string }> = {
  conductor: { roleKey: "net.tip.conductor", divKey: "net.div.core" },
  backend: { roleKey: "net.tip.backend", divKey: "net.div.eng" },
  frontend: { roleKey: "net.tip.frontend", divKey: "net.div.eng" },
  devops: { roleKey: "net.tip.devops", divKey: "net.div.eng" },
  ux: { roleKey: "net.tip.ux", divKey: "net.div.design" },
  growth: { roleKey: "net.tip.growth", divKey: "net.div.growth" },
  pm: { roleKey: "net.tip.pm", divKey: "net.div.product" },
  critic: { roleKey: "net.tip.critic", divKey: "net.div.core" },
  researcher: { roleKey: "net.tip.researcher", divKey: "net.div.core" },
};

function initNodes(w: number, h: number): AgentNode[] {
  const cx = w / 2;
  const cy = h / 2;
  return AGENT_DEFS.map((def, i) => {
    if (def.id === "conductor") {
      return { ...def, x: cx, y: cy, vx: 0, vy: 0 };
    }
    const angle = ((i - 1) / (AGENT_DEFS.length - 1)) * Math.PI * 2 - Math.PI / 2;
    const r = Math.min(w, h) * 0.32;
    return {
      ...def,
      x: cx + Math.cos(angle) * r + (Math.random() - 0.5) * 30,
      y: cy + Math.sin(angle) * r + (Math.random() - 0.5) * 30,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
    };
  });
}

function initParticles(): Particle[] {
  const particles: Particle[] = [];
  CONNECTIONS.forEach((conn) => {
    const count = Math.ceil(conn.strength * 2);
    for (let i = 0; i < count; i++) {
      particles.push({
        fromId: Math.random() > 0.5 ? conn.from : conn.to,
        toId: Math.random() > 0.5 ? conn.to : conn.from,
        progress: Math.random(),
        speed: 0.002 + Math.random() * 0.004,
        color: Math.random() > 0.5 ? CYAN : AMBER,
      });
    }
  });
  return particles;
}

export default function AgentNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<AgentNode[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const activeIdRef = useRef<string>("conductor");
  const animRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isVisibleRef = useRef(true);

  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  const [activeAgent, setActiveAgent] = useState<number>(0);
  const [dimensions, setDimensions] = useState({ w: 600, h: 400 });
  const [isMobile, setIsMobile] = useState(false);
  const { t } = useI18n();

  const displayedId = hoveredAgent !== null ? hoveredAgent : WORKFLOW_ORDER[activeAgent];
  const displayedDef = AGENT_DEFS.find((a) => a.id === displayedId)!;
  const displayedInfo = AGENT_INFO[displayedId];

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    activeIdRef.current = displayedId;
  }, [displayedId]);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActiveAgent((prev) => (prev + 1) % WORKFLOW_ORDER.length);
    }, 2500);
  }, []);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  // Visibility observer
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

  // Resize handler (desktop only)
  useEffect(() => {
    if (isMobile) return;
    const container = containerRef.current;
    if (!container) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const w = Math.floor(width);
      const h = Math.floor(Math.max(height, 350));
      setDimensions({ w, h });
      nodesRef.current = initNodes(w, h);
      particlesRef.current = initParticles();
    });
    obs.observe(container);
    return () => obs.disconnect();
  }, [isMobile]);

  // Mouse interaction (desktop only)
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    let found: string | null = null;
    for (const node of nodesRef.current) {
      const dx = mx - node.x;
      const dy = my - node.y;
      if (Math.sqrt(dx * dx + dy * dy) < node.radius + 8) {
        found = node.id;
        break;
      }
    }
    if (found !== hoveredAgent) {
      setHoveredAgent(found);
      if (found) {
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        startTimer();
      }
    }
    canvas.style.cursor = found ? "pointer" : "default";
  }, [hoveredAgent, startTimer]);

  const handleMouseLeave = useCallback(() => {
    setHoveredAgent(null);
    startTimer();
  }, [startTimer]);

  // Animation loop (desktop only)
  useEffect(() => {
    if (isMobile) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = dimensions.w;
    canvas.height = dimensions.h;
    if (nodesRef.current.length === 0) {
      nodesRef.current = initNodes(dimensions.w, dimensions.h);
      particlesRef.current = initParticles();
    }

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      if (!isVisibleRef.current) return;
      const nodes = nodesRef.current;
      const particles = particlesRef.current;
      const hovered = activeIdRef.current;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // Gentle drift
      nodes.forEach((node) => {
        if (node.id === "conductor") return;
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < node.radius + 10 || node.x > w - node.radius - 10) node.vx *= -1;
        if (node.y < node.radius + 10 || node.y > h - node.radius - 10) node.vy *= -1;
        node.vx += (Math.random() - 0.5) * 0.02;
        node.vy += (Math.random() - 0.5) * 0.02;
        node.vx *= 0.99;
        node.vy *= 0.99;
      });

      const nodeMap = new Map(nodes.map((n) => [n.id, n]));

      // Draw connections
      CONNECTIONS.forEach((conn) => {
        const from = nodeMap.get(conn.from);
        const to = nodeMap.get(conn.to);
        if (!from || !to) return;
        const isHighlighted = hovered && (conn.from === hovered || conn.to === hovered);
        const alpha = isHighlighted ? 0.5 : 0.12;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = isHighlighted
          ? (from.color === CYAN ? `rgba(0, 212, 255, ${alpha})` : `rgba(255, 179, 71, ${alpha})`)
          : `rgba(136, 146, 176, ${alpha})`;
        ctx.lineWidth = isHighlighted ? 1.5 : 0.8;
        ctx.stroke();
      });

      // Draw particles
      particles.forEach((p) => {
        const from = nodeMap.get(p.fromId);
        const to = nodeMap.get(p.toId);
        if (!from || !to) return;
        p.progress += p.speed;
        if (p.progress > 1) {
          p.progress = 0;
          if (Math.random() > 0.5) {
            const tmp = p.fromId;
            p.fromId = p.toId;
            p.toId = tmp;
          }
        }
        const x = from.x + (to.x - from.x) * p.progress;
        const y = from.y + (to.y - from.y) * p.progress;
        const isRelevant = hovered && (p.fromId === hovered || p.toId === hovered);
        const particleAlpha = isRelevant ? 0.9 : 0.4;
        const particleSize = isRelevant ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.arc(x, y, particleSize, 0, Math.PI * 2);
        ctx.fillStyle = p.color === CYAN
          ? `rgba(0, 212, 255, ${particleAlpha})`
          : `rgba(255, 179, 71, ${particleAlpha})`;
        ctx.fill();
      });

      // Draw nodes
      nodes.forEach((node) => {
        const isHovered = hovered === node.id;
        const isConnected = hovered && CONNECTIONS.some(
          (c) => (c.from === hovered && c.to === node.id) || (c.to === hovered && c.from === node.id)
        );
        const isDimmed = hovered && !isHovered && !isConnected;
        const alpha = isDimmed ? 0.3 : 1;
        const r = isHovered ? node.radius * 1.2 : node.radius;

        if (isHovered || isConnected) {
          const glow = ctx.createRadialGradient(node.x, node.y, r * 0.5, node.x, node.y, r * 2.5);
          glow.addColorStop(0, node.color === CYAN ? "rgba(0, 212, 255, 0.25)" : "rgba(255, 179, 71, 0.25)");
          glow.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.beginPath();
          ctx.arc(node.x, node.y, r * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();
        }

        if (isHovered) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r * 1.6, 0, Math.PI * 2);
          ctx.strokeStyle = node.color === CYAN
            ? "rgba(0, 212, 255, 0.2)"
            : "rgba(255, 179, 71, 0.2)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        const fillColor = node.color === CYAN
          ? `rgba(0, 212, 255, ${alpha * 0.15})`
          : `rgba(255, 179, 71, ${alpha * 0.15})`;
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.strokeStyle = node.color === CYAN
          ? `rgba(0, 212, 255, ${alpha * 0.7})`
          : `rgba(255, 179, 71, ${alpha * 0.7})`;
        ctx.lineWidth = isHovered ? 2 : 1.2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(node.x, node.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = node.color === CYAN
          ? `rgba(0, 212, 255, ${alpha})`
          : `rgba(255, 179, 71, ${alpha})`;
        ctx.fill();

        ctx.font = `${isHovered ? "600" : "500"} ${isHovered ? "11px" : "10px"} 'JetBrains Mono', monospace`;
        ctx.textAlign = "center";
        ctx.fillStyle = `rgba(255, 255, 255, ${isDimmed ? 0.3 : 0.85})`;
        ctx.fillText(t(node.labelKey), node.x, node.y + r + 14);
      });
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [dimensions, t, isMobile]);

  // ─── MOBILE LAYOUT ───
  if (isMobile) {
    return (
      <div ref={containerRef} className="relative w-full">
        {/* Legend */}
        <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground mb-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-prism-cyan" />
            {t("net.legend.tech")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-prism-amber" />
            {t("net.legend.biz")}
          </span>
        </div>

        {/* Agent grid - 3 columns */}
        <div className="grid grid-cols-3 gap-1.5">
          {WORKFLOW_ORDER.map((agentId, i) => {
            const def = AGENT_DEFS.find((a) => a.id === agentId)!;
            const isActive = displayedId === agentId;
            return (
              <button
                key={agentId}
                onClick={() => {
                  setActiveAgent(i);
                  setHoveredAgent(null);
                  startTimer();
                }}
                className="flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-300"
                style={{
                  backgroundColor: isActive ? def.color + "15" : "transparent",
                  border: `1px solid ${isActive ? def.color + "40" : "transparent"}`,
                }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300"
                  style={{
                    backgroundColor: def.color + (isActive ? "20" : "08"),
                    border: `1.5px solid ${def.color}${isActive ? "70" : "25"}`,
                    boxShadow: isActive ? `0 0 12px ${def.color}30` : "none",
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: def.color, opacity: isActive ? 1 : 0.5 }}
                  />
                </div>
                <span
                  className="text-[10px] font-mono text-center leading-tight"
                  style={{ color: isActive ? def.color : "rgba(255,255,255,0.5)" }}
                >
                  {t(def.labelKey)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Bottom info panel */}
        <div
          className="mt-3 rounded-lg p-3 transition-all duration-500 border"
          style={{
            borderColor: displayedDef.color + "40",
            backgroundColor: displayedDef.color + "08",
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: displayedDef.color }}
            />
            <span
              className="text-sm font-display font-bold"
              style={{ color: displayedDef.color }}
            >
              {t(displayedDef.labelKey)}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              · {t(displayedInfo.divKey)}
            </span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed mt-1.5">
            {t(displayedInfo.roleKey)}
          </p>

          {/* Connected agents */}
          <div className="flex items-center gap-1.5 mt-2 text-xs font-mono flex-wrap">
            <span className="text-muted-foreground/60 text-[10px]">
              {t("net.legend.tech") === "技术智能体" ? "协作:" : "Connects:"}
            </span>
            {CONNECTIONS
              .filter((c) => c.from === displayedId || c.to === displayedId)
              .map((c) => {
                const otherId = c.from === displayedId ? c.to : c.from;
                const otherDef = AGENT_DEFS.find((a) => a.id === otherId);
                if (!otherDef) return null;
                return (
                  <span
                    key={otherId}
                    className="px-1 py-0.5 rounded text-[9px]"
                    style={{
                      color: otherDef.color,
                      backgroundColor: otherDef.color + "15",
                      border: `1px solid ${otherDef.color}25`,
                    }}
                  >
                    {t(otherDef.labelKey)}
                  </span>
                );
              })}
          </div>

          {/* Workflow indicator dots */}
          <div className="flex items-center gap-1 mt-2.5">
            {WORKFLOW_ORDER.map((agentId, i) => {
              const def = AGENT_DEFS.find((a) => a.id === agentId)!;
              const isActive = displayedId === agentId;
              return (
                <button
                  key={agentId}
                  onClick={() => {
                    setActiveAgent(i);
                    setHoveredAgent(null);
                    startTimer();
                  }}
                  className="transition-all duration-300"
                  style={{
                    width: isActive ? 16 : 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: isActive ? def.color : def.color + "40",
                  }}
                  aria-label={agentId}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ─── DESKTOP LAYOUT ───
  return (
    <div className="relative w-full">
      <div ref={containerRef} className="relative w-full h-[380px] sm:h-[420px]">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full"
        />
        <div className="absolute top-3 right-3 flex items-center gap-4 text-[10px] font-mono text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-prism-cyan" />
            {t("net.legend.tech")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-prism-amber" />
            {t("net.legend.biz")}
          </span>
        </div>
      </div>

      {/* Bottom info panel */}
      <div
        className="mt-3 rounded-lg p-4 transition-all duration-500 border"
        style={{
          borderColor: displayedDef.color + "40",
          backgroundColor: displayedDef.color + "08",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: displayedDef.color }}
            />
            <span
              className="text-base font-display font-bold"
              style={{ color: displayedDef.color }}
            >
              {t(displayedDef.labelKey)}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              · {t(displayedInfo.divKey)}
            </span>
          </div>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed mt-2">
          {t(displayedInfo.roleKey)}
        </p>

        <div className="flex items-center gap-2 mt-2.5 text-xs font-mono flex-wrap">
          <span className="text-muted-foreground/60">
            {t("net.legend.tech") === "技术智能体" ? "协作:" : "Connects:"}
          </span>
          {CONNECTIONS
            .filter((c) => c.from === displayedId || c.to === displayedId)
            .map((c) => {
              const otherId = c.from === displayedId ? c.to : c.from;
              const otherDef = AGENT_DEFS.find((a) => a.id === otherId);
              if (!otherDef) return null;
              return (
                <span
                  key={otherId}
                  className="px-1.5 py-0.5 rounded text-[10px]"
                  style={{
                    color: otherDef.color,
                    backgroundColor: otherDef.color + "15",
                    border: `1px solid ${otherDef.color}25`,
                  }}
                >
                  {t(otherDef.labelKey)}
                </span>
              );
            })}
        </div>

        <div className="flex items-center gap-1.5 mt-3">
          {WORKFLOW_ORDER.map((agentId, i) => {
            const def = AGENT_DEFS.find((a) => a.id === agentId)!;
            const isActive = displayedId === agentId;
            return (
              <button
                key={agentId}
                onClick={() => {
                  setActiveAgent(i);
                  setHoveredAgent(null);
                  startTimer();
                }}
                className="transition-all duration-300"
                style={{
                  width: isActive ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: isActive ? def.color : def.color + "40",
                }}
                aria-label={agentId}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
