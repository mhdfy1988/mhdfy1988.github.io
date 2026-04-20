# PR Comment：把测试反馈前移到代码评审页面

## 这个知识点解决什么问题

CI 结果如果只在 Actions 页面里，review 代码的人需要来回切页面。

PR comment 的作用是把测试反馈直接放到代码评审上下文里。

也就是：

```text
评审代码时，顺手看到测试状态和覆盖率变化。
```

## 我们项目里怎么做

工作流文件：

```text
.github/workflows/ci.yml
```

生成报告：

```text
reports/vitest/summary.md
```

PR comment 使用：

```text
actions/github-script@v7
```

固定 marker：

```text
<!-- harness-agent-lab-vitest-summary -->
```

## 为什么要用 marker

如果每次 CI 都创建一条新评论，PR 会被刷屏。

marker 的作用是识别旧评论：

```text
有旧评论 -> update
没有旧评论 -> create
```

这样一个 PR 始终只有一条测试报告评论。

## 权限边界

自动评论只对同仓库 PR 开启：

```text
github.event_name == 'pull_request'
github.event.pull_request.head.repo.full_name == github.repository
```

原因是 fork PR 的 token 写权限不稳定。

fork PR 仍然可以看：

```text
Step Summary
artifact
```

只是不会强行评论。

## 好的 PR comment 应该展示什么

不应该一上来塞完整日志。

更适合的顺序是：

```text
Quick View
失败 case
Coverage diff
低覆盖文件
artifact 链接或路径
```

我们现在采用的就是这个方向。

## 关键经验

PR comment 不是为了“炫酷”，而是为了减少上下文切换。

好的 PR comment 应该：

```text
短
可扫读
可更新
不刷屏
不泄露敏感信息
对 fork 权限有保护
```

