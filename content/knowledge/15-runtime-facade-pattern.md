# 15 - Facade 门面模式

## 先说结论

门面模式（Facade Pattern）给复杂子系统提供一个更简单、稳定的对外入口。

当前项目里的门面是：

```text
RuntimeBundle
```

源码落点：

- `../../src/runtime/runtime-bundle.ts`
- `../../src/runtime/index.ts`
- `../../src/entry/cli.ts`

## 为什么需要门面

执行一个任务其实涉及很多模块：

```text
TaskStore
TaskOrchestrator
Planner
Replanner
AgentLoop
TaskExecutionEvaluator
HookRunner
PermissionChecker
```

如果 CLI 直接串这些模块，就会变成：

```text
CLI 既解析命令
又知道任务状态
又知道怎么 build prompt
又知道怎么 evaluate
又知道怎么 replan
```

这会让入口层越来越重。

RuntimeBundle 把这些复杂调用封装起来。

## 当前 RuntimeBundle 暴露什么

当前对外方法包括：

```text
agent.run(...)
plan(...)
initializePlan(...)
planAndInitialize(...)
getActivePlan()
executeCurrentTask(...)
startNextAndExecute()
resumeAndExecute()
previewReplanBlockedTask(...)
replanBlockedTask(...)
replanBlockedTaskAndExecute(...)
retryTask(...)
retryTaskAndExecute(...)
start()
stop()
dispose()
```

这些都是外部入口可以理解的用例。

## 一个例子：execute-plan

CLI 的 `execute-plan` 不需要自己知道所有内部步骤。它只需要：

```text
runtime.plan(goal)
runtime.initializePlan(plan)
runtime.taskOrchestrator.startNext()
runtime.executeCurrentTask(started)
```

更进一步，这些能力也可以继续封装成更高层方法。

关键是 CLI 不应该自己写：

```text
构造任务执行 prompt
调用 agentLoop
解析结构化 JSON
complete/block/fail
写 lastExecution
```

这些属于 runtime / orchestration 层。

## 一个例子：replan preview

CLI 运行：

```powershell
npm.cmd run dev -- replan --preview
```

内部是：

```text
runtime.previewReplanBlockedTask(...)
  -> getActivePlan()
  -> resolve blocked task
  -> build planning context
  -> replanner.replan(...)
  -> buildReplanDiff(...)
```

CLI 只负责打印 preview。

这就是门面模式的效果。

## Facade 和封装的边界

Facade 不是把所有内部对象都藏起来。当前 `RuntimeBundle` 仍然暴露了一些对象：

```text
taskStore
taskOrchestrator
planner
replanner
```

这是学习项目的折中：方便阅读和测试。

成熟产品里可以进一步收紧，只暴露稳定用例。

## 常见误解

### 误解一：Facade 只是多一层转发

不对。Facade 的价值是稳定外部调用边界，隐藏内部组合复杂度。

### 误解二：Runtime 暴露越多越方便

短期方便，长期会让外部依赖内部细节。应该优先暴露稳定用例。

### 误解三：有 Facade 就不需要模块分层

不对。Facade 只是入口，内部仍然需要清晰模块边界。

## 值得记住

```text
RuntimeBundle 是外部入口理解整个系统的门面。
```

Facade 的目标不是让内部变简单，而是让外部不用知道内部有多复杂。

