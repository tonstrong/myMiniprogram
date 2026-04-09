# 数据库表设计

## 1. 文档目标

本文档定义衣橱穿搭助手小程序在 MVP 阶段的核心数据库表结构、字段建议、索引建议、状态定义与关联关系。

数据库类型建议：
- 主业务库：MySQL / PostgreSQL
- 对象文件：对象存储
- 缓存：Redis

---

## 2. 设计原则

1. 业务主数据与模型调用日志分离
2. 用户确认后的结果与模型原始输出分离
3. 任务驱动的数据状态流转必须可追踪
4. Provider 可切换，因此模型调用元数据必须持久化
5. 优先保证审计、追溯和可回滚能力

---

## 3. 核心表总览

| 表名 | 用途 |
|---|---|
| `users` | 用户主表 |
| `user_preferences` | 用户偏好设置 |
| `clothing_items` | 单品主表 |
| `clothing_item_attribute_history` | 单品属性历史记录 |
| `style_packs` | 风格包主表 |
| `style_pack_rule_versions` | 风格包规则版本 |
| `recommendations` | 推荐主表 |
| `recommendation_items` | 推荐与单品关联表 |
| `recommendation_feedback` | 推荐反馈表 |
| `async_tasks` | 异步任务表 |
| `model_invocation_logs` | 模型调用日志表 |
| `provider_configs` | Provider 配置快照表 |

---

## 4. 表结构设计

### 4.1 users

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | varchar(64) | PK | 用户ID |
| wechat_open_id | varchar(128) | UNIQUE | 微信 openId |
| union_id | varchar(128) | NULL | 微信 unionId |
| nickname | varchar(64) | NOT NULL | 用户昵称 |
| avatar_url | varchar(512) | NULL | 头像 |
| status | varchar(32) | NOT NULL | active/inactive |
| created_at | datetime | NOT NULL | 创建时间 |
| updated_at | datetime | NOT NULL | 更新时间 |

索引建议：
- `uk_wechat_open_id`
- `idx_status`

### 4.2 user_preferences

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | varchar(64) | PK | 主键 |
| user_id | varchar(64) | FK | 用户ID |
| style_preferences | json | NULL | 风格偏好 |
| body_preferences | json | NULL | 身形偏好 |
| city | varchar(64) | NULL | 城市 |
| temperature_sensitivity | varchar(32) | NULL | 体感偏好 |
| created_at | datetime | NOT NULL | 创建时间 |
| updated_at | datetime | NOT NULL | 更新时间 |

### 4.3 clothing_items

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | varchar(64) | PK | 单品ID |
| user_id | varchar(64) | FK | 用户ID |
| image_original_url | varchar(512) | NOT NULL | 原图地址 |
| category | varchar(32) | NULL | 一级类别 |
| sub_category | varchar(64) | NULL | 二级类别 |
| colors | json | NULL | 颜色数组 |
| pattern | varchar(64) | NULL | 图案 |
| material | varchar(64) | NULL | 材质 |
| fit | json | NULL | 版型 |
| length | varchar(32) | NULL | 长度 |
| seasons | json | NULL | 季节 |
| tags | json | NULL | 风格标签 |
| occasion_tags | json | NULL | 场景标签 |
| llm_confidence | json | NULL | 字段级置信度 |
| provider | varchar(64) | NULL | 识别使用的 Provider |
| model_name | varchar(128) | NULL | 模型名 |
| model_tier | varchar(32) | NULL | 档位 |
| retry_count | int | NOT NULL DEFAULT 0 | 重试次数 |
| status | varchar(32) | NOT NULL | pending_review/active/archived/deleted |
| source_type | varchar(32) | NULL | camera/album/import |
| created_at | datetime | NOT NULL | 创建时间 |
| updated_at | datetime | NOT NULL | 更新时间 |
| confirmed_at | datetime | NULL | 确认时间 |

索引建议：
- `idx_user_status`
- `idx_user_category`
- `idx_user_updated_at`

### 4.4 clothing_item_attribute_history

