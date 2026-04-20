# XML 报告解析：什么时候该引入成熟库

## 这个知识点解决什么问题

我们最开始用正则解析 JUnit XML。

范围很小时，这能工作。

但它很快暴露了一个真实问题：

```text
name="..."
误匹配到
classname="..."
```

这说明 XML 解析不是我们应该长期手写的领域逻辑。

## 我们项目里怎么做

引入：

```text
fast-xml-parser
```

用途：

```text
解析 reports/vitest/junit.xml
读取 testsuites / testsuite / testcase / failure / error
```

代码落点：

```text
scripts/write-ci-summary.mjs
package.json
package-lock.json
```

## 为什么选择成熟库

XML 解析属于通用工程能力。

它不是 Harness Agent 的核心领域逻辑。

我们的核心领域逻辑是：

```text
AgentLoop
Runtime
TaskOrchestrator
TeamCoordinator
Collaboration protocol
Memory / Learning
```

而 XML 解析更适合交给成熟库。

## 为什么没有引入更大的 CI report 框架

这轮只把 XML 解析交给库。

报告内容组织仍然在：

```text
scripts/write-ci-summary.mjs
```

原因是：

```text
JUnit XML 结构解析 -> 通用能力，交给 fast-xml-parser
Markdown Summary 口径 -> 项目定制，先自己控制
```

这样既减少 XML 坑，又不过早引入过重框架。

## 什么时候需要继续引入更成熟的 report 库

如果后面需求升级到：

```text
多 job 聚合
多测试框架报告合并
HTML 报告
趋势图
复杂 PR comment 模板
历史 coverage 数据库
```

那就应该重新评估专门的 CI report 库。

## 关键经验

第三方库边界可以这样判断：

```text
核心领域逻辑 -> 自己掌握
通用工程能力 -> 优先成熟库
项目表达口径 -> 保留项目内控制
```

这次 `fast-xml-parser` 的接入正好体现了这个边界。

