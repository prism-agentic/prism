# PRISM Landing Page Tasks

- [x] 1. 添加 /docs 路由，创建基础文档页面框架
- [x] 2. 添加 meta 描述和 Open Graph 图片，优化社交媒体分享
- [x] 3. 在架构部分增加交互式动画，展示多智能体协作过程
- [x] 4. 用代码绘制精确对应 4 层架构的 SVG 图，替换 AI 生成图片
- [x] 5. 支持中英文版本，随语言切换自动更新标注
- [x] 6. 集成到 ArchitectureSection 组件中

## 性能优化

### 代码分割与懒加载
- [ ] React.lazy + Suspense 懒加载 Docs 页面
- [ ] 懒加载重型可视化组件（ArchitectureDiagram, PipelineDiagram, EvolutionDiagram, AgentNetwork）

### 移除未使用依赖
- [ ] 移除 recharts (~200KB)
- [ ] 移除 embla-carousel-react, react-day-picker, react-resizable-panels
- [ ] 移除 react-hook-form, @hookform/resolvers, input-otp, cmdk
- [ ] 移除 axios, streamdown, nanoid

### 移除未使用 UI 组件
- [ ] 移除 calendar, carousel, chart, command, context-menu, drawer, menubar, navigation-menu, sidebar 等

### 动画性能
- [ ] Canvas 动画添加 IntersectionObserver，不可见时暂停 requestAnimationFrame
- [ ] framer-motion 按需导入

### 资源加载
- [ ] Hero 背景图添加 preload
- [ ] Vite manualChunks 配置优化 bundle 分割
