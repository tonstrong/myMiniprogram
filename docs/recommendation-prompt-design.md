# 推荐模块 Prompt 详细设计

## 1. 目标

本文档定义穿搭推荐模块的 Prompt 结构、输入输出 Schema、约束策略和多轮生成建议。

适用范围：
- `generate_outfit_recommendations`
- 推荐理由生成
- 替换建议生成

---

## 2. 设计原则

1. 模型只能使用候选集中的真实 `item_id`
2. Prompt 不绑定单一 Provider，只绑定统一任务契约
3. 输出必须是结构化 JSON
4. 推荐结果必须经过服务端校验器
5. 风格包作为“风格上下文”，不是绝对指令

---

## 3. Prompt 组成

### 3.1 System Prompt
职责：
- 定义角色
- 定义硬约束
- 定义输出格式

示例：
```text
你是衣橱穿搭推荐助手。
你只能使用输入中提供的 wardrobe_candidates 里的 item_id。
你不能编造不存在的衣物。
你必须输出合法 JSON。
你需要兼顾场景、天气、风格包规则和用户偏好。
```

### 3.2 Developer Prompt
职责：
- 细化业务规则
- 强调必要品类
- 说明失败时的行为

示例：
```text
至少生成 2 套、最多生成 4 套搭配。
每套必须尽量覆盖：上衣、下装、鞋；如场景需要可增加外套或配饰。
如果候选集不足，请返回 insufficient_items，而不是虚构单品。
```

### 3.3 User Payload
使用结构化 JSON 输入：

```json
{
  "scene": "通勤",
  "weather": {
    "temperature": 18,
    "condition": "cloudy"
  },
  "user_profile": {
    "style_preferences": ["极简", "通勤"],
    "body_preferences": ["显高"]
  },
  "style_pack": {
    "summary": "低饱和、中性色、利落",
    "rules": {
      "preferred_colors": ["黑", "白", "灰"],
      "avoid": ["高饱和撞色"]
    },
    "prompt_profile": {
      "tone": "克制、简洁",
      "bias": ["通勤优先", "显高"]
    }
  },
  "wardrobe_candidates": [
    {
      "item_id": "item_1",
      "category": "上衣",
      "sub_category": "白衬衫",
      "colors": ["白"],
      "tags": ["通勤", "极简"]
    }
  ]
}
```

---

## 4. 输出 Schema

```json
{
  "status": "success",
  "outfits": [
    {
      "outfit_no": 1,
      "items": [
        {"item_id": "item_1", "role": "top"},
        {"item_id": "item_2", "role": "bottom"},
        {"item_id": "item_3", "role": "shoes"}
      ],
      "reason": "整体符合通勤极简风格，颜色克制且比例利落。",
      "alternatives": [
        {
          "replace_item_id": "item_2",
          "with_item_id": "item_8",
          "reason": "温度偏低时可替换为更厚的直筒裤。"
        }
      ]
    }
  ],
  "meta": {
    "scene_fit": "high",
    "style_fit": "high"
  }
}
```

### 失败返回
```json
{
  "status": "insufficient_items",
  "reason": "缺少可用于通勤场景的下装或鞋类候选单品"
}
```

---

## 5. 推荐生成链路

### 5.1 单轮方案
1. 候选集过滤
2. 组装 Prompt
3. 模型生成 outfits
4. 校验器检查 item_id / 类别 / 约束
5. 保存结果

### 5.2 双阶段方案（推荐）
1. **Planner Prompt**：生成 outfit 方案
2. **Explainer Prompt**：基于已通过校验的 outfit 生成更自然的理由

优点：
- 更稳定
- 更容易定位失败阶段
- 更适合 Provider 切换

---

## 6. Prompt 模板建议

### 6.1 Planner 模板
```text
任务：根据用户场景、天气、风格包和候选衣橱单品，生成搭配方案。
限制：
1. 只能使用 wardrobe_candidates 中的 item_id。
2. 不允许编造新衣物。
3. 输出必须符合指定 JSON Schema。
4. 如候选不足，返回 insufficient_items。
```

### 6.2 Explainer 模板
```text
任务：基于已经确认合法的 outfit 结果，为每套搭配生成简洁、可执行的推荐理由与替换建议说明。
限制：
1. 不修改 item_id 组合。
2. 不新增不存在的单品。
3. 解释必须围绕场景、天气、风格包、颜色、版型展开。
```

---

## 7. 服务端校验规则

### 7.1 必校验项
- 所有 `item_id` 必须存在于候选集中
- 不允许空 outfit
- 必要品类必须齐全
- 替换建议中的 `with_item_id` 也必须在候选集内

### 7.2 可选校验项
- 场景冲突
- 季节冲突
- 温度冲突
- 风格包强规则冲突

---

## 8. Provider 可切换约束

1. 不在 Prompt 中写死厂商特性
2. Prompt 使用统一 schema
3. 通过配置决定哪个 Provider 执行 planner / explainer
4. 不同 Provider 切换时，输出字段必须保持兼容

---

## 9. 失败与降级策略

### 9.1 模型失败
- 超时 → fallback 到备用 Provider
- 输出解析失败 → 同 Provider 重试 1 次，再切换

### 9.2 业务失败
- 候选集不足 → 直接返回 `insufficient_items`
- 校验不通过 → 可重新发起一次 planner 调用

### 9.3 展示降级
- 无法生成自然语言解释时，先展示结构化推荐结果

---

## 10. Prompt 版本管理建议

建议为推荐模块维护：
- `planner_prompt_version`
- `explainer_prompt_version`
- `validator_rule_version`

便于后续 A/B Test、效果回溯和问题定位。
