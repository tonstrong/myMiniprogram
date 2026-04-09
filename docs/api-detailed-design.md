# 接口详细设计

## 1. 文档目标

本文档用于在现有 PRD 基础上，给后端、BFF、小程序端提供可直接进入开发的接口设计说明。

适用范围：
- 微信小程序业务接口
- 异步任务状态接口
- 与 LLM Gateway 协同的业务层接口约束

不包含：
- 第三方模型厂商 SDK 细节
- 具体云厂商网关配置
- OpenAPI 自动生成脚本

---

## 2. 设计原则

### 2.1 总体原则
- 小程序只访问业务 API，不直接访问任何大模型 Provider
- 所有长耗时操作统一走异步任务
- 所有返回体统一结构
- 所有模型相关调用通过服务端 LLM Gateway 编排
- Provider 可切换，但接口契约保持稳定

### 2.2 核心链路
1. 衣物图片上传 → 异步识别 → 用户确认
2. 风格包导入 → 文本/视频处理 → 规则抽取 → 用户确认
3. 穿搭推荐 → 候选集过滤 → LLM 规划 → 校验器 → 结果返回

### 2.3 鉴权假设
- 小程序通过微信登录换取业务 token
- 业务接口默认使用 `Authorization: Bearer <token>`
- 管理/内部接口不暴露给小程序

---

## 3. 统一返回体

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "requestId": "req_001"
}
```

字段说明：
- `code`：业务码，0 表示成功
- `message`：错误或成功描述
- `data`：业务数据
- `requestId`：链路追踪 ID

---

## 4. 通用错误码设计

| code | 含义 | 说明 |
|---|---|---|
| 0 | 成功 | 请求成功 |
| 40001 | 参数错误 | 请求参数缺失或格式不正确 |
| 40002 | 文件格式不支持 | 图片/视频格式非法 |
| 40003 | 文件超限 | 文件大小、时长或数量超限 |
| 40101 | 未登录或 token 失效 | 需要重新登录 |
| 40301 | 无访问权限 | 用户无权访问该资源 |
| 40401 | 资源不存在 | item/stylePack/recommendation/task 不存在 |
| 40901 | 状态冲突 | 当前状态不允许该操作 |
| 42201 | 识别结果不可确认 | 关键字段缺失或未通过前端校验 |
| 42901 | 请求过于频繁 | 用户或系统限流 |
| 50001 | 服务内部错误 | 通用服务异常 |
| 50011 | 模型调用失败 | LLM Gateway 调用异常 |
| 50012 | 模型输出解析失败 | 未按 Schema 返回 |
| 50013 | 推荐校验失败 | 生成的 outfit 未通过验证 |

---

## 5. 认证与用户接口

### 5.1 微信登录
**POST** `/api/auth/wechat-login`

#### 请求体
```json
{
  "code": "wx_login_code"
}
```

#### 响应体
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "token": "jwt_token",
    "userInfo": {
      "userId": "u_001",
      "nickname": "Atlas User",
      "isNewUser": true
    }
  },
  "requestId": "req_001"
}
```

### 5.2 获取个人资料
**GET** `/api/users/profile`

#### 响应字段
- `userId`
- `nickname`
- `avatarUrl`
- `stylePreferences`
- `bodyPreferences`
- `city`
- `defaultTemperatureSensitivity`

### 5.3 更新个人资料
**PUT** `/api/users/profile`

#### 请求体
```json
{
  "stylePreferences": ["极简", "通勤"],
  "bodyPreferences": ["显高"],
  "city": "北京",
  "defaultTemperatureSensitivity": "normal"
}
```

---

## 6. 衣橱接口设计

### 6.1 上传单品图片
**POST** `/api/closet/items/upload`

#### 用途
上传原始衣物图片，并创建识别任务。

#### 请求方式
- `multipart/form-data`

#### 表单字段
- `file`：图片文件
- `sourceType`：`camera` / `album`

