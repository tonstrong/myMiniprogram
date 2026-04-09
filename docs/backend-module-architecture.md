# 服务端模块拆分与目录结构设计

## 1. 目标

本文档定义当前小程序后端在 MVP 阶段的推荐模块拆分、职责边界、目录结构和演进路径。

设计目标：
- 支撑 LLM-first 架构
- 支撑 Provider 可切换
- 支撑异步任务驱动流程
- 在单仓后端中保持模块清晰，便于后续拆分服务

---

## 2. 分层建议

推荐采用单仓模块化分层：

1. **Interface / API 层**
   - Controller / Route
   - 请求鉴权
   - 参数校验
   - Response 包装

2. **Application 层**
   - UseCase / Service
   - 业务编排
   - 调用任务中心、LLM Gateway、存储服务

3. **Domain 层**
   - Entity
   - Value Object
   - Domain Rule
   - 状态流转规则

4. **Infrastructure 层**
   - Repository
   - ORM / SQL
   - MQ / Queue
   - LLM Provider Adapter
   - File Storage
   - Content Safety

---

## 3. 模块划分

### 3.1 auth
职责：
- 微信登录态换取业务 token
- token 校验
- 当前用户上下文注入

### 3.2 user-profile
职责：
- 用户资料维护
- 风格偏好、体感偏好管理

### 3.3 closet
职责：
- 单品上传
- 单品属性查看/修改
- 单品确认入衣橱
- 单品归档/删除

### 3.4 style-pack
职责：
- 文本/视频导入
- 规则查看与确认
- 风格包激活/停用

### 3.5 recommendation
职责：
- 候选集过滤
- 推荐上下文组装
- 调用 LLM 规划
- 调用 validator
- 保存推荐结果与反馈

### 3.6 task-center
职责：
- 异步任务创建、查询、更新
- 任务状态机统一管理
- 任务与业务对象关联

### 3.7 llm-gateway
职责：
- 统一模型能力接口
- 路由到不同 Provider Adapter
- fallback / retry / timeout
- 结构化输出解析
- 调用日志记录

### 3.8 content-safety
职责：
- 图片/视频/文本审核
- 风险内容拦截

### 3.9 file-storage
职责：
- 原始文件上传
- 文件地址签发
- 软删除与延迟清理

### 3.10 observability
职责：
- 日志
- metrics
- tracing
- requestId 贯穿

---

## 4. 模块依赖规则

### 4.1 允许依赖
- API 层 → Application 层
- Application 层 → Domain / Infrastructure
- Infrastructure 层实现 Domain/Application 需要的能力

### 4.2 禁止依赖
- API 层直接调用 ORM
- 业务模块直接调用具体 Provider SDK
- recommendation 模块直接依赖某个厂商模型客户端

### 4.3 关键原则
- 所有模型调用都必须经过 `llm-gateway`
- 所有异步状态更新都必须经过 `task-center`

---

## 5. 异步 Worker 拆分建议

### 5.1 clothing-worker
- 处理衣物识别任务
- 调用 `extract_clothing_attributes`
- 更新 `clothing_items` 和 `async_tasks`

### 5.2 style-pack-worker
- 处理视频转写/文本抽取
- 调用 `extract_style_pack`
- 生成风格包规则和 prompt_profile

### 5.3 recommendation-worker
- 处理推荐生成任务
- 候选过滤
- 调用 `generate_outfit_recommendations`
- 执行校验器并落库

### 5.4 cleanup-worker
- 清理过期文件
- 清理老旧模型日志

---

## 6. 推荐目录结构示意

```text
backend/
  src/
    app/
      bootstrap/
      config/
      common/
        errors/
        middleware/
        response/
        logger/
        utils/
      modules/
        auth/
          api/
          application/
          domain/
          infrastructure/
        user-profile/
          api/
          application/
          domain/
          infrastructure/
        closet/
          api/
          application/
          domain/
          infrastructure/
        style-pack/
          api/
          application/
          domain/
          infrastructure/
        recommendation/
          api/
          application/
          domain/
          infrastructure/
        task-center/
          api/
          application/
          domain/
          infrastructure/
        llm-gateway/
          application/
          domain/
          infrastructure/
            adapters/
            router/
            parser/
            retry/
        content-safety/
          application/
          infrastructure/
        file-storage/
          application/
          infrastructure/
      workers/
        clothing-worker/
        style-pack-worker/
        recommendation-worker/
        cleanup-worker/
  scripts/
  tests/
```

---

## 7. 横切设计

### 7.1 日志
- 每个请求必须带 `requestId`
- 每次模型调用必须记录 `provider/modelName/modelTier/retryCount`

### 7.2 错误处理
- 统一错误码
- Provider 失败不直接暴露底层细节给小程序端

### 7.3 幂等性
- 上传任务创建接口支持幂等 key
- 推荐生成接口可按上下文做短时间去重

### 7.4 配置管理
- Provider 优先级、fallback、超时、重试次数走配置

---

## 8. MVP 推荐实现顺序

1. auth
2. user-profile
3. file-storage
4. task-center
5. llm-gateway
6. closet
7. style-pack
8. recommendation
9. content-safety
10. observability 和 cleanup-worker

---

## 9. 与 LLM Gateway 的关系

### 9.1 调用边界
- closet 只关心“识别衣物属性”
- style-pack 只关心“提取风格包规则”
- recommendation 只关心“生成穿搭建议”
- 三者都不直接关心具体 Provider 差异

### 9.2 收益
- 切换模型厂商时不影响业务模块
- 可对不同任务配置不同主/备 Provider
- 方便统计不同任务的模型效果和成本
