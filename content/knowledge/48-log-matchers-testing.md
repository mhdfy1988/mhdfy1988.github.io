# 日志 Matcher 与测试断言

## 为什么需要日志 matcher

当日志进入系统主链以后，测试里会经常需要判断：

```text
某个日志事件有没有出现
几个日志事件有没有按顺序出现
事件字段是不是符合预期
```

如果每次都手写：

```ts
const entry = logger.entries.find((item) => item.message === LOG_EVENTS.taskCompleted);
expect(entry?.fields.taskId).toBe("task-1");
```

测试会变得很啰嗦。

更重要的是，这种写法不像在表达领域行为。

所以我们加了日志 matcher。

## 源码落点

```text
tests/setup/custom-matchers.ts
tests/setup/custom-matchers.test.ts
tests/setup/vitest.d.ts
```

当前主要有：

```text
toHaveLogEvent
toHaveLogEventSequence
```

## toHaveLogEvent

它表达：

```text
日志里应该出现某个事件
并且至少带有这些字段
```

示例：

```ts
expect(logger).toHaveLogEvent(LOG_EVENTS.collaborationMessageAppended, {
  taskId: "task-1",
  collaborationKind: "task-handoff",
});
```

这比手写 `entries.find()` 更清楚。

读测试的人一眼知道：

```text
这里在断言协作消息被写入过
```

## toHaveLogEventSequence

它表达：

```text
这些事件应该按顺序出现
```

示例：

```ts
expect(logger).toHaveLogEventSequence([
  LOG_EVENTS.followUpDecided,
  LOG_EVENTS.followUpApplied,
  LOG_EVENTS.retryStarted,
]);
```

它适合验证：

- Runtime 生命周期
- 任务执行主链
- review 子流程
- retry / replan 自动推进链路
- collaboration log 读写顺序

## 为什么不是越多 matcher 越好

matcher 是测试语言，不是装饰品。

第一版先保留两个最常用能力：

```text
有没有出现
顺序是否正确
```

后续如果确实频繁出现，可以再补：

```text
toHaveLogEventCount
toHaveLogEventWithTrace
toHaveOnlyLogEvents
toHaveNoLogEvent
```

但现在没必要一次性堆很多。

## 和领域 matcher 的关系

项目里已经有很多领域 matcher：

- task snapshot
- review plan
- followUp
- replan diff
- collaboration protocol

日志 matcher 是同一思路：

```text
测试不应该只是爬对象路径
测试应该表达领域语义
```

以前我们断言：

```text
这个任务应该完成
```

现在还能断言：

```text
这个任务完成过程中应该产生日志事件
这个 review 子流程应该按顺序发生
```

## 使用边界

不要把日志 matcher 当成所有测试的替代品。

例如：

```text
TaskSnapshot 状态是否正确
CollaborationLog 是否真的保存消息
ExecutionJournal 是否可查询 checkpoint
```

这些仍然要测真实状态。

日志 matcher 适合补充：

```text
是否产生了可观察事件
事件链路顺序是否符合预期
trace 字段是否能串起来
```

## 这轮的工程经验

当系统进入可观察性阶段，日志本身也需要被测试。

否则很容易出现：

```text
功能还在跑
但日志事件名变了
字段漏了
顺序断了
文档也不知道
```

日志 matcher 就是为了让这些问题在测试阶段暴露。

