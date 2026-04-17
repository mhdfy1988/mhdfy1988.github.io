# 学习记录-05-TeamCoordinator 与多 Agent 协作

## 这一篇接在 04 后面

前面四篇大概是：

- 01：入口层与 Commander CLI
- 02：Config 启动契约与加载
- 03：Runtime 装配与生命周期
- 04：任务计划与快照编排

到 04 为止，我们已经知道：

```text
用户目标可以拆成 TaskPlan
TaskPlan 可以生成 TaskSnapshot
TaskStore 可以保存 active plan
TaskOrchestrator 可以推进任务状态
Replanner 可以在 blocked 后修订计划
```

这时系统已经从“单轮聊天”变成了“可推进的任务系统”。

但它还没有真正进入多 Agent 协作。

这一篇讲的是：

```text
当任务系统已经能推进以后
如何让不同角色的 Agent 参与执行、审查、重试、重规划和后续推进
```

一句话：

```text
05 讲的是：团队协作层怎么长出来
```

---

## 先说结论

当前这轮最重要的变化，不是“多加几个角色名”。

而是：

```text
TeamCoordinator 开始成为 runtime 的团队主链
```

也就是说，系统不再只是：

```text
TaskOrchestrator 找到当前任务
Runtime 直接执行
执行完就结束
```

而是变成：

```text
TaskOrchestrator 找到可执行任务
TeamCoordinator 先看整轮团队态势
Runtime 按协调结果执行
ReviewPolicy 判断要不要审查
角色 Agent 执行各自任务
TeamCoordinator 汇总结果
followUp 决定继续、重试、重规划或人工停下
```

这就是从“任务推进器”走向“团队协作系统”的关键一步。

---

## 为什么需要 TeamCoordinator

04 里已经有 `TaskOrchestrator`。

它很重要，但它只回答：

```text
任务状态应该怎么推进？
```

比如：

- 哪个任务 pending
- 哪个任务 in_progress
- 哪个任务 completed
- 哪个任务 blocked
- 哪个任务 failed

但它不应该回答：

- 这项任务交给 main 还是 worker？
- 哪些任务可以并行跑？
- worker 完成之后要不要 verifier 审查？
- high priority 是否还要 main 二次审查？
- review 不通过时应该 retry 还是 replan？
- 当前整轮团队态势是什么？

这些问题属于团队层。

所以需要一个新的角色：

```text
TeamCoordinator
```

它不是替代 `TaskOrchestrator`。

它和 `TaskOrchestrator` 的关系是：

```text
TaskOrchestrator 管状态
TeamCoordinator 管团队策略
```

---

## 关键源码位置

这一篇主要看这些文件：

- `src/team/team-coordinator.ts`
- `src/team/default-team-coordinator.ts`
- `src/team/coordination-context.ts`
- `src/team/coordination-frame.ts`
- `src/team/coordination-rules.ts`
- `src/team/task-executor.ts`
- `src/team/task-executor-registry.ts`
- `src/team/default-task-executors.ts`
- `src/team/role-task-executor.ts`
- `src/team/main-task-executor.ts`
- `src/team/task-review-policy.ts`
- `src/team/default-task-review-policy.ts`
- `src/runtime/runtime-bundle.ts`
- `src/task-state/task-snapshot.ts`

建议阅读顺序：

```text
team-coordinator.ts
  -> coordination-context.ts
  -> coordination-frame.ts
  -> default-team-coordinator.ts
  -> task-executor-registry.ts
  -> default-task-executors.ts
  -> default-task-review-policy.ts
  -> runtime-bundle.ts
```

先看接口和数据结构，再看默认实现，最后看 runtime 怎么串起来。

---

## 第一层：从 TaskCoordinator 到 TeamCoordinator

早期思路更像：

```text
TaskCoordinator.coordinate(task)
TaskCoordinator.summarize(taskResult)
```

这是一种单任务视角。

它能回答：

```text
这一项任务交给谁？
这一项任务完成后建议做什么？
```

但它回答不了：