#### 响应体
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "itemId": "item_001",
    "taskId": "task_001",
    "status": "uploaded"
  },
  "requestId": "req_002"
}
```

### 6.2 查询单品列表
**GET** `/api/closet/items`

#### 查询参数
- `category`
- `season`
- `tag`
- `status`
- `pageNo`
- `pageSize`

#### 返回字段
- `itemId`
- `category`
- `subCategory`
- `colors`
- `tags`
- `status`
- `imageOriginalUrl`
- `updatedAt`

### 6.3 查询单品详情
**GET** `/api/closet/items/{itemId}`

#### 返回字段
```json
{
  "itemId": "item_001",
  "status": "needs_review",
  "imageOriginalUrl": "https://...",
  "attributes": {
    "category": "上衣",
    "subCategory": "白衬衫",
    "colors": ["白"],
    "material": "棉",
    "fit": ["宽松"],
    "seasons": ["春", "秋"],
    "tags": ["通勤", "极简"]
  },
  "llmMeta": {
    "provider": "provider_a",
    "modelName": "vision-standard",
    "modelTier": "standard",
    "retryCount": 0,
    "confidence": {
      "category": 0.95,
      "material": 0.71
    }
  }
}
```

### 6.4 更新单品属性
**PUT** `/api/closet/items/{itemId}`

#### 请求体
```json
{
  "category": "上衣",
  "subCategory": "衬衫",
  "colors": ["白"],
  "material": "棉",
  "fit": ["宽松"],
  "length": "常规",
  "seasons": ["春", "秋"],
  "tags": ["通勤", "极简"],
  "occasionTags": ["通勤"]
}
```

### 6.5 确认识别结果
**POST** `/api/closet/items/{itemId}/confirm`

#### 用途
将 `needs_review` 状态的单品正式激活为可推荐单品。

#### 业务校验
- 关键字段不能为空：`category`、`colors`、`seasons`
- 当前状态必须为 `needs_review`

### 6.6 归档单品
**POST** `/api/closet/items/{itemId}/archive`

### 6.7 删除单品
**DELETE** `/api/closet/items/{itemId}`

---

## 7. 风格包接口设计

### 7.1 导入文本风格包
**POST** `/api/style-packs/import/text`

#### 请求体
```json
{
  "title": "通勤极简风",
  "text": "这里是用户粘贴的已授权文字内容",
  "authConfirmed": true
}
```

### 7.2 导入视频风格包
**POST** `/api/style-packs/import/video`

#### 请求方式
- `multipart/form-data`

#### 表单字段
- `file`
- `title`
- `authConfirmed`

### 7.3 查询风格包列表
**GET** `/api/style-packs`

#### 返回字段
- `stylePackId`
- `name`
- `sourceType`
- `status`
- `version`
- `updatedAt`

### 7.4 查询风格包详情
**GET** `/api/style-packs/{stylePackId}`

#### 返回字段
- `summaryText`
- `rulesJson`
- `promptProfile`
- `providerMeta`
- `transcriptText`
- `status`

### 7.5 更新风格包
**PUT** `/api/style-packs/{stylePackId}`

#### 请求体
```json
{
  "name": "通勤极简风",
  "summaryText": "低饱和、中性色、利落、显高",
  "rulesJson": {
    "preferred_colors": ["黑", "白", "灰"],
    "avoid": ["高饱和撞色"]
  },
  "promptProfile": {
    "tone": "克制、利落、极简",
    "bias": ["通勤优先", "显高"]
  }
}
```

### 7.6 激活 / 停用风格包
- **POST** `/api/style-packs/{stylePackId}/activate`
- **POST** `/api/style-packs/{stylePackId}/deactivate`

---

## 8. 推荐接口设计

### 8.1 生成穿搭推荐
**POST** `/api/recommendations/generate`

#### 请求体
```json
{
  "scene": "通勤",
  "weather": {
    "temperature": 18,
    "condition": "cloudy"
  },
  "stylePackId": "sp_001",
  "preferenceTags": ["极简", "显高"]
}
```

#### 处理逻辑
1. 后端过滤候选单品
2. 组装推荐上下文
3. 调用 LLM Gateway
4. 解析结构化结果
5. 执行校验器
6. 生成最终结果

#### 响应体
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "recommendationId": "rec_001",
    "outfits": [
      {
        "items": ["item_1", "item_2", "item_3"],
        "reason": "整体符合通勤极简风格",
        "alternatives": []
      }
    ],
    "providerMeta": {
      "provider": "provider_a",
      "modelName": "planner-premium",
      "modelTier": "premium",
      "retryCount": 1,
      "fallbackUsed": false
    }
  },
  "requestId": "req_009"
}
```

### 8.2 查询推荐详情
**GET** `/api/recommendations/{recommendationId}`

### 8.3 推荐反馈
**POST** `/api/recommendations/{recommendationId}/feedback`

#### 请求体
```json
{
  "action": "dislike",
  "reasonTags": ["too_formal", "not_for_body_shape"],
  "comment": "感觉太正式，不够松弛"
}
```

### 8.4 收藏推荐
**POST** `/api/recommendations/{recommendationId}/save`

---

## 9. 异步任务接口设计

### 9.1 查询任务状态
**GET** `/api/tasks/{taskId}`

#### 返回字段
```json
{
  "taskId": "task_001",
  "taskType": "extract_clothing_attributes",
  "status": "processing",
  "progress": 70,
  "resultSummary": "正在解析结构化字段",
  "providerMeta": {
    "provider": "provider_a",
    "modelName": "vision-standard",
    "modelTier": "standard",
    "retryCount": 0,
    "fallbackUsed": false
  }
}
```

### 9.2 状态枚举
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

## 10. LLM Gateway 内部约束

### 10.1 对业务层暴露的统一能力
- `extract_clothing_attributes`
- `extract_style_pack`
- `generate_outfit_recommendations`

### 10.2 内部统一参数
- `provider`
- `modelTier`
- `outputSchema`
- `timeoutMs`
- `retryPolicy`

### 10.3 业务层必须遵守
- 不直接传递用户敏感信息给模型
- 不允许小程序端指定真实 Provider 名称
- 推荐结果必须再次经过服务端校验器

---

## 11. 安全与审计要求

### 11.1 审计字段
所有写接口均建议记录：
- `operatorId`
- `requestId`
- `createdAt`
- `updatedAt`

### 11.2 内容安全
- 上传文本、图片、视频需走内容审核
- 识别失败或审核失败时返回可解释错误

### 11.3 数据删除
- 删除衣物、风格包、原始内容时应保留审计日志
- 原始文件与业务记录建议做软删除 + 延迟物理清理
