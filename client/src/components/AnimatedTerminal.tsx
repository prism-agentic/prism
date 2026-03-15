/*
 * AnimatedTerminal — Typewriter-style terminal animation for Hero section
 * Simulates a PRISM AI Agent building workflow with progressive line reveals
 * Terminal window stays fixed size; content scrolls up as new lines appear.
 */
import { useState, useEffect, useRef, useCallback } from "react";

/* ── Line definitions ── */
interface TermLine {
  text: string;
  color?: string;       // tailwind text color class
  delay?: number;       // ms before this line starts appearing
  typewriter?: boolean; // true = type char by char
  progress?: boolean;   // animated progress bar
}

const LINES: TermLine[] = [
  // User input
  { text: "> 为我的业务构建 AI Agent", color: "text-foreground", typewriter: true, delay: 600 },
  { text: "", delay: 400 },
  // Conductor analysis
  { text: "🎯 指挥官: 分析需求...识别为智能体开发任务", color: "text-prism-cyan", delay: 300, typewriter: true },
  { text: "🔍 调研员: 调研 AutoGPT, CrewAI, LangGraph...", color: "text-prism-cyan", delay: 400, typewriter: true },
  { text: "📋 产品经理: 确认核心能力 — 对话 / 决策 / 执行", color: "text-prism-cyan", delay: 400, typewriter: true },
  { text: "✓ 需求确认完成", color: "text-green-400", delay: 600 },
  { text: "", delay: 300 },
  // Pipeline
  { text: "→ 流水线启动 — 9 个智能体协作中", color: "text-prism-amber", delay: 300 },
  { text: "  后端架构师: 设计 Agent 运行时...", color: "text-muted-foreground", delay: 350, typewriter: true },
  { text: "  前端开发者: 构建交互界面...", color: "text-muted-foreground", delay: 350, typewriter: true },
  { text: "  质量评审员: 验收通过 ✓", color: "text-muted-foreground", delay: 350, typewriter: true },
  { text: "", delay: 200 },
  // Progress bar
  { text: "PROGRESS_BAR", delay: 100, progress: true },
  { text: "", delay: 400 },
  // Result
  { text: "✓ 交付完成 — 你的专属 AI Agent 已就绪", color: "text-green-400", delay: 500 },
  { text: "→ 进化引擎: 经验已存储，下次更聪明 ↑", color: "text-prism-amber", delay: 600 },
];

const TYPE_SPEED = 28;       // ms per character for typewriter
const RESTART_DELAY = 4000;  // ms before loop restarts

/* ── Progress bar component ── */
function ProgressBar({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const doneCalled = useRef(false);
  const DURATION = 1800;

  useEffect(() => {
    doneCalled.current = false;
    startRef.current = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const p = Math.min(elapsed / DURATION, 1);
      setPct(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else if (!doneCalled.current) {
        doneCalled.current = true;
        onDone();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filled = Math.round(pct * 20);
  const bar = "█".repeat(filled) + "░".repeat(20 - filled);
  const label = `${Math.round(pct * 100)}%`;

  return (
    <span className="text-prism-cyan">
      {"  进度 ["}<span className="text-prism-amber">{bar}</span>{`] ${label}`}
    </span>
  );
}

/* ── Typewriter line component ── */
function TypewriterLine({
  text,
  color,
  speed,
  onDone,
}: {
  text: string;
  color?: string;
  speed: number;
  onDone: () => void;
}) {
  const [charIndex, setCharIndex] = useState(0);
  const doneCalled = useRef(false);

  useEffect(() => {
    doneCalled.current = false;
    setCharIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  useEffect(() => {
    if (charIndex < text.length) {
      const timer = setTimeout(() => setCharIndex((i) => i + 1), speed);
      return () => clearTimeout(timer);
    } else if (text.length > 0 && !doneCalled.current) {
      doneCalled.current = true;
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charIndex, text.length, speed]);

  return (
    <span className={color}>
      {text.slice(0, charIndex)}
      {charIndex < text.length && <span className="animate-pulse text-prism-cyan">▌</span>}
    </span>
  );
}

/* ── Rendered line component ── */
function RenderedLine({
  line,
  isActive,
  onDone,
}: {
  line: TermLine;
  isActive: boolean;
  onDone: () => void;
}) {
  if (line.progress && isActive) {
    return <ProgressBar onDone={onDone} />;
  }
  if (line.progress && !isActive) {
    return (
      <span className="text-prism-cyan">
        {"  进度 ["}<span className="text-prism-amber">{"█".repeat(20)}</span>{"] 100%"}
      </span>
    );
  }
  if (line.typewriter && isActive) {
    return (
      <TypewriterLine
        text={line.text}
        color={line.color}
        speed={TYPE_SPEED}
        onDone={onDone}
      />
    );
  }
  return <span className={line.color || "text-muted-foreground"}>{line.text}</span>;
}

/* ── Main component ── */
export default function AnimatedTerminal() {
  const [currentLine, setCurrentLine] = useState(-1);
  const [cycle, setCycle] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever currentLine changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentLine]);

  // Start the first line after initial delay
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setCurrentLine(0);
    }, LINES[0]?.delay ?? 600);
    return () => clearTimeout(timerRef.current);
  }, [cycle]);

  const handleLineDone = useCallback((lineIndex: number) => {
    const nextIndex = lineIndex + 1;
    if (nextIndex >= LINES.length) {
      timerRef.current = setTimeout(() => {
        setCurrentLine(-1);
        setCycle((c) => c + 1);
      }, RESTART_DELAY);
      return;
    }
    const nextLine = LINES[nextIndex];
    const delay = nextLine?.delay ?? 200;
    timerRef.current = setTimeout(() => {
      setCurrentLine(nextIndex);
    }, delay);
  }, []);

  // For non-typewriter, non-progress lines, auto-advance when they appear
  useEffect(() => {
    if (currentLine < 0 || currentLine >= LINES.length) return;
    const line = LINES[currentLine];
    if (!line.typewriter && !line.progress) {
      const timer = setTimeout(() => {
        handleLineDone(currentLine);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [currentLine, handleLineDone]);

  // Clean up on unmount
  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <div className="glass-card rounded-xl p-1 glow-cyan">
      {/* Terminal header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <div className="w-3 h-3 rounded-full bg-green-500/70" />
        </div>
        <span className="text-xs text-muted-foreground font-mono ml-2">prism-cli</span>
      </div>
      {/* Terminal body — fixed height, content scrolls */}
      <div
        ref={scrollRef}
        className="p-4 font-mono text-sm leading-relaxed h-[320px] overflow-y-auto scrollbar-hide"
        key={cycle}
      >
        {LINES.map((line, i) => {
          if (i > currentLine) return null;
          const isActive = i === currentLine;
          return (
            <div key={`${cycle}-${i}`} className="min-h-[1.5em]">
              <RenderedLine
                line={line}
                isActive={isActive}
                onDone={() => handleLineDone(i)}
              />
            </div>
          );
        })}
        {/* Blinking cursor at the end */}
        {currentLine >= 0 && (
          <div className="min-h-[1.5em]">
            {currentLine >= LINES.length - 1 && (
              <span className="animate-pulse text-prism-cyan">▌</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
