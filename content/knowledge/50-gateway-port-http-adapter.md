# GatewayPort 与 HTTP Adapter 边界

## 这个知识点解决什么

当项目只有 CLI 时，外部输入很简单：

```text
用户命令
  ↓
cli.ts
  ↓
Runtime public methods
```

但一旦要接 Web、桌面客户端、VSCode 插件或外部系统，就不能让这些入口各自重写一遍 Agent 流程。

所以这一刀引入了 `GatewayPort`。

它的核心目标是：

```text
不同入口只负责接收请求
真正的 Agent 流程仍然只走 Runtime
```

## 为什么不让 Hono 直接调用 AgentLoop

Hono 是 HTTP 框架，职责是：

- 路由
- 请求体读取
- 响应输出
- server 生命周期

它不应该知道：

- AgentLoop 怎么构建上下文
- TaskPlan 怎么生成
- TaskSnapshot 怎么推进
- TeamCoordinator 怎么协调
- FollowUp 怎么自动推进

如果让 Hono route 直接拼这些流程，后续 CLI、桌面端、HTTP 端就会出现三套重复逻辑。

正确边界是：

```text
Hono Route
  ↓
GatewayPort
  ↓
RuntimeBundle
  ↓
AgentLoop / Planner / Orchestrator / TeamCoordinator
```

## 当前代码落点

核心文件：

```text
src/gateway/gateway-port.ts
src/gateway/runtime-gateway-port.ts
src/gateway/hono-web-app.ts
src/gateway/web-gateway.ts
```

职责拆分：

| 文件 | 职责 |
| --- | --- |
| `gateway-port.ts` | 定义 HTTP/Gateway 可调用的应用入口契约 |
| `runtime-gateway-port.ts` | 把 `GatewayPort` 映射到现有 Runtime 方法 |
| `hono-web-app.ts` | 定义 Hono 路由和 HTTP 响应格式 |
| `web-gateway.ts` | 管理 Hono server 的 start / stop / dispose |

## GatewayPort 负责什么

当前第一版接口：

```ts
interface GatewayPort {
  health(): Promise<GatewayHealthResult>;
  chat(input: GatewayChatInput): Promise<AgentResult>;
  executePlan(input: GatewayExecutePlanInput): Promise<GatewayExecutePlanResult>;
}
```

这里的重点不是“多包一层”，而是把入口能力变成稳定契约。

后续 Web、桌面、消息平台都可以围绕这个契约调用 Runtime。

## RuntimeGatewayPort 做了什么

`RuntimeGatewayPort` 是真正连接 Runtime 的适配器：

```text
chat(input)
  ↓
runtime.agent.run(input.text)

executePlan(input)
  ↓
runtime.planAndInitialize(input.goal)
  ↓
runtime.startNextAndExecute()
  ↓
可选 runtime.driveFollowUp(...)
```

这意味着 HTTP 入口没有重新发明：

- planning
- orchestration
- task execution
- followUp

它只是调用 Runtime 已经存在的用例方法。

## Hono 负责什么

当前 Hono app 只暴露三条最小路由：

```text
GET  /health
POST /chat
POST /execute-plan
```

其中：

- `/health` 用于确认服务活着，并返回 runtime/gateway 状态。
- `/chat` 用于一次普通聊天输入。
- `/execute-plan` 用于从 HTTP 入口触发计划生成和第一项任务执行。

## 为什么请求体仍然要用 Zod

HTTP 请求体是不可信输入。

即使 TypeScript 里写了 interface，也只能保护编译期代码，保护不了运行时 JSON。

所以当前 Hono route 会先用 schema 校验：

```text
HonoGatewayChatRequestSchema
HonoGatewayExecutePlanRequestSchema
```

再交给 `GatewayPort`。

这保持了我们前面形成的规则：

```text
外部输入先进 schema
内部流程再走领域接口
```

## 它和 Adapter 模式的关系

这一刀同时用了两层适配：

```text
WebGatewayAdapter
  = Hono server 生命周期适配器

RuntimeGatewayPort
  = Gateway 契约到 Runtime 用例的适配器
```

前者解决“怎么启动 HTTP 服务”。

后者解决“HTTP 请求应该调用哪个 Runtime 方法”。

这两个不要混在一起。

## 当前还没做什么

第一版暂时没有做：

- 鉴权
- 流式响应
- 多会话隔离
- CORS 策略
- 文件上传
- SSE/WebSocket
- 更完整的计划管理 API

这些后续可以继续扩展，但第一版先把边界站住。

## 学习时应该看哪条链路

建议按这条顺序读代码：

```text
src/entry/service.ts
  ↓
src/runtime/runtime-bundle.ts
  ↓
src/gateway/gateway-manager.ts
  ↓
src/gateway/web-gateway.ts
  ↓
src/gateway/hono-web-app.ts
  ↓
src/gateway/runtime-gateway-port.ts
```

读的时候抓住一句话：

```text
HTTP Gateway 是入口适配器，不是新的 Agent 主流程。
```
