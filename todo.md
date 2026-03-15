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
- [x] 保存 checkpoint

## Phase 9 — 需求澄清交互阶段（Human-in-the-Loop）
- [ ] 设计需求澄清机制：Conductor + Researcher 先分析 → 生成澄清问题 → 等待用户回答 → 再继续执行
- [ ] 后端：拆分流水线为"澄清阶段"和"执行阶段"，支持暂停/恢复
- [ ] 后端：新增 task.clarify mutation 接收用户回答
- [ ] 后端：Conductor 智能体生成结构化澄清问题（目标用户、核心功能、技术偏好等）
- [ ] 前端：Workspace 中显示澄清问题卡片，用户可逐项回答
- [ ] 前端：支持用户跳过澄清直接执行（快速模式）
- [ ] 更新后续智能体 prompt，注入用户澄清后的完整上下文
- [x] 编写/更新 vitest 测试（31 个测试全部通过）
- [x] 保存 checkpoint

## Phase 9 — 结构化需求会议 + 智能路由（Human-in-the-Loop v2）
- [x] 数据库：tasks 表增加 clarifying 状态、meetingRound、requirementsBrief 字段，新增 meetingMessages 表
- [x] 后端：Round 1 固定分析链（Conductor 分析 → Researcher 竞品调研 → PM 结构化提问）
- [x] 后端：Round 1 完成后暂停流水线，等待用户回复
- [x] 后端：Round 2 智能路由（Conductor 分类用户回复 → 分发给对应 Agent 追问）
- [x] 后端：task.reply mutation 接收用户回复并触发智能路由
- [x] 后端：task.confirmMeeting mutation 结束会议，PM 生成需求简报
- [x] 后端：支持用户跳过会议直接执行（快速模式）
- [x] 前端：Workspace 会议模式 UI（发言人头像、会议记录风格、回复输入框）
- [x] 前端：跳过/确认/继续讨论按钮 + Meeting/Fast Mode 切换
- [x] 更新后续 Agent prompt 注入需求简报 + 竞品情报（通过 requirements_brief 上下文链注入）
- [x] 编写/更新 vitest 测试（31 个测试全部通过）
- [x] 保存 checkpoint

## Phase 10 — 任务模板库 + 反馈机制 + 会议记录导出
- [x] 任务模板库：定义 SaaS MVP、API 设计、移动端 App 三个预设模板（含推荐 prompt 和会议问题）
- [x] 任务模板库：后端 task.templates 端点返回模板列表
- [x] 任务模板库：前端 Workspace 模板选择器 UI（卡片式选择）
- [x] 反馈机制：数据库 messageFeedback 表（messageId, userId, rating）
- [x] 反馈机制：后端 task.feedback mutation + task.feedbacks query
- [x] 反馈机制：前端每条会议消息增加满意/不满意按钮
- [x] 会议记录导出：后端 task.exportMeeting 端点生成 Markdown 内容
- [x] 会议记录导出：前端会议结束后显示“导出 Markdown”按钮
- [x] 编写/更新 vitest 测试（45 个测试全部通过）
- [x] 保存 checkpoint

## Bugfix — Data too long for content column
- [ ] 修复 agent_logs.content 列为 longtext（支持超长 LLM 输出）
- [ ] 重新运行任务验证 PM 输出完整写入

## Phase 11 — 需求确认关卡（Requirement Confirmation Checkpoint）
- [x] 数据库：tasks 表增加 'confirming' 状态
- [x] 后端：拆分 confirmMeeting 为 endMeeting（生成需求简报）+ approveBrief（确认后执行）
- [x] 后端：新增 task.updateBrief mutation 支持用户编辑需求简报
- [x] 后端：新增 task.returnToMeeting mutation 支持返回继续讨论
- [x] 前端：需求简报确认 UI（结构化卡片展示）
- [x] 前端：Approve & Execute / Edit Brief / Return to Meeting 三个操作按钮
- [x] 前端：需求简报编辑模式（可修改内容后确认）
- [x] 编写/更新 vitest 测试（62 个测试全部通过）
- [ ] 保存 checkpoint
