# 工作任务记录

## 2026-04-09 任务进展

### 已完成
- [x] 创建首版《衣橱穿搭助手小程序 PRD（MVP）》
- [x] 补充正式化 PRD 内容：页面清单、页面说明、任务状态流转、API 草案、埋点方案
- [x] 将产品方案重构为“大模型优先”方向：
  - [x] 衣物特征识别改为多模态大模型 API
  - [x] 去除传统 OCR、抠图、卡片图作为主路径
  - [x] 保留用户确认/修改后入库机制
  - [x] 推荐逻辑改为候选集硬过滤 + LLM 搭配规划 + 结果校验 + 理由生成
- [x] 在 PRD 中加入“可切换大模型 Provider”架构：
  - [x] 增加 LLM Gateway / Provider Adapter 抽象层
  - [x] 增加自动路由、fallback、重试、配置驱动选择方案
  - [x] 增加 provider/model/tier/retryCount 等元数据要求

### 已完成（续）
- [x] 输出接口详细设计文档：`docs/api-detailed-design.md`
- [x] 输出数据库表设计文档：`docs/database-schema-design.md`
- [x] 输出服务端模块拆分与目录结构设计：`docs/backend-module-architecture.md`
- [x] 输出 DTO / VO / Entity 设计：`docs/dto-vo-entity-design.md`
- [x] 输出建表 SQL 初稿：`sql/001_init_schema.sql`
- [x] 输出推荐模块 Prompt 详细设计：`docs/recommendation-prompt-design.md`

### 下一步
1. 基于模块拆分开始初始化后端项目目录
2. 基于 DTO / Entity 文档实现接口层与应用层骨架
3. 基于 SQL 初稿生成建表迁移脚本与 ORM 模型
4. 基于 Prompt 文档实现 recommendation planner / explainer 调用链

## 2026-04-10 任务进展

### 已完成
- [x] 初始化后端项目骨架目录（TypeScript、模块与 Worker 结构、配置占位）
- [x] 基于 DTO / Entity 文档补齐接口层与应用层契约骨架（核心模块 DTO 与用例合同）
- [x] 基于 SQL 初稿补齐持久化/ORM 骨架与迁移目录（保持框架无关）
- [x] 基于 Prompt 文档补齐 recommendation planner / validator / explainer 调用链骨架（含 LLM gateway 任务类型扩展）
- [x] 补齐核心模块 API 控制器骨架与路由描述（保持框架无关）
- [x] 补齐 API 参数校验骨架（通用校验结果 + 模块级校验器 + 控制器校验挂钩）
- [x] 补齐基础仓储适配层（模块级仓储接口 + in-memory/no-op 适配器 + mapper 边界）
- [x] DB+迁移可执行
- [x] 实现 Node HTTP 服务器骨架并挂载 API 路由定义

### 下一步
1. 接入实际 ORM / DB Driver 与迁移执行流程
2. 为 recommendation 校验器与候选过滤器补齐具体规则与数据源

