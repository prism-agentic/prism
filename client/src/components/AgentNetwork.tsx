/*
 * PRISM Agent Network — Interactive Multi-Agent Collaboration Visualization
 * Canvas-based animated network showing agents as nodes with data flowing between them
 * Hover to highlight agent connections, click to see agent details
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
  strength: number; // 0-1
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

function initNodes(w: number, h: number): AgentNode[] {
  const cx = w / 2;
  const cy = h / 2;
  // Place conductor at center, others in a circle
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
  const hoveredRef = useRef<string | null>(null);
  const animRef = useRef<number>(0);
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ w: 600, h: 400 });
  const { t } = useI18n();

  // Resize handler
  useEffect(() => {
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
  }, []);

  // Mouse interaction
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
    hoveredRef.current = found;
    setHoveredAgent(found);
    canvas.style.cursor = found ? "pointer" : "default";
  }, []);

  // Animation loop
  useEffect(() => {
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
      const nodes = nodesRef.current;
      const particles = particlesRef.current;
      const hovered = hoveredRef.current;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // Gentle drift
      nodes.forEach((node) => {
        if (node.id === "conductor") return;
        node.x += node.vx;
        node.y += node.vy;
        // Bounce off edges
        if (node.x < node.radius + 10 || node.x > w - node.radius - 10) node.vx *= -1;
        if (node.y < node.radius + 10 || node.y > h - node.radius - 10) node.vy *= -1;
        // Slight random drift
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
          ? (from.color === CYAN || to.color === CYAN ? `rgba(0, 212, 255, ${alpha})` : `rgba(255, 179, 71, ${alpha})`)
          : `rgba(255, 255, 255, ${alpha})`;
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
          // Swap direction randomly
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

        // Glow
        if (isHovered || isConnected) {
          const glow = ctx.createRadialGradient(node.x, node.y, r * 0.5, node.x, node.y, r * 2.5);
          glow.addColorStop(0, node.color === CYAN ? "rgba(0, 212, 255, 0.25)" : "rgba(255, 179, 71, 0.25)");
          glow.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.beginPath();
          ctx.arc(node.x, node.y, r * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();
        }

        // Node circle
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

        // Inner dot
        ctx.beginPath();
        ctx.arc(node.x, node.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = node.color === CYAN
          ? `rgba(0, 212, 255, ${alpha})`
          : `rgba(255, 179, 71, ${alpha})`;
        ctx.fill();

        // Label
        ctx.font = `${isHovered ? "600" : "500"} ${isHovered ? "11px" : "10px"} 'JetBrains Mono', monospace`;
        ctx.textAlign = "center";
        ctx.fillStyle = `rgba(255, 255, 255, ${isDimmed ? 0.3 : 0.85})`;
        ctx.fillText(t(node.labelKey), node.x, node.y + r + 14);
      });

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [dimensions, t]);

  // Tooltip data
  const agentInfo: Record<string, { roleKey: string; divKey: string }> = {
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

  return (
    <div ref={containerRef} className="relative w-full h-[400px] sm:h-[450px]">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { hoveredRef.current = null; setHoveredAgent(null); }}
        className="w-full h-full"
      />
      {/* Tooltip */}
      {hoveredAgent && agentInfo[hoveredAgent] && (
        <div className="absolute bottom-4 left-4 glass-card rounded-lg px-4 py-3 max-w-[240px] pointer-events-none">
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full ${
              AGENT_DEFS.find(a => a.id === hoveredAgent)?.color === CYAN ? "bg-prism-cyan" : "bg-prism-amber"
            }`} />
            <span className="font-mono text-xs font-semibold text-foreground">{t(AGENT_DEFS.find(a => a.id === hoveredAgent)?.labelKey || "")}</span>
            <span className="text-xs text-muted-foreground font-mono">· {t(agentInfo[hoveredAgent].divKey)}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{t(agentInfo[hoveredAgent].roleKey)}</p>
        </div>
      )}
      {/* Legend */}
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
  );
}
