# 01 - AgentLoop 内核边界

## 先说结论

`AgentLoop` 是单轮执行内核，不是整个 Agent 系统。

它回答的是：

```text
这一轮输入怎么跑完？
```

它不回答：

```text
大目标怎么拆？
任务做到哪了？
中断后怎么恢复？
blocked 后怎么重规划？
多个 agent 怎么分工？
系统怎么长期在线？
```

源码落点：

- `../../src/agent/agent-loop.ts`
- `../../src/runtime/runtime-bundle.ts`
- `../agentloop-evolution.md`

## AgentLoop 当前负责什么

当前 `AgentLoop.run(...)` 大致负责这条链路：

```text
用户输入
  -> session.addUserMessage()
  -> contextBuilder.build()
  -> model.decide()
  -> 如果是 reply：写 assistant message，结束
  -> 如果是 tool_call：权限检查
  -> hooks.emit("tool:pre")
  -> tools.call()
  -> hooks.emit("tool:post")
  -> 写 tool message
  -> 继续下一轮模型决策
  -> finishTurn：learning / reflection 收尾
```

也就是说，它主要管理：

```text
当前这一轮的上下文
当前这一轮的模型决策
当前这一轮的工具调用
当前这一轮的消息写回
当前这一轮的学习沉淀
```

## 它为什么不能负责所有事情

如果把计划、快照、恢复、重规划、多 Agent 都塞进 `AgentLoop`，它会变成一个上帝对象：

```text
AgentLoop
  既要管模型
  又要管工具
  又要管计划
  又要管任务状态
  又要管文件快照
  又要管多 agent 分工
  又要管 gateway 在线
```

这样后面会出现几个问题：

1. **边界不清**：读代码的人不知道哪里是单轮执行，哪里是任务编排。
2. **状态混乱**：消息历史、任务状态、计划历史可能混在一起。
3. **测试困难**：想测工具循环，却被任务快照和 gateway 生命周期影响。
4. **扩展困难**：以后加多 Agent，必须改 `AgentLoop.run()` 主体。

所以我们把外层能力拆出去：

```text
Planning      负责拆任务
TaskState     负责保存进度
Orchestration 负责推进任务
Runtime       负责装配和生命周期
Gateway       负责外部入口
```

## 当前仓库里怎么体现边界

`AgentLoop` 不自己 new 这些对象，而是接收依赖：

```text
SessionState
ContextBuilder
ModelClient
ToolRegistry
PermissionChecker
HookRunner
LearningStore
ReflectionLoop
MemoryStore
```

这说明：

```text
AgentLoop 是使用者，不是装配者。
```

Runtime 才是装配者：

```text
createRuntimeBundle()
  -> new SessionState()
  -> new ContextBuilder(...)
  -> new AgentLoop(...)
```

任务编排也在外面：

```text
runtime.startNextAndExecute()
  -> taskOrchestrator.startNext()
  -> runtime.executeCurrentTask(...)
  -> agent.run(prompt)
  -> evaluate
  -> taskOrchestrator.complete/block/fail
```

AgentLoop 只负责中间那一步：

```text
agent.run(prompt)
```

## 和成熟 Agent 的对应关系

看 Codex、Claude Code、Hermes、OpenClaw 时，也可以按这个问题拆：

```text
单轮模型-工具循环在哪里？
任务计划在哪里？
任务状态在哪里？
恢复和重规划在哪里？
多 Agent 派发在哪里？
```

如果一个系统看起来很复杂，先找“AgentLoop 等价物”，再往外分层，复杂度会下降很多。

## 常见误解

### 误解一：AgentLoop 越强越好

不对。`AgentLoop` 越强，越容易变成不可维护的大杂烩。它应该稳定、窄、可复用。

### 误解二：任务失败应该直接在 AgentLoop 里改全局状态

不对。`AgentLoop` 可以返回失败结果，但任务状态应该由 `TaskOrchestrator` 统一改。

### 误解三：多 Agent 就是在 AgentLoop 里递归调用 AgentLoop

不准确。多 Agent 更适合放在外层 orchestrator / coordinator 里，由它决定派给哪个 worker。

## 值得记住

```text
AgentLoop 是执行心脏，不是整个身体。
```

学习 Agent 架构时，第一步不是记一堆名词，而是先分清：

```text
单轮执行内核
运行时装配层
计划层
编排层
快照层
多 Agent 层
在线平台层
```

