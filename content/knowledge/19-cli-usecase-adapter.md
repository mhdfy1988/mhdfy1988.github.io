# 19 - CLI 用例适配层

## 先说结论

`CLI` 不是 Agent 的核心。

它在当前项目里的角色更准确地说是：

```text
外部命令 -> Runtime 用例
```

也就是一个“用例适配层”。

源码落点：

- `../../src/entry/cli.ts`
- `../../src/runtime/runtime-bundle.ts`
- `../../src/task-state/file-task-store.ts`

## 它解决什么问题

用户在命令行里输入的是：

```text
harness-agent chat ...
harness-agent interactive
harness-agent plan ...
harness-agent execute-plan ...
harness-agent resume
harness-agent status
harness-agent history
harness-agent archive
harness-agent restore-plan
harness-agent replan
harness-agent retry
```

但系统内部真正关心的是：

```text
runtime.agent.run(...)
runtime.plan(...)
runtime.initializePlan(...)
runtime.executeCurrentTask(...)
runtime.resumeAndExecute(...)
runtime.replanBlockedTaskAndExecute(...)
runtime.retryTaskAndExecute(...)
```

所以 `src/entry/cli.ts` 的核心职责不是执行智能体逻辑，而是把“命令行语言”翻译成“Runtime 用例调用”。

## 当前 CLI 分成两层

### 第一层：Commander 命令声明

`cli.ts` 里用 `commander` 声明了正式子命令：

```text
demo
chat
interactive
plan
execute-plan
resume
status
history
archive
restore-plan
replan
retry
```

这一层负责：

- 命令名称
- 参数
- option
- help 文案
- alias

例如 `execute-plan` 会接收目标文本，还可以接：

```text
--auto-follow-up
--max-auto-steps
```

### 第二层：用例函数

每个命令最终都会进入一个 `runXxx(...)` 函数：

```text
runOnce
runInteractive
runPlan
runExecutePlan
runResume
runStatus
runHistory
runArchive
runRestorePlan
runReplan
runRetry
```

这一层才开始调用 `RuntimeBundle`。

## 为什么 root action 里也有一套分发

你会看到 `program.argument("[text...]")` 的 root action 里也判断了：

```text
demo
interactive
chat
plan
execute-plan
resume
status
...
```

这不是最优雅的最终形态，但现在有两个实际作用：

1. 兼容旧入口习惯，例如直接写 `harness-agent demo`。
2. 允许未匹配正式子命令时，把剩余文本当成普通聊天。

也就是说，它现在同时承担：

```text
兼容旧命令
兜底单轮聊天
```

后续如果 CLI 越来越成熟，可以把 root action 收薄，让正式子命令成为唯一主入口。

## 持久化任务为什么在 CLI 里配置

普通聊天可以用内存态：

```text
createRuntimeBundle(settings)
```

但跨命令恢复必须能读回上次状态，所以 CLI 提供了：

```text
createPersistentRuntimeBundle(settings)
```

它用 factory 覆盖了默认的 `TaskStore`：

```text
createTaskStore: () => new FileTaskStore({
  filePath: getPersistentTaskStorePath()
})
```

默认文件位置是：

```text
.harness-agent/active-plan.json
.harness-agent/plan-history.json
```

这说明一个很重要的边界：

```text
Runtime 支持注入持久化 store，
但 CLI 决定当前命令是否需要跨进程持久化。
```

## 这个知识点和 Facade 的区别

`15-runtime-facade-pattern.md` 讲的是：

```text
RuntimeBundle 如何把复杂内部系统包成稳定门面
```

这一篇讲的是：

```text
CLI 如何把外部命令翻译成 Runtime 门面调用
```

两者关系是：

```text
CLI Adapter -> Runtime Facade -> 内部模块
```

## 常见误解

### 误解一：CLI 是项目入口，所以业务逻辑应该写在 CLI

不对。

CLI 只是外部入口之一。以后还有：

- Web Gateway
- Desktop Gateway
- IDE Gateway
- Messaging Gateway

如果业务逻辑写在 CLI，其他入口就复用不了。

### 误解二：命令越多，CLI 文件越核心

不对。

命令越多，越要保持 CLI 只是适配层。

真正核心的用例应该继续沉到 `runtime-bundle.ts`。

### 误解三：打印函数也是业务逻辑

不是。

`printPlanResult`、`printTaskExecutionResult`、`printOrchestrationResult` 这些是展示层逻辑。

它们可以很长，但不应该改变任务状态。

## 值得记住

```text
CLI 的职责是“翻译命令”，不是“执行业务”。
业务主线越复杂，CLI 越应该只调用 Runtime 用例。
```

