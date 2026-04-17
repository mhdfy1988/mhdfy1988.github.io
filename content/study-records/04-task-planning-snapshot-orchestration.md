# 学习记录-04-任务计划与快照编排

## 这一篇接在 03 后面

前面三篇大概是：

- 01：入口层与 Commander CLI
- 02：Config 启动契约与加载
- 03：Runtime 装配与生命周期

到 03 为止，我们已经知道：

```text
命令怎么进来
配置怎么加载
Runtime 怎么把系统组件装起来
```

但这时 Agent 还只是“能跑一轮”。

这一篇开始进入更像 Agent 系统的核心：

```text
一个目标如何变成任务计划
任务计划如何变成可恢复的执行状态
执行过程中如何推进、失败、重试、恢复和重规划
```

一句话：

```text
04 讲的是：任务系统怎么长出来
```

---

## 为什么需要这一层

如果只有 `AgentLoop`，系统能做的是：

```text
用户输入一句话
AgentLoop 跑一轮
模型回复
结束
```

这对聊天足够，但对真正做事不够。

因为复杂任务通常不是一轮能结束的：

```text
目标：完善 Agent 的任务系统

可能拆成：
1. 设计任务计划结构
2. 保存当前执行状态
3. 执行当前任务
4. 记录执行结果
5. 失败后重新规划
6. 中断后恢复继续
```

如果没有任务层，每次中断之后系统都会忘掉：

- 之前拆过哪些任务
- 哪些已经完成
- 当前卡在哪一步
- 下一步应该做什么
- blocked 后应该怎么改计划

所以需要把“聊天的一轮”升级成“可推进的任务状态机”。

---

## 这一阶段的核心结论

当前项目里，这一层主要由三组东西组成：

```text
Planning
  负责生成静态计划

TaskState
  负责保存动态快照

Orchestration
  负责推进任务状态
```

再加上一个补充能力：

```text
Replanner
  负责 blocked 后生成新 revision
```

所以主链可以看成：

```text
用户目标
  -> TaskPlan
  -> PlanSnapshot
  -> TaskStore 保存
  -> TaskOrchestrator 推进
  -> AgentLoop 执行当前任务
  -> TaskExecutionRecord 写回
  -> complete / block / fail / retry / replan
```

---

## 关键源码位置

这一篇主要看这些文件：

- `src/planning/planning-types.ts`
- `src/planning/default-planner.ts`
- `src/planning/default-replanner.ts`
- `src/task-state/task-snapshot.ts`
- `src/task-state/task-store.ts`
- `src/task-state/file-task-store.ts`
- `src/orchestration/task-orchestrator.ts`
- `src/orchestration/task-execution-evaluator.ts`
- `src/runtime/runtime-bundle.ts`
- `src/entry/cli.ts`

如果按阅读顺序，我建议这样走：

```text
planning-types.ts
  -> task-snapshot.ts
  -> task-store.ts
  -> task-orchestrator.ts
  -> runtime-bundle.ts
  -> cli.ts
```

先理解类型，再看谁创建、谁保存、谁推进、谁调用。

---

## 第一层：TaskPlan 是静态计划

`TaskPlan` 回答的是：

```text
这个目标被拆成了哪些任务？
这些任务之间有什么依赖？
建议由谁负责？
```

它更像一张计划单。

计划单本身不代表任务已经开始执行。

比如：

```text
TaskPlan
  id: plan-001
  goal: 完善任务系统
  tasks:
    - id: task-1
      title: 设计 TaskSnapshot
      status: pending
      suggestedOwner: main

    - id: task-2
      title: 实现 TaskStore
      status: pending
      dependsOn: task-1
      suggestedOwner: worker
```

这里的重点是：

```text
TaskPlan 是定义，不是运行态
```

它描述“应该怎么做”，但不负责记录“现在做到哪”。

---

## 第二层：TaskSnapshot 是运行态

`TaskSnapshot` 回答的是：

```text
某一个任务现在执行到什么状态？
尝试过几次？
最近一次结果是什么？
有没有 blocked 原因？
最后一次执行记录是什么？
```

它记录的是动态状态。

比如：

```text
TaskSnapshot
  taskId: task-1
  status: completed
  attemptCount: 1
  assignedOwner: main
  startedAt: ...
  completedAt: ...
  lastResultSummary: 已完成 TaskSnapshot 类型设计
  lastExecution: {...}
```

这里有一个很重要的区别：

```text
TaskPlan 说：任务应该是什么
TaskSnapshot 说：任务现在怎么样
```

不要把这两个东西混在一起。

如果把运行状态直接写回 `TaskPlan`，后面会很难做：