### 已完成（续）
- [x] 打通 TaskCenter 最小可运行链路（内存版 service + HTTP 路由）
- [x] 打通 Closet 最小可运行链路：上传 -> 属性修改 -> 确认入库（内存版）
- [x] 打通 StylePack 文本导入链路（内存版）
- [x] 打通 Recommendation 最小可运行链路：候选衣物 -> mock planner / validator / explainer -> 推荐详情查询
- [x] 打通 Auth / UserProfile 最小可运行链路（内存版登录、用户资料查询/更新）
- [x] 修复 LLM Provider 环境变量兼容问题：同时兼容 `LLM_PROVIDER_PROVIDER_A_*` 与 `LLM_PROVIDER_A_*`
- [x] 多次通过 `backend/` 下 `npm run typecheck` 与 `npm run build`
- [x] 完成当前可运行 API happy path 手工验证：Auth、UserProfile、Closet、StylePack、Recommendation
- [x] 将后端 DB driver 从 Postgres/`pg` 切换为 MySQL/`mysql2`
- [x] 将 `backend` 迁移脚本与迁移表切换为 MySQL 语法
- [x] 在本机 MySQL 上创建独立数据库 `test_closet_backend`，避免污染原有 `test` 库内已有业务表
- [x] 已在本机 MySQL 上跑通 `db:migrate` / `db:migrate:status`，并确认核心业务表已创建
- [x] 完成第一条 MySQL 持久化垂直切片：TaskCenter 改为 MySQL-backed repository
- [x] 已验证 TaskCenter `POST /api/tasks` / `GET /api/tasks/:taskId` 可真实写入并读回 MySQL `async_tasks`
- [x] 已验证 TaskCenter service 的 `updateTask()` 可在 MySQL 中完成状态更新并正确读回
- [x] 完成第二条 MySQL 持久化垂直切片：Closet 改为 MySQL-backed repository
- [x] 已验证 Closet `upload / update / confirm / list` 可真实写入并读回 MySQL `clothing_items`
- [x] 已验证 Recommendation 可直接消费 MySQL Closet 数据作为候选集生成推荐
- [x] 完成第三条 MySQL 持久化垂直切片：StylePack 改为 MySQL-backed repository
- [x] 已验证 StylePack `import / update / activate / get / list` 可真实写入并读回 MySQL `style_packs`
- [x] 已验证 Recommendation 可读取 MySQL 中已激活 StylePack 的 summary/rules 作为推荐上下文
- [x] 完成第四条 MySQL 持久化垂直切片：Recommendation 结果存储改为 MySQL-backed repository
- [x] 已新增并跑通 Recommendation 相关迁移：允许 `recommendations.style_pack_id` 为空、为 `recommendation_items` 增加 `reason_text`
- [x] 已验证 Recommendation `generate / detail / save / feedback` 可真实写入并读回 MySQL `recommendations` / `recommendation_items` / `recommendation_feedback`
- [x] 已修复 Recommendation 明细读回时 outfit item 顺序不稳定问题，保证与 generate 返回顺序一致
- [x] 完成第五条 MySQL 持久化垂直切片：UserProfile 改为 MySQL-backed repository
- [x] 已验证 UserProfile `get / update / get` 可真实写入并读回 MySQL `users` / `user_preferences`
- [x] 已保持现有 API 行为：用户首次 `GET /api/users/profile` 时会自动生成最小用户记录
- [x] 新增 `004_add_clothing_item_images.sql`，在 MySQL 中为衣橱图片二进制存储增加 `clothing_item_images` 表与 `image_access_key`
- [x] 将衣橱上传链路改为支持 base64 图片内容入参，并把图片 bytes 真实写入 MySQL
- [x] 新增 `GET /api/closet/items/:itemId/image?userId=...&key=...` 图片读取接口，返回真实二进制图片内容
- [x] 已验证衣橱上传后可返回可访问图片 URL，图片接口返回 `image/png` 且状态码 200
- [x] 已修复衣橱错误图片地址问题：不再把 `file://` / `wxfile://` / `http://tmp/...` 当作正式图片地址存储
- [x] 已加强 TaskCenter 用户隔离：`GET /api/tasks/:taskId` 改为按当前登录用户维度校验
- [x] 已验证跨用户访问他人单品详情与任务状态均返回 404
- [x] 已将前端衣橱图片上传切换为腾讯小程序云开发存储：`wx.cloud.init` + `wx.cloud.uploadFile`
- [x] 已将后端衣橱图片保存链路切换为优先持久化 `cloud://fileID`，不再强依赖 MySQL BLOB
- [x] 已接通真实 LLM Gateway：上传单品时可同步提取服装属性，导入文本风格包时可同步提炼 summary/rules/promptProfile（已配置 provider 时）
- [x] 已修复衣橱详情页底部操作按钮移动端布局问题

### 当前阻塞 / 注意事项
- [x] 已完成 DB driver 与 migration runner 从 Postgres/`pg` 到 MySQL/`mysql2` 的切换
- [x] 已在真实本机 MySQL 上跑通 migration/status 验证
- [x] 已获取本机 MySQL 连接信息并完成安全落库方案选择
- [x] 已确认本机 MySQL 可连通：`root@localhost`，版本 `8.0.44`
- [x] 已发现本机现有数据库：`information_schema`、`myquant`、`mysql`、`performance_schema`、`sys`、`test`
- [x] 已识别到用户选择的 `test` 库内存在现有表（`users`/`posts`/`comments`），因此改为使用独立库 `test_closet_backend` 进行安全验证

### 下一步（更新）
1. 将当前 repository 从内存版逐步替换为 MySQL 持久化实现
2. 让应用运行时默认读取 MySQL `DATABASE_URL` 并验证真实读写链路
3. 评估是否保留 `test_closet_backend` 作为开发库，或切换到用户指定的新专用库名
4. 下一条垂直切片优先补充腾讯云文件读取/权限策略说明，并决定是否完全移除遗留 MySQL BLOB 兼容链路