用于记录模型识别结果与用户编辑历史。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | varchar(64) | PK | 主键 |
| item_id | varchar(64) | FK | 单品ID |
| version_no | int | NOT NULL | 版本号 |
| source | varchar(32) | NOT NULL | llm/user/system |
| attributes_snapshot | json | NOT NULL | 属性快照 |
| changed_fields | json | NULL | 变更字段 |
| operator_id | varchar(64) | NULL | 操作者 |
| created_at | datetime | NOT NULL | 创建时间 |

### 4.5 style_packs

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | varchar(64) | PK | 风格包ID |
| user_id | varchar(64) | FK | 用户ID |
| name | varchar(128) | NOT NULL | 名称 |
| source_type | varchar(32) | NOT NULL | text/video |
| source_file_url | varchar(512) | NULL | 原始文件 |
| transcript_text | longtext | NULL | 转写文本 |
| summary_text | text | NULL | 风格摘要 |
| rules_json | json | NULL | 当前规则 |
| prompt_profile | json | NULL | 提示词上下文 |
| provider | varchar(64) | NULL | 抽取使用的 Provider |
| model_name | varchar(128) | NULL | 模型名 |
| model_tier | varchar(32) | NULL | 档位 |
| version | int | NOT NULL DEFAULT 1 | 当前版本 |
| status | varchar(32) | NOT NULL | draft/needs_confirm/active/inactive/failed |
| created_at | datetime | NOT NULL | 创建时间 |
| updated_at | datetime | NOT NULL | 更新时间 |
| activated_at | datetime | NULL | 生效时间 |

索引建议：
- `idx_user_status`
- `idx_user_updated_at`

### 4.6 style_pack_rule_versions

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | varchar(64) | PK | 主键 |
| style_pack_id | varchar(64) | FK | 风格包ID |
| version_no | int | NOT NULL | 版本号 |
| summary_text | text | NULL | 摘要 |
| rules_json | json | NOT NULL | 规则快照 |
| prompt_profile | json | NULL | Prompt 快照 |
| source | varchar(32) | NOT NULL | llm/user/system |
| created_at | datetime | NOT NULL | 创建时间 |

### 4.7 recommendations

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | varchar(64) | PK | 推荐ID |
| user_id | varchar(64) | FK | 用户ID |
| style_pack_id | varchar(64) | FK | 风格包ID |
| scene | varchar(64) | NOT NULL | 场景 |
| weather_json | json | NULL | 天气上下文 |
| provider | varchar(64) | NULL | 推荐使用的 Provider |
| model_name | varchar(128) | NULL | 模型名 |
| model_tier | varchar(32) | NULL | 档位 |
| retry_count | int | NOT NULL DEFAULT 0 | 重试次数 |
| validator_result | json | NULL | 校验结果 |
| reason_text | text | NULL | 总体推荐理由 |
| status | varchar(32) | NOT NULL | generated/validated/failed/saved |
| created_at | datetime | NOT NULL | 创建时间 |
| updated_at | datetime | NOT NULL | 更新时间 |

索引建议：
- `idx_user_created_at`
- `idx_user_style_pack`
- `idx_status`

### 4.8 recommendation_items

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | varchar(64) | PK | 主键 |
| recommendation_id | varchar(64) | FK | 推荐ID |
| outfit_no | int | NOT NULL | 第几套搭配 |
| item_id | varchar(64) | FK | 单品ID |
| role | varchar(32) | NOT NULL | top/bottom/shoes/outer/accessory |
| alternative_json | json | NULL | 替换建议 |
| created_at | datetime | NOT NULL | 创建时间 |

### 4.9 recommendation_feedback

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | varchar(64) | PK | 主键 |
| recommendation_id | varchar(64) | FK | 推荐ID |
| user_id | varchar(64) | FK | 用户ID |
| action | varchar(32) | NOT NULL | like/dislike/save |
| reason_tags | json | NULL | 原因标签 |
| comment | varchar(512) | NULL | 文本反馈 |
| created_at | datetime | NOT NULL | 创建时间 |