```text
当前整张计划有哪些任务可以跑？
哪些任务可以 batch？
哪些任务需要 review？
review 应该顺序还是并行？
这轮结果是否应该升级为 escalation？
```

所以我们把主线迁到 `TeamCoordinator`。

它的视角不是单任务，而是：

```text
整轮团队态势
```

---

## 第二层：CoordinationContext 是协调输入

`TeamCoordinator` 不能只拿一个 task 做判断。

它需要看到更完整的上下文，也就是 `CoordinationContext`。

它大概包含：

```text
active plan state
当前任务快照
可执行任务列表
最近执行结果
最近 review 结果
pending review plan
当前 plan 状态
```

用一句话说：

```text
CoordinationContext = 这一轮团队决策需要看的材料
```

这一步很重要。

因为如果没有统一输入，runtime 就会变成：

```text
这里查一次 task snapshot
那里查一次 review result
再到别处拼一个 followUp
```

最后所有策略都会散在 runtime 里。

所以先把输入收成一个上下文对象。

---

## 第三层：CoordinationFrame 是协调输出

`TeamCoordinator.buildFrame(...)` 输出的是 `CoordinationFrame`。

它不是一句自然语言建议，而是一张可执行的协调帧。

它可以包含：

- assignments：任务应该分配给谁
- runnableBatch：这一轮哪些任务可以一起跑
- reviews：哪些任务要审查
- escalations：哪些情况要升级处理
- summary：当前团队态势摘要

也就是说：

```text
CoordinationFrame = runtime 接下来怎么动的团队级说明书
```

这比“返回一句建议”更稳定。

因为 runtime 可以按 frame 做明确动作，而不是猜一句话里的意思。

---

## 第四层：角色 Agent 不只是字符串标签

当前项目里的角色大概有：

- main
- worker
- explorer
- verifier

最容易误解的是：

```text
多 Agent = 多几个 owner 字符串
```

这不对。

当前更关键的设计是：

```text
worker / explorer / verifier 拥有独立的 AgentLoop + SessionState
```

也就是说，它们不是简单标签，而是角色执行器。

### main 角色

`main` 复用主 runtime 的 agent：

```text
MainTaskExecutor -> runtime.agent.run(...)
```

它适合做：

- 总控
- 用户可见的主线回复
- 文档类收口
- 协调类任务

### worker / explorer / verifier

这些角色通过 `RoleTaskExecutor` 创建独立的执行会话：

```text
RoleTaskExecutor
  -> new SessionState()
  -> new AgentLoop(...)
```

这意味着：

```text
每个角色有自己的消息轨迹
不会把 worker / explorer / verifier 的过程全部塞进主会话
```

这个设计对以后接 IDE 很重要。

比如：

```text
VS Code workspace A
  -> 一个 agent 实例

VS Code workspace B
  -> 另一个 agent 实例

worker / verifier
  -> 各自有独立执行轨迹
```

这样不同工作空间、不同角色之间不会互相污染上下文。

---

## 第五层：TaskExecutorRegistry 负责 owner 到 executor 的映射

有了角色以后，runtime 不应该写成：

```text
if owner === "worker" then ...
if owner === "explorer" then ...
if owner === "verifier" then ...
```

更好的方式是：

```text
TaskExecutorRegistry
  main -> MainTaskExecutor
  worker -> RoleTaskExecutor(worker)
  explorer -> RoleTaskExecutor(explorer)
  verifier -> RoleTaskExecutor(verifier)
```

runtime 只需要问：

```text
这个 owner 对应哪个 executor？
```

这样后面新增角色时，不需要大改 runtime 主流程。

这就是注册表思路在多 Agent 层的用法。

---

## 第六层：ReviewPolicy 负责审查计划

多 Agent 不只是“worker 去做事”。

还要有：

```text
谁来审查 worker 的结果？
```

所以我们引入了 `ReviewPolicy`。

它只回答一个问题：

```text
这轮任务执行之后，要不要 review？
如果要 review，谁来 review，按什么顺序 review？
```

它不负责执行审查。

它产出的是：

```text
TaskReviewPlan
```

第一版默认策略很保守：

