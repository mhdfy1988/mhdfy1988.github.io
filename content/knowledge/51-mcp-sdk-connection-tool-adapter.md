# MCP SDK 连接层与 ToolAdapter

## 这个知识点解决什么

很多项目在说“接 MCP”时，实际只做到了两种之一：

1. 只有配置和生命周期占位，没有真实连接
2. 已经能连 server，但 MCP tool 还没有进入自己项目的工具体系

这一刀解决的是第二种缺口：

```text
不仅能连 MCP
还要让 MCP tool 真正进入 ToolRegistry
```

也就是从：

```text
MCP 是一个外部概念
```

推进到：

```text
MCP tool 在 Agent 看来就是一种可调用工具
```

## 当前代码落点

```text
src/mcp/mcp-client-manager.ts
src/mcp/mcp-connection.ts
src/mcp/mcp-transport.ts
src/mcp/mcp-tool-adapter.ts
src/runtime/runtime-bundle.ts
```

## 分层怎么拆

当前主链是：

```text
RuntimeBundle
  ↓
McpClientManager
  ↓
McpConnection
  ↓
McpTransport
  ↓
@modelcontextprotocol/sdk
```

其中：

- `McpClientManager`：管理多个 server
- `McpConnection`：管理单个 server 的真实连接
- `McpTransport`：根据配置决定走 `stdio / http / mock`
- `McpToolAdapter`：把 MCP tool 翻成项目自己的 `ToolDefinition`

这个拆法的意义是：

```text
官方 SDK 只停留在基础设施层
核心 Agent 不直接依赖 SDK 类型
```

## 为什么还要多一个 ToolAdapter

因为项目内部的工具系统长这样：

```ts
interface ToolDefinition {
  name: string;
  description: string;
  parameters?: Record<string, ToolParameterSchema>;
  execute(args, context): Promise<ToolHandlerResult>;
}
```

而 MCP SDK 返回的是另一套结构：

```text
tool.name
tool.description
tool.inputSchema
client.callTool(...)
```

两边的关注点不一样：

- MCP 关心协议
- 项目内部关心统一工具调用接口

如果不加适配层，就会出现两种坏结果：

1. `ToolRegistry` 被迫认识 SDK 类型
2. `AgentLoop` 被迫知道“这个工具是不是 MCP 工具”

这两个都不应该发生。

## ToolAdapter 做了什么

`mcp-tool-adapter.ts` 当前做了三件事。

### 1. 统一工具命名

MCP tool 注册到项目里后，名字会变成：

```text
mcp.<serverName>.<toolName>
```

例如：

```text
mcp.fake-mcp.echo
mcp.filesystem.add
```

这样做的好处：

- 一眼能看出它来自 MCP
- 不会和本地工具重名
- 多个 MCP server 并存时，来源也清楚

### 2. 把 JSON Schema 映射成项目参数结构

MCP tool 的 `inputSchema` 是 JSON Schema 风格。

项目自己的工具系统则需要：

```ts
{
  text: {
    type: "string",
    description: "..."
    required: true
  }
}
```

所以适配层会做一次参数映射，把常见类型翻进项目内部：

- `string`
- `number`
- `integer -> number`
- `boolean`
- `object`
- `array`

这一步不是为了“重新发明 schema”，而是为了让模型上下文和工具注册表继续使用统一格式。

### 3. 把 `callTool()` 包成项目工具执行器

适配后的工具最终会长成这样：

```text
ToolRegistry.call(...)
  ↓
ToolDefinition.execute(...)
  ↓
McpClientManager.callTool(serverName, toolName, args)
  ↓
SDK client.callTool(...)
```

返回结果也会重新整理成项目工具结果：

```ts
{
  ok: true | false,
  content: "给模型看的文本结果",
  data: { structuredContent, ... }
}
```

## Runtime 为什么要负责注册和卸载

这一点很关键。

MCP tool 不是静态工具，它依赖连接状态：

```text
没 start
  -> 不应该注册

已 start 且 server connected
  -> 应该注册

stop / dispose
  -> 应该卸载
```

所以这件事不能写在 `ToolRegistry` 本身，也不能写在 `AgentLoop`。

最合适的位置就是 `RuntimeBundle.start()/stop()/dispose()`：

```text
runtime.start()
  ↓
mcp.start()
  ↓
syncMcpToolsIntoRegistry()

runtime.stop()
  ↓
mcp.stop()
  ↓
unregisterMcpToolsFromRegistry()
```

这样能保证一个重要不变式：

```text
ToolRegistry 里只保留当前可用的 MCP 工具
```

## 这里体现了哪几个设计模式

这一刀同时踩到了几个很典型的模式：

### Adapter（适配器）

`McpToolAdapter` 把协议世界翻译成项目内部工具世界。

### Facade（门面）

`McpClientManager` 对外只暴露：

- `start`
- `stop`
- `listServers`
- `listTools`
- `callTool`

外层不用关心底下每个 server 的 client/transport 细节。

### Registry（注册表）

MCP tool 最终还是统一进入 `ToolRegistry`，而不是开一套平行执行通道。

## 当前还没做什么

第一版虽然主链通了，但还没做满：

- `listTools()` 分页收集
- HTTP transport 的真实 server 验证
- `resources / prompts`
- 动态 refresh / reload
- MCP 专项日志事件

也就是说，现在完成的是：

```text
真实连接 + 工具接入主链
```

但还没完成：

```text
完整 MCP 能力面
```

## 学习时怎么结合代码看

建议按这个顺序读：

```text
src/mcp/mcp-transport.ts
  ↓
src/mcp/mcp-connection.ts
  ↓
src/mcp/mcp-client-manager.ts
  ↓
src/mcp/mcp-tool-adapter.ts
  ↓
src/runtime/runtime-bundle.ts
```

读的时候抓住一句话：

```text
MCP SDK 负责“怎么连接”
ToolAdapter 负责“怎么进入项目工具体系”
Runtime 负责“什么时候挂上去，什么时候摘下来”
```
