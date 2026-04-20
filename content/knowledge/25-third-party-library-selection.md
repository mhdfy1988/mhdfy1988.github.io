# 第三方库选型与接入边界

## 它是什么

第三方库选型不是简单地问“这个功能能不能自己写”，而是判断：

```text
这个能力是不是项目核心？
如果不是，成熟库是否能更可靠地承担它？
如果使用成熟库，如何不让它污染核心架构？
```

在学习型项目里，容易走向两个极端：

- 什么都自己写，以为这样才算学习。
- 什么都用框架，以为这样才算工程化。

更好的方式是：

```text
核心领域逻辑自己掌握
通用工程能力学习并使用成熟方案
两者通过适配层隔离
```

## 它解决什么问题

当前 `harness-agent-lab` 早期依赖很少，这帮助我们看清了 Agent 架构主线。

但随着功能变多，继续手写所有通用能力会带来问题：

- 配置校验越写越散。
- 协作协议 payload 缺少运行时保障。
- 文件快照读取后直接类型断言，脏数据风险高。
- HTTP Gateway 如果手写，会偏离 Agent 主线。
- MCP 如果手写协议细节，容易和官方实现不一致。
- 测试规模变大后，原生测试组织成本会上升。

所以第三方库选型解决的是：

```text
把精力从通用基础设施转回核心 Agent 架构
同时学习成熟工程方案的设计取舍
```

## 在当前仓库哪里出现

### 已经使用成熟库的地方

`src/entry/cli.ts` 使用 `commander` 做 CLI 命令解析。

这说明项目已经接受了一个原则：

```text
CLI 参数解析是通用能力，可以交给成熟库。
```

### 还在手写的地方

配置校验：

- `src/config/config-loader.ts`
- 当前有 `validateSettings`、`parseEnum`、`parseBoolean`、`parsePositiveInteger`。

计划校验：

- `src/planning/plan-validator.ts`
- 当前手写 `validateTaskPlan`。

模型输出结构化解析：

- `src/orchestration/task-execution-evaluator.ts`
- 当前手写 `JSON.parse` 后字段判断。

文件状态读取：

- `src/task-state/file-task-store.ts`
- `src/team/file-collaboration-log.ts`
- 当前读取 JSON 后直接断言类型。

MCP 占位：

- `src/mcp/mcp-client-manager.ts`
- 当前还只是 mock 连接状态。

Web Gateway 占位：

- `src/gateway/web-gateway.ts`
- 当前还没有真实 HTTP 服务。

## 为什么值得记住

这个知识点影响后续所有架构决策。

如果没有这个判断标准，我们后面会反复摇摆：

- 一会儿觉得“自己写才理解得深”。
- 一会儿觉得“成熟项目都用了库，我们也应该全用”。

真正稳定的判断是：

```text
看它是不是核心领域逻辑。
```

核心领域逻辑包括：

- AgentLoop 如何执行。
- Runtime 如何装配。
- TaskPlan 和 TaskSnapshot 如何演进。
- TaskOrchestrator 如何推进任务。
- TeamCoordinator 如何协调多 Agent。
- CollaborationProtocol 如何表达协作消息。

这些应该自己理解并控制。

通用工程能力包括：

- CLI 参数解析。
- 配置和协议校验。
- HTTP 服务。
- MCP SDK 接入。
- 日志。
- 测试框架。
- 构建打包。

这些应该优先评估成熟库。

## 常见误解

### 误解 1：依赖少就是工程好

不一定。

依赖少可能意味着架构简单，也可能意味着大量通用能力被手写，后续维护成本更高。

### 误解 2：用了库就学不到原理

不一定。

学习成熟库也可以学到：

- 它如何设计 API。
- 它如何处理边界情况。
- 它如何表达类型。
- 它如何组织错误。
- 它如何和生态集成。

### 误解 3：引入库就要到处直接使用库 API

不应该。

第三方库应该通过适配层进入系统。

例如：

```text
核心模块依赖 LoggerPort
LoggerPort 的一个实现使用 tslog
```

而不是让所有核心模块直接 import `tslog`。

### 误解 4：Zod 可以替代所有业务校验

不能。

Zod 适合校验结构：

- 字段是否存在。
- 类型是否正确。
- 枚举是否合法。

但业务规则仍应该放在业务层：

- 任务不能依赖自己。
- 依赖任务必须存在。
- 状态是否允许从 A 变到 B。
- 连续失败几次后升级人工介入。

## 当前项目的选型建议

第一优先级：

```text
zod
```

原因：

- 当前最多手写问题集中在运行时校验。
- 配置、计划、快照、协作协议都需要 schema。
- 它不会改动 Agent 核心主线。

第二优先级：

```text
@modelcontextprotocol/sdk
```

原因：

- MCP 是外部标准协议。
- 后续真实连接时不应该手搓协议细节。

第三优先级：

```text
hono
```

原因：

- Web Gateway 是通用 HTTP 服务问题。
- 不应该自己写路由和请求处理基础设施。

第四优先级：

```text
vitest
```

原因：

- 测试规模继续增长后，原生 `node --test` 会不够顺手。

## 后续还能展开什么

这个知识点可以继续拆成：

- TypeScript interface 和运行时 schema 的区别。
- Zod schema 如何和领域模型协作。
- 适配器模式如何隔离第三方库。
- 为什么外部协议优先使用官方 SDK。
- 测试框架迁移的时机判断。

对应文档：

- `docs/dependency-strategy.md`
- `docs/third-party-library-audit.md`
- `docs/third-party-migration-roadmap.md`
- `docs/integrations/zod-validation-design.md`