```text
worker 完成 implementation
  -> verifier review

high priority implementation
  -> verifier review
  -> main review
```

默认先用顺序审查：

```text
verifier 先看具体实现
main 再看整体收口
```

这比一上来并行 review 更容易理解，也更容易测试。

---

## 第七层：Runnable Batch 是最小并行基础

当系统有多任务、多角色之后，一个自然问题是：

```text
哪些任务可以同时跑？
```

当前项目已经有了最小版 runnable batch。

但它不是简单：

```text
Promise.all(tasks)
```

而是拆成：

```text
prepare
  -> run
  -> commit
```

### prepare

先确定这一批任务是否真的可以跑：

- 依赖是否满足
- 状态是否 pending
- owner 是否可执行
- 是否符合当前协调帧

### run

真正执行任务，可以串行，也可以并行。

### commit

统一把结果写回 `TaskSnapshot`。

这一步很关键。

因为并行执行最怕：

```text
多个 worker 同时改同一个 active plan
```

所以要把“执行”和“写回状态”分开。

这也是 `Runnable Batch 与准备/提交分离` 这个知识点的来源。

---

## 第八层：FollowUp 是自动推进协议

任务执行完之后，系统不能只展示结果。

它还要回答：

```text
下一步怎么办？
```

这就是 `followUp`。

当前支持四种动作：

```text
continue
retry
replan
manual
```

### continue

继续下一项任务。

### retry

当前任务可以重试，必要时换 owner。

### replan

当前任务不是简单重试能解决，需要修订计划。

### manual

自动推进不安全，停下来等人工判断。

`followUp` 主要由：

```text
TeamCoordinator.summarizeFrame(...)
```

生成。

runtime 再通过：

```text
driveFollowUp(...)
```

按 maxSteps 自动推进。

---

## 一轮完整流程

用一轮真实流程串起来。

### 第 1 轮：Orchestrator 找到可执行任务

```text
TaskOrchestrator
  -> 根据 snapshot 找 runnable task
```

它只负责状态，不负责团队策略。

### 第 2 轮：TeamCoordinator 生成协调帧

```text
buildCoordinationContext(...)
  -> TeamCoordinator.buildFrame(...)
  -> CoordinationFrame
```

这一步决定：

- 任务交给谁
- 是否可以 batch
- 是否要 review
- 有没有 escalation 风险

### 第 3 轮：Runtime 准备执行

```text
Runtime
  -> prepareTaskExecution(...)
  -> 找 executor
  -> 准备 prompt / context / owner
```

### 第 4 轮：角色 Agent 执行

```text
TaskExecutorRegistry
  -> owner
  -> executor.run(...)
```

如果 owner 是 main：

```text
MainTaskExecutor -> runtime.agent.run(...)
```

如果 owner 是 worker / explorer / verifier：

```text
RoleTaskExecutor -> 独立 AgentLoop.run(...)
```

### 第 5 轮：执行结果结构化

```text
TaskExecutionEvaluator
  -> completed / blocked / failed
```

这一步把自然语言结果变成任务系统能理解的结构化结果。

### 第 6 轮：ReviewPolicy 生成审查计划

```text
ReviewPolicy.plan(...)
  -> TaskReviewPlan
```

如果需要审查，runtime 会执行 review plan。

### 第 7 轮：TeamCoordinator 汇总执行与审查

```text
TeamCoordinator.summarizeFrame(...)
  -> digest
  -> followUp
  -> escalation
```

这一步是团队层收口。

### 第 8 轮：Runtime 写回状态并自动推进

```text
commitPreparedTaskExecution(...)
  -> TaskOrchestrator complete / block / fail
  -> TaskStore 保存
  -> applyFollowUpStep(...)
```

如果 followUp 是 continue，就继续下一项。

如果是 retry，就重试。

如果是 replan，就调用 replanner。

如果是 manual，就停下来。

---

## 为什么这不是“完全成熟的多 Agent”

当前已经完成的是：

```text
多角色执行器
独立 SessionState
review policy
runnable batch
followUp 自动推进
TeamCoordinator 主链收口
```

但还没有完成：

