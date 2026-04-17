# 21 - Review 策略与审查链

## 先说结论

`ReviewPolicy` 只负责回答一个问题：

```text
这轮任务执行之后，要不要审查？
如果要审查，谁来审，按什么顺序审？
```

它不执行审查。

源码落点：

- `../../src/team/task-review-policy.ts`
- `../../src/team/default-task-review-policy.ts`
- `../../src/runtime/runtime-bundle.ts`
- `../../src/team/coordination-rules.ts`
- `../../src/task-state/task-snapshot.ts`

## 为什么要把 review 单独抽出来

如果 review 逻辑直接写在 runtime 主流程里，runtime 很快会变成：

```text
执行任务
判断结果
判断是否 review
判断 reviewer
执行 reviewer
汇总 reviewer
判断是否 retry
判断是否 replan
写回状态
```

这样 runtime 会越来越重。

所以当前项目把“审查策略”拆成独立接口：

```ts
interface TaskReviewPolicy {
  plan(input: TaskReviewPlanningInput): Promise<TaskReviewPlan>;
}
```

它只产出 `TaskReviewPlan`。

## 当前默认策略是什么

默认策略在 `DefaultTaskReviewPolicy` 里。

第一版规则非常保守：

```text
worker 完成 implementation
-> 至少触发 verifier review
```

如果任务优先级是 `high`：

```text
worker 完成 high implementation
-> verifier review
-> main review
```

也就是高优先级实现任务会形成最小串行审查链。

## 为什么默认是 sequential

`TaskReviewPlan` 支持：

```text
sequential
parallel
```

但默认策略先返回：

```text
executionMode: "sequential"
```

原因是 review 链里经常有顺序依赖：

```text
verifier 先检查约束
main 再做整体汇总确认
```

第一版先保守串行，比一上来并行更容易解释和测试。

## Runtime 如何执行 review

runtime 的流程是：

```text
runPreparedTask(...)
  -> executor.run(...)
  -> evaluateTaskExecutionReply(...)
  -> reviewPolicy.plan(...)
  -> executeReviewPlan(...)
  -> resolveReviewFinalEvaluation(...)
  -> summarizeTaskExecutionWithTeamCoordinator(...)
  -> commitPreparedTaskExecution(...)
```

这说明：

```text
ReviewPolicy 只产出计划
Runtime 负责执行计划
TeamCoordinator 负责把执行和审查结果汇总成后续动作
```

## 审查结果如何影响任务状态

runtime 会调用：

```text
resolveReviewFinalEvaluation(...)
```

它会从执行结果和审查结果里选出更严重的状态。

当前严重程度可以理解成：

```text
completed < blocked < failed
```

所以：

- worker 说完成
- verifier 说 blocked 或 failed

最后任务不会被当成 completed 写回。

## 审查记录保存在哪里

最终写回 `TaskExecutionRecord`：

```text
lastExecution.reviews[]
```

每条 review 记录包含：

- `reviewerOwner`
- `reviewerLabel`
- `reviewerSessionId`
- `status`
- `summary`
- `reason`
- `source`
- `nextHint`
- `evaluatedAt`

这让 `status / history / archive` 不是只能看到“最终失败”，还能看到是谁审查、为什么没通过。

## 常见误解

### 误解一：review 是 verifier 的固定行为

不对。

verifier 只是当前默认策略里的一个 reviewer。

后续可以扩展成：

- main review
- security review
- style review
- test review

### 误解二：ReviewPolicy 应该直接执行 Agent

不对。

策略只负责“计划审查”，执行审查仍由 runtime 找执行器完成。

### 误解三：执行结果 completed 就一定完成

不一定。

如果 review 不通过，最终评估会被提升为更严重状态。

## 值得记住

```text
ReviewPolicy 是“审查计划器”，不是“审查执行器”。
它把审查规则从 runtime 主链里拆出来，让团队协作更容易扩展。
```

