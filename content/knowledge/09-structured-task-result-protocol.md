# 09 - 结构化任务结果协议

## 先说结论

结构化任务结果协议解决的是：

```text
LLM 执行完任务后，程序如何可靠判断这项任务 completed、blocked 还是 failed？
```

当前做法是：

```text
优先要求模型输出 JSON
解析成功就按结构化字段判断
解析失败再用启发式兜底
执行异常则标记 failed / error
```

源码落点：

- `../../src/orchestration/task-execution-evaluator.ts`
- `../../src/runtime/runtime-bundle.ts`
- `../../src/task-state/task-snapshot.ts`

## 为什么自然语言不够

模型可能回答：

```text
我已经看过了，大概没问题。
```

这到底是完成了，还是只是分析了一半？

模型也可能回答：

```text
目前缺少上下文，建议下一步补充。
```

这应该算：

```text
blocked
```

如果只靠关键词判断，很容易误判。

所以需要结构化协议。

## 当前协议

Runtime 构造任务执行 prompt 时，会要求模型优先输出：

```json
{
  "status": "completed | blocked | failed",
  "summary": "一句话说明本轮任务结果",
  "reason": "更具体的原因或执行说明",
  "blockedReason": "仅 blocked 时需要",
  "artifacts": ["可选：本轮产物或文件路径"],
  "nextHint": "可选：给下一步的建议"
}
```

字段含义：

```text
status        任务判断结果
summary       给人看的短摘要
reason        更具体的解释
blockedReason blocked 时的阻塞原因
artifacts     产物路径或输出
nextHint      下一步建议
```

## TaskExecutionRecord

评估器会把结果转成：

```text
TaskExecutionRecord
```

字段：

```text
status
summary
reason
source
artifacts
nextHint
evaluatedAt
```

`source` 很重要：

```text
structured  来自 JSON 协议
heuristic   来自启发式兜底
error       来自异常回退
```

这能让 status/history 展示时知道这次判断有多可靠。

## 评估流程

当前流程：

```text
AgentLoop 返回 reply
  -> evaluateTaskExecutionReply(task, reply)
  -> 先提取 JSON 代码块
  -> 能解析就按 structured
  -> 不能解析就抽取真实回复主体
  -> 用启发式判断 completed / blocked / failed
  -> 写入 TaskSnapshot.lastExecution
```

异常流程：

```text
agent.run(prompt) 抛错
  -> evaluateTaskExecutionError(task, error)
  -> status = failed
  -> source = error
  -> failTask(..., execution)
  -> 写入 lastExecution
```

## 为什么要抽取真实回复主体

有时模型会回显 prompt，而 prompt 里可能包含：

```text
如果当前环境能力不足，也必须写 blockedReason
```

如果直接拿整段文本做关键词判断，可能误判为 blocked。

所以评估器要尽量截取真正的回复主体，再做启发式判断。

## 和状态机的关系

结构化协议不是为了好看，而是为了进入状态机：

```text
completed -> completeTask
blocked   -> blockTask
failed    -> failTask
```

没有明确状态，Orchestrator 就无法安全推进任务。

## 常见误解

### 误解一：让模型说清楚就行

给人看可以，给程序用不够。程序需要稳定字段。

### 误解二：有 JSON 就万无一失

不对。JSON 可能缺字段、格式坏、包在自然语言里，仍然要兜底。

### 误解三：失败都应该 throw

不一定。任务失败是业务状态，应该写回 `failed`。只有系统异常才 throw。

## 值得记住

```text
结构化输出协议是 LLM 自然语言和程序状态机之间的桥。
```

