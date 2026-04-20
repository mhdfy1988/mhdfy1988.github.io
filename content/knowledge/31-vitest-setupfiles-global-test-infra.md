# Vitest setupFiles：测试全局能力入口

## 这个知识点解决什么问题

测试文件越来越多以后，一些能力不适合每个文件都重复注册。

比如：

```text
自定义 matcher
全局清理规则
统一 fake 初始化
测试环境扩展
```

如果每个测试文件都自己写：

```ts
expect.extend(...)
```

就容易出现：

```text
有些文件忘了注册
类型声明和运行时不一致
测试环境不统一
```

Vitest 的 `setupFiles` 就是用来解决这个问题的。

## 我们项目里怎么做

统一配置入口在：

```text
vitest.shared.ts
```

里面配置：

```ts
setupFiles: ["tests/setup/vitest.setup.ts"]
```

全局 setup 文件：

```text
tests/setup/vitest.setup.ts
```

它负责加载：

```text
tests/setup/custom-matchers.ts
```

类型声明则放在：

```text
tests/setup/vitest.d.ts
```

## 为什么要单独有 vitest.shared.ts

因为我们现在不止一个 Vitest 配置：

```text
vitest.config.ts
vitest.ci.config.ts
vitest.per-file.config.ts
```

这些配置都需要共享：

```text
node 环境
include 规则
setupFiles
coverage include / exclude
```

所以用：

```text
createVitestConfig(...)
```

把公共配置收起来，避免多个配置文件复制粘贴。

## 关键经验

`setupFiles` 不是装饰配置，而是测试工程的“统一入口”。

适合放：

```text
领域 matcher 注册
全局测试扩展
测试前置初始化
稳定的清理策略
```

不适合放：

```text
某个具体测试场景的数据
某个模块专用 fake
会影响测试隔离的共享状态
```

## 后续可复用规则

只要一个测试能力满足：

```text
大多数测试都需要
行为稳定
不依赖具体 case
```

就可以考虑放进 `setupFiles`。

