# 14 - Adapter 适配器模式

## 先说结论

适配器模式（Adapter Pattern）把不同外部协议转换成系统内部统一接口。

当前项目里最明显的适配器方向是：

```text
gateway/
model/
mcp/
```

源码落点：

- `../../src/gateway/gateway-adapter.ts`
- `../../src/gateway/web-gateway.ts`
- `../../src/gateway/desktop-gateway.ts`
- `../../src/gateway/messaging-gateway.ts`
- `../../src/model/model-client.ts`
- `../../src/mcp/mcp-client-manager.ts`

## 为什么 Agent 系统需要 Adapter

外部入口可能很多：

```text
CLI
Web
Desktop
Telegram
Discord
Slack
```

这些入口的协议完全不同：

```text
CLI 是 argv 和 stdin
Web 是 HTTP request
Desktop 可能是 IPC
Telegram 是 bot message
Discord 是 event payload
```

但内部系统不应该为每个平台写一套 AgentLoop。

Adapter 的目标是：

```text
外部输入各不相同
内部统一变成 Agent 请求
```

## GatewayAdapter

`gateway/` 预留了：

```text
GatewayAdapter
WebGateway
DesktopGateway
MessagingGateway
GatewayManager
```

未来它们会把不同平台事件统一转成：

```text
text input
session/channel info
runtime.agent.run(...)
```

这样 runtime 不需要知道消息来自 Web 还是 Telegram。

## ModelClient 也是适配器

`ModelClient` 把不同模型供应商统一成内部决策接口。

当前是：

```text
FakeModelClient
```

未来可以是：

```text
OpenAI-compatible client
Claude client
local model client
```

只要它们符合内部接口，AgentLoop 就不需要改。

## MCP manager 也是边界适配

MCP 外部 server 有自己的连接和工具协议。  
`McpClientManager` 的价值是先把 MCP server 状态整理成内部可消费的信息。

后续真实 MCP 工具注册时，也应该走统一工具注册和权限治理，而不是让 AgentLoop 直接知道 MCP 细节。

## Adapter 和 Facade 的区别

Adapter 面向外部差异：

```text
把不同外部协议转成内部统一接口
```

Facade 面向内部复杂度：

```text
把复杂内部子系统包装成简单对外入口
```

在当前项目里：

```text
Gateway 是 Adapter
RuntimeBundle 是 Facade
```

## 常见误解

### 误解一：每个平台都应该有自己的业务逻辑

不对。平台差异应该停留在 adapter，业务主干复用 runtime。

### 误解二：Adapter 只是换个函数名

不对。Adapter 的重点是隔离协议差异和数据格式差异。

### 误解三：模型适配器不重要

很重要。没有模型适配器，AgentLoop 会被不同 provider 的响应格式污染。

## 值得记住

```text
Adapter 让外部世界可以很乱，但内部系统保持统一。
```

