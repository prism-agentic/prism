import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Plus,
  FolderOpen,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Play,
  Trash2,
  ArrowLeft,
  Zap,
  Activity,
  LayoutDashboard,
} from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  idle: "空闲",
  running: "运行中",
  completed: "已完成",
  failed: "失败",
};

const TEMPLATES = [
  { id: "saas-mvp", name: "SaaS MVP 开发", icon: "🚀", description: "全栈 SaaS 应用，含认证、计费和管理面板" },
  { id: "market-research", name: "市场调研", icon: "📊", description: "全面的市场分析，含竞品洞察报告" },
  { id: "tech-design", name: "技术架构设计", icon: "🏗️", description: "系统设计文档，含架构图和技术规格" },
  { id: "landing-page", name: "落地页设计", icon: "🎨", description: "高转化率落地页，含文案和视觉设计" },
  { id: "api-service", name: "API 服务", icon: "⚡", description: "RESTful API 开发，含文档和测试" },
  { id: "custom", name: "自定义任务", icon: "✨", description: "描述任何任务，交给智能体团队完成" },
];

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; icon: React.ReactNode }> = {
    idle: { color: "text-muted-foreground border-border", icon: <Clock className="w-3 h-3" /> },
    running: { color: "text-prism-cyan border-prism-cyan/30", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    completed: { color: "text-emerald-400 border-emerald-400/30", icon: <CheckCircle2 className="w-3 h-3" /> },
    failed: { color: "text-red-400 border-red-400/30", icon: <AlertCircle className="w-3 h-3" /> },
  };
  const c = config[status] || config.idle;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs border rounded-full ${c.color}`}>
      {c.icon}
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export default function Dashboard() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("custom");

  const projectsQuery = trpc.project.list.useQuery(undefined, { enabled: isAuthenticated });
  const createMutation = trpc.project.create.useMutation({
    onSuccess: (data) => {
      projectsQuery.refetch();
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
      navigate(`/workspace/${data.id}`);
    },
  });
  const deleteMutation = trpc.project.delete.useMutation({
    onSuccess: () => projectsQuery.refetch(),
  });

  // Redirect to login if not authenticated
  if (!authLoading && !isAuthenticated) {
    window.location.href = getLoginUrl();
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-prism-cyan" />
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-prism-cyan/30 border-t-prism-cyan rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground font-mono">加载中...</span>
        </div>
      </div>
    );
  }

  const projects = projectsQuery.data || [];
  const runningCount = projects.filter(p => p.status === "running").length;
  const completedCount = projects.filter(p => p.status === "completed").length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 顶部导航 */}
      <nav className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-foreground hover:text-prism-cyan transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="font-display font-bold text-lg">PRISM</span>
            </Link>
            <span className="text-border">|</span>
            <span className="text-muted-foreground text-sm flex items-center gap-1.5">
              <LayoutDashboard className="w-4 h-4" />
              控制台
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {user?.name || user?.email || "用户"}
            </span>
            <div className="w-8 h-8 rounded-full bg-prism-cyan/20 border border-prism-cyan/30 flex items-center justify-center text-prism-cyan text-sm font-bold">
              {(user?.name || "U")[0].toUpperCase()}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-prism-cyan/10 flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-prism-cyan" />
              </div>
              <div>
                <p className="text-2xl font-bold">{projects.length}</p>
                <p className="text-xs text-muted-foreground">全部项目</p>
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-prism-cyan/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-prism-cyan" />
              </div>
              <div>
                <p className="text-2xl font-bold">{runningCount}</p>
                <p className="text-xs text-muted-foreground">运行中</p>
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedCount}</p>
                <p className="text-xs text-muted-foreground">已完成</p>
              </div>
            </div>
          </div>
        </div>

        {/* 标题 + 创建按钮 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-display font-bold">我的项目</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-prism-cyan text-prism-navy font-semibold rounded-lg hover:bg-prism-cyan/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建项目
          </button>
        </div>

        {/* 创建项目弹窗 */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
            <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-display font-bold">创建新项目</h3>
                <p className="text-sm text-muted-foreground mt-1">选择一个模板快速开始，或描述自定义任务</p>
              </div>

              {/* 模板网格 */}
              <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTemplate(t.id);
                      if (t.id !== "custom") setNewName(t.name);
                    }}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      selectedTemplate === t.id
                        ? "border-prism-cyan bg-prism-cyan/10"
                        : "border-border hover:border-prism-cyan/30"
                    }`}
                  >
                    <span className="text-2xl">{t.icon}</span>
                    <p className="text-sm font-semibold mt-2">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                  </button>
                ))}
              </div>

              {/* 表单 */}
              <div className="p-6 border-t border-border space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">项目名称</label>
                  <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="我的 PRISM 项目"
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-prism-cyan/50"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">项目描述（可选）</label>
                  <textarea
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="描述你想要构建的产品..."
                    rows={3}
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-prism-cyan/50 resize-none"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      if (!newName.trim()) return;
                      createMutation.mutate({
                        name: newName.trim(),
                        description: newDesc.trim() || undefined,
                        template: selectedTemplate,
                      });
                    }}
                    disabled={!newName.trim() || createMutation.isPending}
                    className="flex items-center gap-2 px-5 py-2 bg-prism-cyan text-prism-navy font-semibold rounded-lg hover:bg-prism-cyan/90 transition-colors disabled:opacity-50"
                  >
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    创建并开始
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 项目列表 */}
        {projectsQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-prism-cyan" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-prism-cyan/10 flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="w-8 h-8 text-prism-cyan/50" />
            </div>
            <h3 className="text-lg font-semibold mb-2">暂无项目</h3>
            <p className="text-muted-foreground text-sm mb-6">创建你的第一个项目，体验多智能体协作</p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-prism-cyan text-prism-navy font-semibold rounded-lg hover:bg-prism-cyan/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              创建项目
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <div
                key={project.id}
                className="glass-card rounded-xl p-5 hover:border-prism-cyan/30 transition-all group cursor-pointer"
                onClick={() => navigate(`/workspace/${project.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate group-hover:text-prism-cyan transition-colors">
                      {project.name}
                    </h3>
                    {project.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
                    )}
                  </div>
                  <StatusBadge status={project.status} />
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">
                    {new Date(project.updatedAt).toLocaleDateString("zh-CN")}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/workspace/${project.id}`);
                      }}
                      className="p-1.5 rounded-md hover:bg-prism-cyan/10 text-muted-foreground hover:text-prism-cyan transition-colors"
                      title="打开工作台"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("确定要删除这个项目吗？")) {
                          deleteMutation.mutate({ id: project.id });
                        }
                      }}
                      className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