### 4.10 async_tasks

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | varchar(64) | PK | 任务ID |
| user_id | varchar(64) | FK | 用户ID |
| task_type | varchar(64) | NOT NULL | extract_clothing_attributes / extract_style_pack / generate_outfit_recommendations |
| biz_type | varchar(64) | NOT NULL | clothing/style_pack/recommendation |
| biz_id | varchar(64) | NULL | 对应业务ID |
| status | varchar(32) | NOT NULL | uploaded/processing/needs_review/completed/failed/transcribing/extracting/needs_confirm/active |
| progress | int | NOT NULL DEFAULT 0 | 进度 |
| result_summary | varchar(512) | NULL | 结果摘要 |
| provider_meta | json | NULL | Provider 元数据 |
| error_code | varchar(32) | NULL | 错误码 |
| error_message | varchar(512) | NULL | 错误信息 |
| created_at | datetime | NOT NULL | 创建时间 |
| updated_at | datetime | NOT NULL | 更新时间 |
| finished_at | datetime | NULL | 完成时间 |

索引建议：
- `idx_user_task_type`
- `idx_biz_type_biz_id`
- `idx_status_updated_at`

### 4.11 model_invocation_logs

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | varchar(64) | PK | 主键 |
| task_id | varchar(64) | FK | 关联任务 |
| provider | varchar(64) | NOT NULL | Provider |
| model_name | varchar(128) | NOT NULL | 模型名 |
| model_tier | varchar(32) | NOT NULL | 档位 |
| request_schema | json | NULL | 请求快照 |
| response_schema | json | NULL | 响应快照 |
| parse_status | varchar(32) | NOT NULL | success/failed |
| latency_ms | int | NULL | 延迟 |
| token_usage | json | NULL | token 统计 |
| fallback_used | tinyint | NOT NULL DEFAULT 0 | 是否降级 |
| created_at | datetime | NOT NULL | 创建时间 |

### 4.12 provider_configs

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | varchar(64) | PK | 主键 |
| task_type | varchar(64) | NOT NULL | 任务类型 |
| primary_provider | varchar(64) | NOT NULL | 主 Provider |
| fallback_providers | json | NULL | 备用 Provider 列表 |
| tier | varchar(32) | NOT NULL | 默认档位 |
| timeout_ms | int | NOT NULL | 超时时间 |
| retry_policy | json | NULL | 重试策略 |
| status | varchar(32) | NOT NULL | active/inactive |
| created_at | datetime | NOT NULL | 创建时间 |
| updated_at | datetime | NOT NULL | 更新时间 |

---

## 5. 关系说明

### 5.1 主要关系
- `users` 1:N `clothing_items`
- `users` 1:N `style_packs`
- `users` 1:N `recommendations`
- `clothing_items` 1:N `clothing_item_attribute_history`
- `style_packs` 1:N `style_pack_rule_versions`
- `recommendations` 1:N `recommendation_items`
- `recommendations` 1:N `recommendation_feedback`
- `async_tasks` 可关联到 `clothing_items` / `style_packs` / `recommendations`
- `async_tasks` 1:N `model_invocation_logs`

---

## 6. 状态枚举建议

### 6.1 clothing_items.status
- `pending_review`
- `active`
- `archived`
- `deleted`

### 6.2 style_packs.status
- `draft`
- `needs_confirm`
- `active`
- `inactive`
- `failed`

### 6.3 recommendations.status
- `generated`
- `validated`
- `failed`
- `saved`

### 6.4 async_tasks.status
- `uploaded`
- `processing`
- `needs_review`
- `completed`
- `failed`
- `transcribing`
- `extracting`
- `needs_confirm`
- `active`

---

## 7. 索引与性能建议

1. 用户维度查询较多的表统一加 `(user_id, updated_at)` 索引
2. 推荐结果列表加 `(user_id, created_at desc)` 索引
3. 任务表加 `(status, updated_at)` 便于轮询任务中心
4. 日志表按时间分区或冷热分层，避免长期膨胀
5. JSON 字段中频繁筛选的字段，应在业务演进后拆为显式列

---

## 8. 审计与保留策略

### 8.1 审计建议
- 所有主表保留 `created_at`、`updated_at`
- 关键操作保留 `operator_id` 或链路 requestId
- 模型输出原始结果不建议长期保留完整明文，可做摘要存档

### 8.2 删除策略
- 用户主动删除时，业务表先软删除
- 对象存储文件建议延迟物理清理
- `model_invocation_logs` 可设置 30~90 天保留期

### 8.3 版本策略
- 单品属性与风格包规则建议保留历史版本
- 用户最终确认结果应视为主版本，模型输出为参考版本
