# Coverage Threshold：覆盖率如何变成质量约束

## 这个知识点解决什么问题

coverage report 只能告诉我们：

```text
当前覆盖率是多少
哪些文件覆盖薄
哪些行没跑到
```

但它不会阻止质量下降。

coverage threshold 的作用是把覆盖率从“观察指标”变成“质量门槛”。

## 我们项目里怎么做

配置文件：

```text
vitest.config.ts
vitest.per-file.config.ts
vitest.ci.config.ts
vitest.coverage-thresholds.ts
```

报告产物：

```text
coverage/coverage-summary.json
coverage/cobertura-coverage.xml
```

当前总体覆盖率：

```text
Statements: 95.04%
Branches:   87.86%
Functions:  95.96%
Lines:      94.95%
```

## coverage report 和 threshold 的区别

```text
coverage report
  -> 让人看到当前质量

coverage threshold
  -> 让 CI 阻止明显退化
```

两者都需要。

只有 report，没有约束，覆盖率可能慢慢掉。

只有 threshold，没有报告，人不知道下一步该补哪里。

## 为什么不用追 100%

100% 覆盖率不一定是最好目标。

硬追 100% 可能导致：

```text
为了覆盖而覆盖
测试绑定实现细节
重构成本变高
测试变脆
```

更合理的目标是：

```text
关键路径高覆盖
核心状态机有保护
协议和快照边界有测试
低风险展示逻辑不硬追
```

## 我们项目里的策略

采用多层阈值：

```text
全局阈值
per-file 阈值
关键模块 scoped 阈值
CI summary 中展示 threshold delta
```

这样既有底线，也不过度卡死每个小文件。

## 后续可复用规则

覆盖率不是目标本身。

真正目标是：

```text
重要行为被保护
风险分支被覆盖
后续重构敢动
CI 能阻止明显退化
```

