# 测试框架迁移策略：并行迁移而不是一刀切

## 这个知识点解决什么问题

当一个项目已经有一批测试时，迁移测试框架本身也是高风险改动。

如果一上来就把旧测试入口删掉、把所有测试一次性改成新框架，最容易出现两个问题：

```text
1. 测试框架迁移失败
2. 原本业务测试的保护网也被拆掉
```

所以我们这次从 `node:test` 迁移到 `Vitest` 时，采用的是并行迁移策略。

## 我们项目里怎么做

早期旧链路是：

```text
npm.cmd test
  -> npm.cmd run build
  -> node --test tests/**/*.test.mjs
  -> 测 dist 产物
```

Vitest 迁移后主链路变成：

```text
npm.cmd test
  -> npm.cmd run typecheck
  -> vitest run
  -> 直测 tests/**/*.test.ts
```

中间不是一步切换，而是：

```text
第 1 步：保留 node:test，新增 Vitest 示例
第 2 步：分批把 .test.mjs 改成 .test.ts
第 3 步：每批迁移后验证测试数量和语义没有丢
第 4 步：最后把默认 npm.cmd test 切到 Vitest
第 5 步：旧 .mjs 链路清空
```

## 代码落点

```text
package.json
vitest.config.ts
vitest.shared.ts
tsconfig.test.json
tests/**/*.test.ts
docs/integrations/vitest-testing-design.md
```

## 关键经验

测试框架迁移不是普通重构。

普通重构依赖测试保护；测试框架迁移是在改保护网本身。

所以原则是：

```text
旧链路先保留
新链路先并行
分批迁移
每批验证
最后切入口
```

## 不要怎么做

不建议这样：

```text
一次性删除旧测试
一次性重写所有测试
一次性切默认入口
迁移中不跑全量验证
```

这样做一旦失败，很难判断是：

```text
测试框架配置错了
测试语义迁移丢了
业务代码本来就坏了
```

## 后续可复用规则

以后迁移任何基础设施型工具时，都可以套这个思路：

```text
先并行，后替换
先证明新链路能跑，再清理旧链路
```