- 历史版本
- replan revision
- restore
- archive
- retry
- 多角色执行记录

所以它们必须分开。

---

## 第三层：PlanSnapshot 是整张计划的执行快照

单个任务有 `TaskSnapshot`。

整张计划也需要一个大的快照，也就是 `PlanSnapshot`。

它回答的是：

```text
整张计划现在处于什么状态？
当前有哪些任务正在执行？
哪些任务可以执行？
哪些任务已经完成？
有没有归档？
有没有历史记录？
```

你可以把它理解成：

```text
PlanSnapshot = 当前任务棋盘
TaskSnapshot = 棋盘上一颗棋子的状态
```

当前项目里已经开始支持：

- `runningTasks`
- `runnableTaskIds`
- `lastExecution`
- `followUp`
- `reviews`
- `history`
- `archive`
- `restore`

这些字段让系统不只是知道“当前任务”，而是知道“当前任务局面”。

---

## 第四层：TaskStore 负责保存快照

`TaskStore` 解决的是：

```text
这些计划和快照存在哪里？
```

第一版一般会有两种：

- `InMemoryTaskStore`
- `FileTaskStore`

内存版适合测试。

文件版适合 CLI 跨命令恢复。

比如你执行：

```text
harness-agent execute-plan "完成一个任务"
```

执行过程中产生了 active plan。

如果系统退出，下次执行：

```text
harness-agent resume
```

就需要从文件里把 active plan 读回来。

这就是 `FileTaskStore` 的意义。

它让任务从“只存在于这一次进程里”变成“可以跨进程恢复”。

---

## 第五层：TaskOrchestrator 负责推进状态

`TaskOrchestrator` 是任务推进器。

它不负责调模型。

它负责：

- 初始化 snapshot
- 找出下一项可执行任务
- 标记任务开始
- 标记任务完成
- 标记任务 blocked
- 标记任务 failed
- retry
- archive
- restore
- replan 后替换 active plan

可以把它理解成：

```text
任务状态的唯一改写入口
```

这点很重要。

如果 CLI、Runtime、AgentLoop 都能随便改任务状态，系统很快会乱。

所以更稳的方式是：

```text
Runtime 可以调用 Orchestrator
CLI 可以调用 Runtime
AgentLoop 只返回执行结果
真正改任务状态的是 TaskOrchestrator
```

---

## 第六层：TaskExecutionEvaluator 把自然语言结果变成结构化结果

`AgentLoop` 最终通常会返回一段自然语言。

但任务系统不能只靠自然语言判断。

它需要知道：

```text
这项任务到底是完成了？
还是卡住了？
还是失败了？
```

所以需要 `TaskExecutionEvaluator`。

它会把执行结果转成类似：

```text
completed
blocked
failed
```

再交给 `TaskOrchestrator` 更新状态。

这就是“结构化任务结果协议”的第一版。

---

## 第七层：Replanner 负责 blocked 后修订计划

当某个任务 blocked 时，系统不应该只说“失败了”。

更好的方式是：

```text
基于当前快照，生成一个新的计划 revision
```

比如：

```text
原计划：
1. 实现 FileTaskStore
2. 接入 Runtime

执行到第 1 步时 blocked：
原因：还没有定义 ActivePlanState

Replanner 生成 revision 2：
1. 先定义 ActivePlanState
2. 实现 FileTaskStore
3. 接入 Runtime
```

这里的重点是：

```text
Replanner 不是重新开始
而是在已有状态上修订计划
```

它会保留已经完成的成果，不应该把整个计划打回原点。

---

## 一轮具体流程

用一个具体例子串起来。

用户输入：

```text
harness-agent execute-plan "完善任务系统"
```

### 第 1 轮：创建计划

```text
CLI
  -> createRuntimeBundle()
  -> runtime.createPlan(goal)
  -> planner.plan(goal)
  -> TaskPlan
```

这一步得到静态计划。

### 第 2 轮：初始化快照

```text
TaskPlan
  -> initializeSnapshot()
  -> PlanSnapshot
  -> TaskStore.saveActivePlan(...)
```

这一步把计划变成可保存、可恢复的执行状态。

### 第 3 轮：启动当前任务

```text
TaskOrchestrator.startNext()
  -> 找到第一个可执行 task
  -> task.status = in_progress
  -> attemptCount + 1
  -> TaskStore.saveActivePlan(...)
```

这一步不是执行模型，只是把任务状态推进到“正在执行”。

### 第 4 轮：执行当前任务

```text
Runtime
  -> AgentLoop.run(task prompt)
  -> 模型输出
  -> 工具调用
  -> 返回 reply
```

