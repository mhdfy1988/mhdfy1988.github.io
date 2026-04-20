# Fake Timer：如何测试异步时间链

## 这个知识点解决什么问题

很多代码会依赖时间：

```text
Date.now()
new Date()
setTimeout
重试等待
轮询
并发延迟
```

如果测试真的等待时间，会导致：

```text
测试慢
测试不稳定
边界场景难构造
```

Fake Timer 的目标是让测试控制时间。

## 我们项目里怎么做

时间夹具在：

```text
tests/helpers/time-fixtures.ts
```

核心能力：

```text
createManualClock
withFakeTime
withFakeTimeUntilSettled
advanceToNextTimer
runPending
runAll
tickAndFlush
timerCount
```

自测在：

```text
tests/setup/time-fixtures.test.ts
```

真实落地在：

```text
tests/runtime/runtime-bundle.test.ts
```

## 最关键的坑

fake timer 不只是“把时间拨快”。

真实异步链可能是：

```text
action()
  -> microtask
  -> setTimeout
  -> microtask
  -> 下一轮 setTimeout
```

如果只执行：

```text
runPending()
```

可能只跑了当前已有 timer，后续 microtask 里新挂的 timer 没有继续执行。

所以我们抽了：

```text
withFakeTimeUntilSettled(...)
```

它会持续推进：

```text
timer + microtask
```

直到外层 Promise 真正 settled。

## 三类时间工具怎么选

### 手动时钟

适合：

```text
状态机
orchestrator
快照时间
可注入 now() 的模块
```

### fake timer

适合：

```text
Date.now()
new Date()
setTimeout
setInterval
真实异步延迟
```

### until settled 驱动器

适合：

```text
并发模型延迟
轮询链
retry delay
异步任务内部会继续挂 timer 的场景
```

## 关键经验

时间夹具的真正价值不是冻结时间，而是稳定驱动调度。

后续只要新增：

```text
scheduler
retry delay
polling
timeout
```

优先考虑接 `withFakeTimeUntilSettled(...)`，不要先写真实等待。

