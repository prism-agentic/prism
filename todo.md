# PRISM Cloud Platform TODO

## 已完成 — Landing Page
- [x] Neural Constellation 暗色主题设计
- [x] 中英文国际化
- [x] 交互式 SVG 架构/流水线/进化图
- [x] Canvas Agent Network 自动轮动
- [x] 性能优化（代码分割、懒加载、依赖清理）
- [x] 移动端可视化图表适配

## Phase 1 — 全栈基础设施
- [x] 升级为全栈应用（数据库、用户认证、tRPC）
- [x] 推送数据库 schema
- [x] 设计数据库表结构（projects、tasks、agent_logs）
- [x] 创建 tRPC 路由（project CRUD、task 管理、agent 模拟）
- [x] 构建智能体流水线模拟器（agentSimulator）

## Phase 2 — 核心页面
- [x] 改造 App.tsx 路由：Landing(/) + Dashboard(/dashboard) + Workspace(/workspace/:id)
- [x] 实现 Dashboard 项目管理面板（项目列表、创建项目、统计卡片）
- [x] 实现 Workspace 核心工作台（任务输入、智能体协作可视化、实时日志）
- [x] 首页 Hero 添加"立即体验"CTA 按钮

## Phase 3 — 交互与体验
- [x] 场景模板选择（Build SaaS MVP、市场调研、技术方案）
- [x] 智能体协作流水线动画（实时展示各阶段进度）
- [x] 任务结果交付展示（完成摘要）
- [x] 整合首页入口（Landing → Dashboard 无缝跳转）

## Phase 4 — 优化与测试
- [x] 编写 vitest 测试（10 tests passing）
- [x] 保存 checkpoint

## 未来增强
- [ ] Agent Monitor 实时监控面板
- [ ] 接入真实 LLM API 驱动智能体
- [ ] 项目模板预配置智能体
- [ ] 导出/分享任务结果
- [ ] Navbar 移动端汉堡菜单
- [ ] 滚动进入动画

## Phase 5 — LLM 驱动智能体
- [x] 研究内置 invokeLLM 接口
- [x] 设计 9 个智能体的 system prompt
- [x] 实现上下文传递链（前一个智能体输出 → 下一个智能体输入）
- [x] 改造 agentSimulator 为 LLM 驱动
- [x] 优化 Workspace 前端展示 Markdown 富文本
- [x] 添加 LLM 调用重试机制（3次重试+指数退避）
- [x] 保存 checkpoint

## Phase 6 — 任务结果结构化展示与导出
- [x] 创建 TaskResults 组件：按智能体角色分类展示交付物
- [x] 实现交付物分类标签页（需求文档/技术设计/代码/策略）
- [x] 支持 Markdown 全文导出
- [x] 支持单个智能体输出复制/导出
- [x] 添加任务结果概览卡片

## Phase 7 — Agent Monitor 实时监控页面
- [x] 创建 /monitor/:taskId 路由和页面
- [x] 实现智能体协作网络可视化（实时状态）
- [x] 显示各智能体工作进度和耗时统计
- [x] 添加流水线阶段进度条

## Phase 8 — Workspace 交互增强
- [x] 改进任务完成后的结果展示区域
- [x] 添加任务历史详情查看
- [x] 优化移动端 Workspace 布局
- [x] 编写/更新 vitest 测试
- [ ] 保存 checkpoint