真正跑模型和工具的是 `AgentLoop`。

### 第 5 轮：评估执行结果

```text
TaskExecutionEvaluator.evaluate(reply)
  -> TaskExecutionResult
```

这一步把自然语言结果转成结构化状态。

### 第 6 轮：写回状态

如果完成：

```text
TaskOrchestrator.completeTask(...)
```

如果 blocked：

```text
TaskOrchestrator.blockTask(...)
```

如果 failed：

```text
TaskOrchestrator.failTask(...)
```

最后都写回 `TaskStore`。

---

## 中断恢复到底恢复了什么

当前项目已经支持的是：

```text
任务边界恢复
```

意思是：

```text
某个任务开始前 / 完成后 / blocked 后
系统可以从 TaskStore 读回 active plan
然后继续调度下一步
```

比如：

```text
task-1 completed
task-2 pending
程序退出
```

下次 `resume` 时，可以知道：

```text
task-1 不用重跑
从 task-2 继续
```

但当前还不是：

```text
轮内精确恢复
```

也就是说，如果一项任务执行到第 3 个 tool call 时进程断了，下次还不能从第 4 个 tool call 继续。

现在更准确的能力边界是：

```text
可以从任务边界恢复
还不能从 tool call 边界恢复
```

这也是后面要补 `Execution Journal / Checkpoint` 的原因。

---

## 为什么不能把这些都塞进 AgentLoop

如果把这些都塞进 `AgentLoop.run()`，它会变成：

```text
AgentLoop
  既负责模型
  又负责任务计划
  又负责快照
  又负责状态机
  又负责重规划
  又负责历史归档
```

这会导致几个问题：

- 难测试
- 难恢复
- 难接入 CLI / Gateway / IDE
- 难做多 Agent
- 难替换存储层

所以现在的架构选择是：

```text
AgentLoop 保持小
任务系统长在外面
```

这是一个非常重要的架构判断。

---

## 当前阶段已经完成什么

到这一篇为止，我们已经完成了：

- `TaskPlan`
- `TaskItem`
- `TaskSnapshot`
- `PlanSnapshot`
- `TaskStore`
- `FileTaskStore`
- `TaskOrchestrator`
- `TaskExecutionEvaluator`
- `status`
- `history`
- `archive`
- `restore`
- `retry`
- `replan`
- `replan --preview`
- `lastExecution`

这些组合起来，V3 主体就算站住了。

---

## 还没有完成什么

当前还没完全完成的是：

- tool call 级别的执行日志
- 轮内精确恢复
- 更成熟的 replan diff / 人工确认
- 更复杂的多 Agent 协作协议
- 长期在线任务队列
- 跨 IDE / Gateway 的实例路由

这些不属于 04 的主线，后面可以拆成：

```text
05 TeamCoordinator 与多 Agent 协作
06 Execution Journal 与精确恢复
07 长期在线与平台入口
```

---

## 这一篇最该记住的几个点

### 1. TaskPlan 和 TaskSnapshot 必须分开

计划定义和运行状态不是一回事。

```text
TaskPlan = 应该怎么做
TaskSnapshot = 当前做到哪
```

### 2. TaskStore 是恢复能力的地基

没有持久化，`resume` 就只是空话。

### 3. TaskOrchestrator 是状态改写入口

不要让 CLI、Runtime、AgentLoop 到处改状态。

### 4. Replanner 是修订，不是重开

blocked 后应该基于当前进度修计划，而不是从头来一遍。

### 5. 当前恢复是任务边界恢复

不是 tool call 级别的精确恢复。

这个边界必须说清楚，否则后面会误判系统能力。

---

## 学习建议

读代码时不要从 `AgentLoop` 里面硬找所有答案。

这条线应该这样读：

```text
TaskPlan
  -> TaskSnapshot
  -> TaskStore
  -> TaskOrchestrator
  -> Runtime executePlan
  -> AgentLoop run
  -> TaskExecutionEvaluator
  -> TaskOrchestrator 写回
```

这样读，任务系统会清楚很多。

如果只盯着 `AgentLoop.run()`，会感觉“怎么没看到计划和恢复”。

原因很简单：

```text
这些能力本来就不应该在 AgentLoop 里面
```

---

## 本篇结论

`04` 的核心不是某一个类，而是一个判断：

```text
Agent 系统要从“单轮响应”
走向“可推进、可恢复、可修订的任务系统”
```

而当前项目这一阶段的最小闭环就是：

```text
TaskPlan
  + TaskSnapshot
  + TaskStore
  + TaskOrchestrator
  + Replanner
```

这就是 Runtime 之后真正开始“像 Agent 系统”的地方。
