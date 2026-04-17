# 17 - 契约优先的 Runtime 协调

## 先说结论

一旦系统进入：

- 多角色执行
- review
- batch
- followUp
- escalation

这种阶段，runtime 就不能再靠“旧逻辑偷偷兜底”维持表面可运行。

更稳的做法是：

```text
把缺失能力变成显式契约
```

源码落点：

- `../../src/runtime/runtime-bundle.ts`
- `../../src/team/team-coordinator.ts`
- `../../src/team/coordination-summary.ts`

## 什么叫契约优先

简单说就是：

```text
必须给的结果，就明确要求给
不给，就显式失败或保守停下
```

当前这条线最典型的两个契约就是：

### 契约 1：当前任务必须有 assignment

如果 `buildFrame(context)` 没给当前任务 assignment，
runtime 现在直接报明确错误。

因为这意味着：

```text
团队层还没有决定这项任务到底该由谁执行
```

这时候如果偷偷 fallback 到旧逻辑，系统虽然“还能跑”，但主导权就又乱了。

### 契约 2：当前任务最好有 followUp

如果 `summarizeFrame(...)` 没给当前任务 `followUp`，
runtime 现在保守降级成：

```text
manual
```

也就是：

```text
先停下来，等人工确认
```

它不再偷偷回退旧 summarize。

## 为什么这比 fallback 更稳

因为 fallback 最容易制造一种假象：

```text
系统看起来一直能跑
但其实已经不知道是谁在决定下一步
```

具体来说，fallback 会带来三个问题：

### 1. 主导权不清楚

你以为现在已经是 `TeamCoordinator` 主导，
结果一缺字段，系统又偷偷回到了旧逻辑。

### 2. 测试口径会漂

因为一部分路径走新逻辑，一部分路径走旧逻辑，
最后很难说：

```text
这条测试测的是谁
```

### 3. 后面删旧链很痛苦

因为你根本不知道旧链路是不是还在被某些边角路径依赖。

## 为什么 assignment 和 followUp 处理方式不一样

这个区别也很值得记住。

### assignment 缺失 -> 直接报错

因为 assignment 是执行前硬前提。

没有 owner，runtime 根本不知道该把任务交给谁。

所以这里应该：

```text
显式失败
```

### followUp 缺失 -> 保守 manual

因为 followUp 是执行后决策。

这时候任务已经跑完了，缺的不是“能不能执行”，而是“下一步该不该自动推进”。

所以更稳的选择是：

```text
不要乱推
先保守停下
```

这说明契约优先不是“全都报错”，而是：

```text
按阶段语义选择最合适的失败方式
```

## 这条知识点解决什么问题

它解决的是一个很常见但很隐蔽的问题：

```text
多 Agent 系统越复杂
越不能靠“差不多也能跑”活着
```

因为这种系统一旦有：

- batch
- review
- retry
- replan
- archive / restore

很多后续动作都是自动连着走的。

这时候如果契约不清楚，错误会被一路带着放大。

## 常见误解

### 误解一：有 fallback 才更鲁棒

不一定。

在架构迁移阶段，过多 fallback 反而会让系统更不鲁棒，
因为你不知道到底哪条链在主导。

### 误解二：契约优先就是严格到不好用

不对。

契约优先的目标不是苛刻，而是：

```text
让系统在不完整时明确暴露问题
```

### 误解三：只要能跑，主导权乱一点没关系

不对。

一旦进入多角色和自动 followUp，主导权混乱会直接影响后续自动动作。

## 值得记住

```text
多 Agent runtime 一旦进入主链阶段，
宁可显式失败，也不要靠隐式 fallback 假装一切正常。
```

