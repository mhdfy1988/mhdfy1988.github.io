# 20 - 角色 Agent 的独立会话隔离

## 先说结论

当前项目里的 `worker / explorer / verifier` 不是简单的字符串标签。

它们已经有了各自独立的 `AgentLoop + SessionState`。

源码落点：

- `../../src/team/default-task-executors.ts`
- `../../src/team/role-task-executor.ts`
- `../../src/team/main-task-executor.ts`
- `../../src/agent/agent-loop.ts`
- `../../src/session/session-state.ts`

## 它解决什么问题

如果所有角色都共用同一个主会话，会出现一个问题：

```text
worker 的执行过程
explorer 的调查过程
verifier 的审查过程
全部混进 main 对话历史
```

这样短期看方便，但长期会让上下文越来越脏。

尤其是接到 IDE 或多工作空间时，你会希望：

```text
每个工作空间可以有自己的 agent
每个角色可以有自己的执行轨迹
主对话不要被子角色过程污染
```

所以当前设计让角色执行器自己持有独立会话。

## main 和角色执行器有什么区别

### main 执行器

`MainTaskExecutor` 直接复用 runtime 暴露出来的主 agent：

```text
MainTaskExecutor -> runtime.agent.run(...)
```

这意味着 main 代表当前主会话。

它适合做：

- 总控
- 文档类任务
- 协调类任务
- 对用户可见的主线回复

### role 执行器

`RoleTaskExecutor` 在构造时新建自己的 `SessionState`：

```text
new AgentLoop(
  new SessionState(),
  contextBuilder,
  model,
  tools,
  permissions,
  hooks,
  learning,
  reflection,
  toolContext,
  ...
)
```

这意味着 `worker / explorer / verifier` 各自有自己的消息轨迹。

## 共享什么，不共享什么

### 共享

角色执行器共享 runtime 装配好的能力：

- `ContextBuilder`
- `ModelClient`
- `ToolRegistry`
- `PermissionChecker`
- `HookRunner`
- `LearningStore`
- `ReflectionLoop`
- `ToolExecutionContext`

这保证它们还是同一套系统能力。

### 不共享

角色执行器不共享 `SessionState`。

每个角色都有自己的：

- `sessionId`
- `turnNumber`
- `messages`

这保证它们的执行过程互不污染。

## 为什么角色执行器默认关闭 learning

`RoleTaskExecutor` 里有一句很关键：

```text
learningEnabled: options.learningEnabled ?? false
```

这表示角色执行器默认不写长期学习记录。

原因是：

```text
角色执行过程属于任务推进，
不是每一句都值得进入长期记忆。
```

否则 worker 的临时尝试、verifier 的审查意见、explorer 的中间调查，都可能污染主记忆。

## 角色 prompt 是怎么注入的

`RoleTaskExecutor.run(...)` 不会直接把任务 prompt 丢给模型，而是包了一层角色说明：

```text
你当前扮演的角色：Worker Agent。
你偏向实现和落地...
你只需要围绕当前分配任务推进一轮，不要擅自改整张计划。
```

这说明角色边界不是靠模型自己猜，而是由执行器显式注入。

## 常见误解

### 误解一：多 Agent 就是多个 owner 字段

不对。

`owner` 只是调度标签。

真正变成多 Agent，要至少有：

- 执行器注册表
- 独立会话
- 角色提示词
- 任务输入输出协议

### 误解二：所有角色都应该共享记忆

共享长期记忆可以，但不等于共享会话轨迹。

当前设计是：

```text
共享系统能力
隔离执行上下文
```

这是更稳的第一版。

### 误解三：角色 Agent 应该自己改计划

不对。

角色执行器的 prompt 已经明确：

```text
不要擅自改整张计划
```

计划修改应该回到 `Runtime / Replanner / Orchestrator`。

## 值得记住

```text
多 Agent 的第一步，不是让 Agent 乱聊，
而是先把“角色执行轨迹”和“主会话轨迹”隔离开。
```