- agent 间显式 handoff 协议
- 每个 agent 的长期身份和能力画像
- worker 池和负载均衡
- 更成熟的并行策略
- review plan 的多 reviewer 并行/优先级策略
- tool call 级 checkpoint
- 持续在线后台任务队列
- 多 IDE / 多 workspace 的 runtime 实例路由

所以当前更准确的说法是：

```text
V5 TeamCoordinator 第一版完成
成熟多 Agent 协作还在后面继续演进
```

---

## 这一篇最该记住的几个点

### 1. TaskOrchestrator 和 TeamCoordinator 不一样

```text
TaskOrchestrator 管任务状态
TeamCoordinator 管团队策略
```

不要让它们互相抢职责。

### 2. 多 Agent 不是多个字符串标签

真正有意义的是：

```text
不同角色有独立 AgentLoop + SessionState
```

这样后面接 IDE、多工作空间、多实例时才站得住。

### 3. ReviewPolicy 只产出审查计划

它不执行 review。

执行由 runtime 负责。

汇总由 TeamCoordinator 负责。

### 4. Batch 要分 prepare / run / commit

并行执行不能让多个任务同时乱改状态。

所以要先准备，再执行，最后统一提交。

### 5. FollowUp 是动作协议

它不是展示文案，而是 runtime 可以执行的下一步动作：

```text
continue / retry / replan / manual
```

### 6. TeamCoordinator 的价值是统一收口

它让 assignment、review、batch、followUp、escalation 不再散落在 runtime 各处。

---

## 当前阶段已经完成什么

这一轮我们完成了：

- `TeamCoordinator.buildFrame(...)`
- `TeamCoordinator.summarizeFrame(...)`
- `CoordinationContext`
- `CoordinationFrame`
- `TaskExecutorRegistry`
- `MainTaskExecutor`
- `RoleTaskExecutor`
- `worker / explorer / verifier` 独立会话
- `ReviewPolicy`
- `TaskReviewPlan`
- `Runnable Batch`
- `followUp` 自动推进
- 旧 `TaskCoordinator` adapter 的安全退场

这些组合起来，说明团队协作层已经有第一版主链了。

---

## 后面还能继续补什么

后续可以继续往几个方向走：

### 1. V5 协调强化

- 更细的 retry 策略
- 更成熟的 escalation
- 更强的 review plan
- 团队态势摘要
- agent 负载和可用性判断

### 2. 显式协作协议

让 agent 之间不是只通过 task result 交接，而是有明确 handoff：

```text
worker -> verifier
explorer -> worker
verifier -> main
```

### 3. Execution Journal / Checkpoint

让系统不只是任务边界恢复，而是逐步支持轮内恢复。

### 4. 持续在线宿主

让 CLI、Gateway、IDE 都能接入同一个长期运行的 runtime 实例。

### 5. Agent 集群和服务解耦

更远期可以把 agent、工具、记忆、调度、审查、执行服务拆开，形成 agent 集群。

---

## 学习建议

这篇不要只背名词。

建议按这个顺序读代码：

```text
TeamCoordinator 接口
  -> CoordinationContext 输入
  -> CoordinationFrame 输出
  -> TaskExecutorRegistry 角色注册
  -> RoleTaskExecutor 独立会话
  -> ReviewPolicy 审查计划
  -> Runtime 如何执行 frame / review / followUp
```

读的时候一直问一个问题：

```text
这段代码是在管状态，还是在管团队策略？
```

如果是状态，多半应该归 `TaskOrchestrator`。

如果是团队策略，多半应该归 `TeamCoordinator / ReviewPolicy`。

这个判断会帮你避免把所有东西都塞回 runtime。

---

## 本篇结论

`05` 的核心不是“多 Agent 已经完全成熟”。

它的核心是：

```text
系统已经从单任务执行
推进到团队协作主链第一版
```

当前最小闭环是：

```text
TaskOrchestrator
  + TeamCoordinator
  + TaskExecutorRegistry
  + RoleTaskExecutor
  + ReviewPolicy
  + Runnable Batch
  + FollowUp
```

这就是多 Agent 协作真正开始成型的地方。
