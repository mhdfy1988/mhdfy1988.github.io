# 18 - Legacy Adapter 的安全退场

## 先说结论

删除旧 adapter 最危险的做法，不是“删得太快”，而是：

```text
还没搞清 runtime 真正依赖什么
就把整套旧接口一起拔掉
```

更稳的做法是：

```text
先提最小公共类型
再删旧接口
```

源码落点：

- `../../src/team/coordination-summary.ts`
- `../../src/runtime/runtime-bundle.ts`
- `../../src/team/index.ts`

## 这轮的真实问题是什么

当我们决定删除：

- `TaskCoordinator`
- `DefaultTaskCoordinator`

时，问题并不是“删不删文件”，而是：

```text
runtime 里还有没有东西在借用旧接口里的类型语义
```

答案是：有。

runtime 执行后还需要一份结构化协调结果，用来：

- 写回 `TaskExecutionRecord`
- 驱动 `followUp`
- CLI / history / archive 展示

如果把旧接口连同这些结构一起硬删，就会把 runtime 也一起带坏。

## 所以我们先做了什么

我们先没有删文件，而是先问了一个更准确的问题：

```text
旧接口里到底哪一小块还真正有用？
```

最后抽出来的是：

```ts
CoordinationSummary
```

它只保留 runtime 真正还需要的东西：

- `followUp`
- `escalation`
- `digestSummary`
- `nextRecommendedAction`
- `note`

这个动作的价值非常大，因为它把：

```text
“旧协调器接口”
```

和

```text
“runtime 仍然需要的协调结果结构”
```

这两件事彻底拆开了。

## 为什么这是安全删除的关键

因为 adapter 最麻烦的地方就在于：

它表面上像“兼容层”，但内部经常混着两类东西：

### 1. 真正过时的调用约定

比如：

- `coordinate(task)`
- `summarize(taskResult)`

这些属于旧接口语义。

### 2. 仍然有价值的数据结构

比如：

- followUp
- escalation
- digest
- note

这些不属于“旧逻辑”，只是刚好之前挂在旧接口里。

如果不先拆开，删除时就很容易误删真正有用的结构。

## 安全退场的步骤

这轮其实走的是一条很典型的退场路径：

### 第 1 步：先让新主链站稳

先确保 runtime 已经真正只靠 `TeamCoordinator` 工作。

### 第 2 步：排查旧 adapter 还剩什么作用

不是只看“这个类有没有 import”，而是看：

```text
它的类型、测试、导出、文档还有没有被当成主链的一部分
```

### 第 3 步：先抽最小公共类型

把 runtime 还真正需要的结果结构单独抽出来。

### 第 4 步：成组删除

一起删掉：

- 文件
- 导出
- 测试
- 文档口径

而不是只删源码。

## 为什么一定要“成组删除”

因为 legacy adapter 最怕出现这种状态：

```text
文件已经删了
但导出还在
测试还在
文档还把它写成当前实现
```

这样比不删还乱。

所以“成组删除”至少要覆盖：

- 实现文件
- index 导出
- 相关测试
- 相关文档
- 相关图示

这轮就是按这个方式完成的。

## 这个知识点和 Adapter Pattern 的区别

`14-adapter-pattern.md` 讲的是：

```text
适配器为什么存在
```

而这个知识点讲的是：

```text
适配器什么时候该退场
以及怎么退场才安全
```

也就是说，一个讲“怎么引入适配器”，一个讲“怎么移除过期适配器”。

## 常见误解

### 误解一：旧 adapter 没在 runtime 主链里，就可以直接删

不一定。

它可能还挂着：

- 类型
- 导出
- 测试
- 文档口径

### 误解二：删掉旧类就是完成迁移

不对。

真正的迁移完成标志是：

```text
新主链已经完整承接语义
旧接口不再承载任何必需结构
```

### 误解三：抽新类型是在“留恋旧接口”

不对。

抽新类型恰恰是为了：

```text
把真正还有价值的结构
从旧接口里救出来
```

## 值得记住

```text
删除旧 adapter 前，先提最小公共类型，
这是让迁移既干净又稳的关键一步。
```
