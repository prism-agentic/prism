/**
 * ModelSelector — Compact model picker for the Workspace sidebar.
 * Shows current model with a dropdown to switch between available OpenRouter models.
 */
import { trpc } from "@/lib/trpc";
import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  Cpu,
  Check,
  Sparkles,
  Zap,
  Crown,
  Loader2,
} from "lucide-react";

// Provider brand colors
const PROVIDER_COLORS: Record<string, string> = {
  Google: "#4285F4",
  Anthropic: "#D97757",
  OpenAI: "#10A37F",
  DeepSeek: "#4D6BFE",
  Meta: "#0668E1",
};

const TIER_CONFIG = {
  free: { label: "Free", icon: Zap, className: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  standard: { label: "Standard", icon: Sparkles, className: "text-prism-cyan bg-prism-cyan/10 border-prism-cyan/20" },
  premium: { label: "Premium", icon: Crown, className: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
};

function formatContextWindow(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(0)}M`;
  return `${(tokens / 1000).toFixed(0)}K`;
}

export default function ModelSelector({ projectId }: { projectId: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const projectQuery = trpc.project.get.useQuery({ id: projectId });
  const modelsQuery = trpc.project.availableModels.useQuery();
  const updateModelMutation = trpc.project.updateModel.useMutation({
    onSuccess: () => {
      projectQuery.refetch();
      setIsOpen(false);
    },
  });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const models = modelsQuery.data || [];
  const currentModelId = (projectQuery.data as any)?.modelId || "google/gemini-2.5-flash";
  const currentModel = models.find(m => m.id === currentModelId);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg border border-border/50 hover:border-prism-cyan/30 bg-card/50 transition-all group"
      >
        <div
          className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${PROVIDER_COLORS[currentModel?.provider || "Google"]}20` }}
        >
          <Cpu className="w-3 h-3" style={{ color: PROVIDER_COLORS[currentModel?.provider || "Google"] }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">
            {currentModel?.name || "Gemini 2.5 Flash"}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {currentModel?.provider || "Google"}
          </p>
        </div>
        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 bottom-full mb-1 z-50 bg-card border border-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden max-h-[400px] overflow-y-auto">
          <div className="p-2 border-b border-border/50">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2">
              Select Model
            </p>
          </div>
          <div className="p-1.5 space-y-0.5">
            {models.map(model => {
              const isSelected = model.id === currentModelId;
              const tier = TIER_CONFIG[model.tier];
              const TierIcon = tier.icon;
              const providerColor = PROVIDER_COLORS[model.provider] || "#888";

              return (
                <button
                  key={model.id}
                  onClick={() => {
                    if (!isSelected) {
                      updateModelMutation.mutate({ id: projectId, modelId: model.id });
                    }
                  }}
                  disabled={updateModelMutation.isPending}
                  className={`w-full text-left p-2.5 rounded-lg transition-all ${
                    isSelected
                      ? "bg-prism-cyan/10 border border-prism-cyan/30"
                      : "hover:bg-card border border-transparent hover:border-border/50"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Provider Icon */}
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: `${providerColor}15` }}
                    >
                      <Cpu className="w-3.5 h-3.5" style={{ color: providerColor }} />
                    </div>

                    {/* Model Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold truncate">{model.name}</span>
                        {isSelected && <Check className="w-3 h-3 text-prism-cyan flex-shrink-0" />}
                        {updateModelMutation.isPending && updateModelMutation.variables?.modelId === model.id && (
                          <Loader2 className="w-3 h-3 animate-spin text-prism-cyan flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                        {model.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {/* Tier Badge */}
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-medium rounded-full border ${tier.className}`}>
                          <TierIcon className="w-2.5 h-2.5" />
                          {tier.label}
                        </span>
                        {/* Context Window */}
                        <span className="text-[9px] text-muted-foreground">
                          {formatContextWindow(model.contextWindow)} ctx
                        </span>
                        {/* Pricing */}
                        <span className="text-[9px] text-muted-foreground">
                          {model.pricing}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
