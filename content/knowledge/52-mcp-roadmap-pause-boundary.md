# MCP 后续计划与暂停边界

## 这个知识点解决什么

MCP 这一条线很容易把节奏带乱。

因为它既很重要，又不是当前主体功能马上必须依赖的东西。

所以这篇笔记只回答三个问题：

```text
现在 MCP 做到哪儿了
为什么这条线先暂停
后面回来时按什么顺序继续做
```

它不是新的实现任务，而是一个阶段边界说明。

---

## 当前 MCP 做到哪儿了

当前已经完成的是：

```text
MCP SDK 第一版真实接入验证
```

具体包括：

- 已引入 `@modelcontextprotocol/sdk`
- 已补独立 `stdio` 样例
- 已补独立 `http` 样例
- `McpClientManager` 已经从占位管理器升级成真实连接管理器
- `McpConnection` 负责单个 server 的 SDK client 生命周期
- `McpTransport` 支持 `mock / stdio / http`
- `McpToolAdapter` 可以把 MCP tool 翻译成项目自己的 `ToolDefinition`
- Runtime `start()` 时可以把 MCP tools 注册进 `ToolRegistry`
- Runtime `stop()/dispose()` 时可以卸载 MCP tools

也就是说，当前已经不是：

```text
配置里有 MCP，但代码没真连
```

而是：

```text
MCP tools 已经可以通过项目工具体系进入 AgentLoop
```

---

## 为什么现在先暂停

原因不是 MCP 不重要。

真正原因是：

```text
当前项目主线还没有强依赖 MCP 的完整能力面
```

现在的主线更靠近：

- Runtime 主体能力
- Planning / Orchestration
- TaskSnapshot / TaskStore
- TeamCoordinator
- 显式协作协议
- 长期运行与恢复能力

而 MCP 当前更像：

```text
外部能力协议接入层
```

它的价值在于未来扩展外部工具、资源和模板，而不是当前没有它系统就跑不动。

所以更合理的节奏是：

```text
先把 SDK 用法和本地边界验证清楚
然后暂停
等主线真的需要外部 MCP 能力时再继续扩展
```

---

## 当前暂停边界

### 已经完成的边界

```text
tools + transport + ToolAdapter
```

也就是：

- 工具能力已经接进来了
- 连接方式已经验证过了
- 协议类型没有污染核心领域层

### 暂时不继续做的边界

当前先不继续做：

1. `resources`
2. `prompts`
3. `roots`
4. `logging`
5. `completions`
6. `sampling`
7. `elicitation`
8. `tasks`
9. `subscribe / listChanged / 热刷新`

这些不是永远不做。

而是暂时不纳入当前主体功能主线。

---

## 后面回来时按什么顺序做

后面如果重新进入 MCP 阶段，建议按三层推进。

### P1：先补内容能力

第一批继续做：

```text
resources -> prompts
```

原因是：

- `resources` 更适合进入 `ContextBuilder / 上下文工程`
- `prompts` 更适合进入 `PromptBuilder / skills / 任务模板`

这两项接完，MCP 就不只是外部工具协议，而会开始影响上下文和提示词体系。

### P2：再补边界增强

第二批再做：

```text
roots -> logging -> completions
```

原因是：

- `roots` 适合多工作区、IDE、文件访问边界
- `logging` 适合和我们自己的结构化日志体系对齐
- `completions` 更偏参数补全和交互体验

这一层是增强，不是当前最急的主链能力。

### P3：最后碰双向高级能力

第三批最后再考虑：

```text
sampling -> elicitation -> tasks -> subscribe/listChanged
```

原因是这些能力会明显拉高系统复杂度：

- `sampling`：MCP server 反向请求 client 帮它调模型
- `elicitation`：MCP server 反向请求用户输入
- `tasks`：会和我们自己的任务系统产生重叠
- `subscribe/listChanged`：会引入动态刷新和状态同步问题

这些要等我们的 Runtime、协作协议、任务系统更稳之后再碰。

---

## 和当前主线的关系

当前最准确的关系是：

```text
MCP 是已预研、已接入第一版、待后续扩展的支线
```

它不是当前阶段的主线中心。

所以后续如果我们继续做主体功能，顺序仍然应该回到：

```text
V6 显式协作协议
-> V7 Execution Journal / 更细恢复
-> V8 持续在线宿主 / 实例路由
```

MCP 这条线等真正出现下面这些需求时再回来：

- 想接现成 MCP server
- 想把外部资源接进上下文
- 想复用 MCP prompt 模板
- 想让工具系统从本地工具扩成“本地工具 + MCP 外部工具”

---

## 学习时看哪些代码和文档

建议先看：

```text
docs/integrations/mcp-roadmap.md
docs/integrations/mcp-sdk-integration-design.md
```

再看代码：

```text
src/mcp/mcp-transport.ts
src/mcp/mcp-connection.ts
src/mcp/mcp-client-manager.ts
src/mcp/mcp-tool-adapter.ts
src/runtime/runtime-bundle.ts
```

最后看样例：

```text
examples/mcp-sdk/simple-stdio-client.ts
examples/mcp-sdk/simple-stdio-server.ts
examples/mcp-sdk/simple-http-client.ts
examples/mcp-sdk/simple-http-server.ts
```

读的时候抓住一句话：

```text
MCP 当前已经知道怎么接，但还没到必须继续扩完整能力面的阶段。
```

