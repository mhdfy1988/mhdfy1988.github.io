# CI Summary：让机器报告变成人能读的报告

## 这个知识点解决什么问题

CI 默认产物通常是机器友好的：

```text
junit.xml
cobertura-coverage.xml
coverage-summary.json
```

这些适合工具读取，但人要看就很麻烦。

CI Summary 的目标是把这些机器报告整理成：

```text
人一眼能判断质量状态的 Markdown 报告
```

## 我们项目里怎么做

脚本：

```text
scripts/write-ci-summary.mjs
```

输入：

```text
reports/vitest/junit.xml
coverage/coverage-summary.json
可选 baseline coverage-summary.json
```

输出：

```text
GITHUB_STEP_SUMMARY
reports/vitest/summary.md
```

## Summary 包含什么

当前报告包含：

```text
Quick View
Test Result
Coverage
Coverage Thresholds
Coverage Diff
Lowest Branch Coverage
Failed Cases
Artifacts
```

其中最重要的是 Quick View：

```text
Tests
Coverage
Thresholds
Baseline diff
```

因为 PR 页面上第一眼最需要的是“是否健康”。

## 为什么还要生成 summary.md

Step Summary 只存在于 GitHub Actions 页面。

`summary.md` 是一个可复用产物：

```text
可以上传 artifact
可以发 PR comment
可以本地 dry run 查看
```

这让报告从“一次性页面内容”变成“可复用文件”。

## 关键经验

CI 的价值不只是自动跑命令。

更重要的是让团队快速知道：

```text
哪里失败了
覆盖率有没有掉
哪些文件最薄
报告在哪里
```

## 后续可复用规则

只要 CI 生成了机器报告，就应该考虑是否需要人类摘要。

尤其是：

```text
测试数量多
覆盖率维度多
PR review 依赖 CI 反馈
失败日志很长
```

这时 Summary 能明显减少排查成本。

