# DTO / VO / Entity 设计

## 1. 目标

本文档定义服务端核心 DTO、VO、Entity 的职责边界与推荐结构，便于后续 DTO、ORM、接口层实现。

---

## 2. 设计原则

1. DTO 负责接口输入输出，不承载业务规则
2. VO 用于表达不可变值对象和结构化业务值
3. Entity 用于表达有身份、有生命周期的核心业务对象
4. Provider 元数据优先设计为独立 VO，避免在每个对象中散落字段

---

## 3. DTO 设计

### 3.1 Auth DTO
- `WechatLoginRequestDTO`
- `LoginResponseDTO`

### 3.2 User DTO
- `UpdateUserProfileRequestDTO`
- `UserProfileResponseDTO`

### 3.3 Closet DTO
- `UploadClothingItemRequestDTO`
- `ClothingItemDetailResponseDTO`
- `UpdateClothingItemRequestDTO`
- `ConfirmClothingItemRequestDTO`
- `ClothingItemListQueryDTO`

### 3.4 StylePack DTO
- `ImportStylePackTextRequestDTO`
- `ImportStylePackVideoRequestDTO`
- `UpdateStylePackRequestDTO`
- `StylePackDetailResponseDTO`

### 3.5 Recommendation DTO
- `GenerateRecommendationRequestDTO`
- `RecommendationDetailResponseDTO`
- `RecommendationFeedbackRequestDTO`

### 3.6 Task DTO
- `TaskStatusResponseDTO`

---

## 4. VO 设计

### 4.1 ProviderMetaVO
字段：
- `provider`
- `modelName`
- `modelTier`
- `retryCount`
- `fallbackUsed`

### 4.2 ClothingAttributesVO
字段：
- `category`
- `subCategory`
- `colors`
- `pattern`
- `material`
- `fit`
- `length`
- `seasons`
- `tags`
- `occasionTags`
- `confidence`

### 4.3 StylePackRulesVO
字段：
- `summaryText`
- `rulesJson`
- `promptProfile`

### 4.4 RecommendationContextVO
字段：
- `scene`
- `weather`
- `stylePackSummary`
- `preferenceTags`
- `candidateItemIds`

### 4.5 RecommendationResultVO
字段：
- `outfitNo`
- `itemIds`
- `reason`
- `alternatives`
- `validatorResult`

### 4.6 TaskStatusVO
字段：
- `taskType`
- `status`
- `progress`
- `resultSummary`
- `providerMeta`

---

## 5. Entity 设计

### 5.1 UserEntity
职责：
- 用户身份
- 账户状态

核心字段：
- `id`
- `wechatOpenId`
- `nickname`
- `status`

### 5.2 UserPreferenceEntity
职责：
- 用户穿搭偏好与体感偏好

### 5.3 ClothingItemEntity
职责：
- 表示用户衣橱中的单品
- 管理待确认/激活/归档状态

核心字段：
- `id`
- `userId`
- `imageOriginalUrl`
- `attributes: ClothingAttributesVO`
- `providerMeta: ProviderMetaVO`
- `status`

关键行为：
- `applyLlmExtractionResult()`
- `confirm()`
- `archive()`

### 5.4 ClothingItemAttributeHistoryEntity
职责：
- 保存模型识别与用户修改历史

### 5.5 StylePackEntity
职责：
- 表示风格包聚合根
- 管理 draft / needs_confirm / active 生命周期

核心字段：
- `id`
- `userId`
- `sourceType`
- `summaryText`
- `rules: StylePackRulesVO`
- `providerMeta: ProviderMetaVO`
- `status`

关键行为：
- `applyExtractionResult()`
- `confirm()`
- `activate()`
- `deactivate()`

### 5.6 RecommendationEntity
职责：
- 表示一次推荐结果聚合根

核心字段：
- `id`
- `userId`
- `stylePackId`
- `context: RecommendationContextVO`
- `providerMeta: ProviderMetaVO`
- `results: RecommendationResultVO[]`
- `status`

关键行为：
- `applyPlannerResult()`
- `markValidated()`
- `markFailed()`

### 5.7 AsyncTaskEntity
职责：
- 跟踪异步任务状态流转

### 5.8 ModelInvocationLogEntity
职责：
- 跟踪模型调用日志、结果解析情况、延迟、fallback

---

## 6. DTO / VO / Entity 边界示例

### 6.1 单品详情查询
- Controller 返回：`ClothingItemDetailResponseDTO`
- DTO 内部包含：`ClothingAttributesVO` 和 `ProviderMetaVO`
- 底层聚合：`ClothingItemEntity`

### 6.2 推荐生成
- 入参：`GenerateRecommendationRequestDTO`
- 应用层组装：`RecommendationContextVO`
- 领域层持有：`RecommendationEntity`

---

## 7. 命名建议

### DTO
- 请求：`xxxRequestDTO`
- 响应：`xxxResponseDTO`
- 查询：`xxxQueryDTO`

### VO
- 不可变值优先使用 `VO` 后缀

### Entity
- 聚合根显式使用 `Entity` 后缀

---

## 8. MVP 优先落地顺序

1. ProviderMetaVO
2. ClothingAttributesVO
3. ClothingItemEntity
4. StylePackRulesVO
5. StylePackEntity
6. RecommendationContextVO
7. RecommendationEntity
8. AsyncTaskEntity
