# Fixture / Test Builder：复杂对象怎么稳定构造

## 这个知识点解决什么问题

Agent 项目里的测试对象通常不是简单字符串，而是复杂结构：

```text
TaskPlan
TaskSnapshot
RuntimeBundle
CollaborationEnvelope
ReviewPlan
RunnableBatch
ExecutionRecord
```

如果每个测试都手搓完整对象，会出现：

```text
测试很长
重复很多
字段细节干扰测试意图
对象结构一改，很多测试都要跟着改
```

Fixture / Test Builder 的作用是把“怎么造数据”收口。

## 我们项目里怎么做

公共测试夹具集中在：

```text
tests/helpers/
```

典型文件：

```text
task-plan-fixtures.ts
task-state-fixtures.ts
runtime-fixtures.ts
collaboration-fixtures.ts
model-fixtures.ts
gateway-fixtures.ts
team-fixtures.ts
review-fixtures.ts
batch-fixtures.ts
time-fixtures.ts
```

它们分别解决：

```text
TaskPlan 怎么造
TaskState 怎么造
Runtime 怎么静默启动
协作消息怎么造
模型 fake 怎么造
gateway fake 怎么造
review / batch 对象怎么造
时间怎么控制
```

## fixture 和 matcher 的关系

可以这样理解：

```text
fixture 负责“怎么造”
matcher 负责“怎么看”
```

如果只抽 matcher，不抽 fixture，测试还是会被复杂对象构造拖住。

如果只抽 fixture，不抽 matcher，测试断言还是会停留在字段路径。

两者最好一起演进。

## 关键经验

fixture 不应该把测试意图藏起来。

好的 fixture 应该：

```text
提供合理默认值
允许局部覆盖
字段语义清楚
不会强制测试关心无关细节
```

坏的 fixture 会变成：

```text
巨大黑盒
魔法默认值太多
测试读者不知道对象真实长什么样
```

## 后续可复用规则

当一个对象在 3 个以上测试里重复手搓，且字段较多时，就应该考虑抽 fixture。

但抽的时候要保留覆盖入口，例如：

```text
createTaskPlan({ tasks: [...] })
createReviewPlan({ reviewers: [...] })
```

不要只给一个完全固定的数据。

