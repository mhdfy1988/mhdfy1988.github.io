# 自定义 matcher：从字段断言升级成领域断言

## 这个知识点解决什么问题

复杂系统的测试很容易写成“查字段路径”：

```ts
expect(frame.reviews?.[0]?.reviewers?.[0]?.reviewerOwner).toBe("verifier");
```

这种写法能跑，但问题很明显：

```text
路径长
语义弱
对对象结构很敏感
重构时容易大面积改测试
```

自定义 matcher 的价值是把测试从：

```text
看字段
```

升级为：

```text
看语义
```

## 我们项目里怎么做

matcher 实现：

```text
tests/setup/custom-matchers.ts
```

类型声明：

```text
tests/setup/vitest.d.ts
```

注册入口：

```text
tests/setup/vitest.setup.ts
```

典型 matcher：

```text
toHaveSnapshotStatus
toHaveTaskSnapshot
toHavePlanStatus
toHaveCollaborationKind
toHaveRuntimeStatus
toHaveReviewPlan
toHaveReviewResult
toHaveFollowUp
toHaveEscalation
toHaveAssignment
toHaveRunnableBatch
toHaveExecutionRecord
toHaveReviewerChain
toHaveBatchSummary
toHaveLogEvent
toHaveLogEventSequence
```

## 使用前后对比

原始字段断言：

```ts
expect(frame.reviews?.[0]?.taskId).toBe("t1");
expect(frame.reviews?.[0]?.reviewers?.[0]?.reviewerOwner).toBe("verifier");
```

领域 matcher：

```ts
expect(frame).toHaveReviewRouting("t1", {
  reviewers: [{ reviewerOwner: "verifier" }],
});
```

后者更像人在读规则：

```text
任务 t1 应该进入 verifier 的 review routing。
```

## 关键经验

不是所有断言都要抽 matcher。

适合抽 matcher 的场景：

```text
重复出现
领域语义稳定
字段路径较深
同一语义可能出现在不同容器里
```

不适合抽 matcher 的场景：

```text
一次性断言
简单数字或字符串
还不稳定的临时结构
```

## 后续可复用规则

当测试里反复出现：

```text
frame.xxx?.yyy?.zzz
snapshot.tasks.find(...)
message.payload.something
```

就要问一句：

```text
这里是不是已经有稳定领域语义了？
```

如果有，就考虑抽 matcher。

## 日志 matcher 什么时候值得抽

当日志开始承担“行为证明”以后，测试里会不断出现：

```ts
logger.entries.find(...)
logger.entries.filter(...)
```

这时候就说明日志已经不只是“调试看一眼”，而是变成了可断言的领域对象。

当前日志层最值得单独抽的两类 matcher 是：

```text
toHaveLogEvent
toHaveLogEventSequence
```

它们分别回答：

```text
某个事件有没有出现
一组事件顺序对不对
```

如果后面日志断言继续变复杂，再考虑继续往下拆：

```text
事件出现次数
共享 traceId
共享 taskId / planId
```

## matcher 真正落地的判断标准

一个 matcher 写出来，并不代表它真的有价值。

更重要的判断标准是：

```text
它有没有进入代表性的业务测试
```

当前日志 matcher 已经不只停留在 `custom-matchers.test.ts` 自测里，还已经迁到这些代表性测试：

```text
tests/agent/agent-loop.test.ts
tests/gateway/gateway-adapters.test.ts
tests/mcp/mcp-client-manager.test.ts
tests/team/team-coordinator.test.ts
tests/runtime/runtime-bundle.test.ts
tests/team/collaboration-log.test.ts
```

这说明它已经开始承接真实业务语义，而不是停留在“测试框架技巧”层。
