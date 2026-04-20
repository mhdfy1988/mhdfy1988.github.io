# 参数化测试：把规则写成测试矩阵

## 这个知识点解决什么问题

有些测试不是独立故事，而是同一条规则的多种输入。

比如：

```text
不同任务类型 -> 不同 reviewer
不同 followUp 来源 -> 不同动作
不同 review verdict -> 不同协调结果
不同 batch mode -> 不同执行方式
```

如果每个 case 都单独写一个完整测试，会很冗长。

参数化测试的价值是把它们整理成：

```text
输入条件 -> 预期输出
```

也就是规则表。

## 我们项目里怎么做

使用 Vitest 的：

```ts
test.each(...)
describe.each(...)
```

典型测试：

```text
tests/team/default-task-review-policy.test.ts
tests/team/coordination-rules.test.ts
tests/team/team-coordinator.test.ts
tests/runtime/runtime-bundle.test.ts
```

覆盖过的规则矩阵：

```text
review policy 矩阵
coordination rules 矩阵
followUp / escalation 矩阵
runtime batch 执行矩阵
runtime review 执行矩阵
```

## 为什么它适合 Agent 协调系统

Agent 协调系统有很多状态和策略组合：

```text
任务类型
owner
review 结果
blocker
retry
replan
manual escalation
batch mode
```

这些天然就是规则表。

参数化测试能让我们清楚看到：

```text
条件是什么
预期是什么
规则优先级是什么
```

## 关键经验

参数化测试不是为了少写代码，而是为了让规则更清楚。

如果一个测试读起来像：

```text
场景 A
场景 B
场景 C
场景 D
```

并且这些场景共享同一个入口，就适合改成 `test.each`。

## 不适合参数化的场景

不建议把所有测试都参数化。

不适合：

```text
每个 case setup 差异很大
每个 case 断言结构完全不同
测试失败时不容易看出语义
```

## 后续可复用规则

看到“同一入口 + 多组输入输出”时，优先考虑参数化测试。

看到“多步骤故事 + 每步都不同”时，保留普通测试更清楚。

