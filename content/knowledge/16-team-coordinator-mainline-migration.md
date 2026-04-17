# 16 - TeamCoordinator 主链迁移

## 先说结论

`TeamCoordinator` 这个知识点的重点，不是“又加了一个协调器接口”，而是：

```text
它如何从旁路能力
一步步变成 runtime 真正依赖的主链
```

源码落点：

- `../../src/team/team-coordinator.ts`
- `../../src/team/default-team-coordinator.ts`
- `../../src/team/coordination-context.ts`
- `../../src/team/coordination-frame.ts`
- `../../src/runtime/runtime-bundle.ts`

## 为什么这件事重要

如果一个系统里：

- 执行前靠新协调器
- 执行后还靠旧协调器
- review 有自己一套判断
- runtime 里又散落一套 fallback

最后就会变成：

```text
功能是有的
但团队层到底谁说了算不清楚
```

所以 `TeamCoordinator` 真正要解决的问题不是“分任务”，而是：

```text
让团队层有一个统一主脑
```

## 迁移前是什么状态

最早的过渡形态通常是：

```text
TaskCoordinator
  -> coordinate(task)
  -> summarize(task result)
```

这是典型的：

```text
单任务视角
```

它能回答：

- 这一项交给谁
- 这一项之后建议干什么

但它回答不了：

- 当前一整轮团队态势是什么
- 哪些任务能 batch
- 哪些 review 应该优先收口
- 哪些结果应该 escalate

## TeamCoordinator 带来了什么变化

`TeamCoordinator` 的视角不再是单任务，而是：

```text
整轮团队
```

它分成两个入口：

### buildFrame(context)

负责执行前协调：

- assignments
- runnableBatch
- reviews
- escalations

### summarizeFrame(context, result)

负责执行后协调：

- followUps
- digest
- nextRecommendedAction
- escalations

这意味着 runtime 的逻辑可以收成一条更稳定的主线：

```text
先 buildFrame
再执行
再 summarizeFrame
```

## 这个迁移不是一次完成的

这里最值钱的经验是：

**主导权迁移不能硬切。**

这轮真实走过的路径可以记成：

### 第 1 步

先让 `TeamCoordinator.buildFrame(...)` 进入执行前主链。

也就是：

- assignment 先由 frame 决定
- batch 先由 frame 决定

### 第 2 步

再让 `TeamCoordinator.summarizeFrame(...)` 进入执行后主链。

也就是：

- followUp
- digest
- escalation

开始由团队层统一输出。

### 第 3 步

旧协调器先退成 fallback，不马上删。

### 第 4 步

等 runtime 已经默认只走新链路，再把旧 adapter 删掉。

## 为什么要这样做

因为这类迁移最怕的是：

```text
今天一口气改完
明天发现能跑但行为变了
后天已经说不清到底哪一层在决定结果
```

渐进迁移的好处是：

- 每一步都能写测试
- 每一步都能观察主导权是不是已经迁过去
- 每一步都能知道旧链路还剩多少

所以这里真正学到的是：

```text
不是“先写新类”
而是“先迁主导权”
```

## 当前主链长什么样

现在 runtime 对团队层的理解已经很清楚了：

```text
buildCoordinationContext(...)
-> TeamCoordinator.buildFrame(...)
-> Runtime 执行当前任务 / batch / review
-> TeamCoordinator.summarizeFrame(...)
-> CoordinationSummary
-> TaskExecutionRecord / CLI / history
```

这和原来最大的区别在于：

```text
现在是 frame 驱动 runtime
而不是 runtime 顺手调一下 coordinator
```

## 常见误解

### 误解一：TeamCoordinator 只是更复杂的 TaskCoordinator

不对。

`TaskCoordinator` 是单任务视角，`TeamCoordinator` 是整轮团队视角。

### 误解二：只要有多角色执行器，就已经是成熟多 Agent

不对。

多角色执行器只是执行层，真正让团队站稳的是：

- coordinator
- review policy
- batch
- followUp / escalation

### 误解三：主链迁移就是把旧类删掉

不对。

删旧类只是最后一步，前面更重要的是：

- 谁开始主导结果
- 谁开始主导失败语义
- 谁开始主导后续动作

## 值得记住

```text
TeamCoordinator 的价值，不是多一个接口，
而是把“团队由谁统一收口”这件事真正定下来。
```

