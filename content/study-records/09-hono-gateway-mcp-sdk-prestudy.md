# 学习记录-09-Hono Gateway 与 MCP SDK 接入预研

这一阶段我们没有继续硬推主体功能，而是先把两条未来一定会碰到的外部接入边界提前踩通：

- `Hono Gateway`
- `MCP SDK`

这两条线现在的定位要先说清楚：

```text
它们是接入层预研
不是当前主体功能主线阶段本身
```

也就是说，这一阶段的目标不是“现在立刻做平台化”，而是：

- 先把 HTTP 入口应该怎么进 Runtime 讲清楚
- 先把 MCP 官方 SDK 应该怎么接进工具体系讲清楚
- 先把边界站住，降低后面真正接平台时的不确定性

---

## 一、为什么这时候先做 Hono 和 MCP

当前主线其实已经推进到：

```text
AgentLoop
-> Runtime
-> Planning
-> Snapshot / Store / Orchestrator
-> TeamCoordinator
```

这条线已经能说明：

- 任务怎么拆
- 任务怎么推进
- 任务怎么审查
- 任务怎么在任务边界恢复

但如果完全不提前看外部接入层，后面会有两个现实问题：

### 1. 入口层会不会直接绕开 Runtime

如果未来接：

- Web
- 桌面端
- VSCode
- 外部 HTTP 服务

很容易一不小心就变成：

```text
Hono Route 直接调 AgentLoop
```

这样入口一多，很快就会长出多套流程。

### 2. MCP 会不会只停在“配置占位”

很多项目说“支持 MCP”，实际只做到：

- 配置里有 server 列表
- 生命周期里有一个 `start()`
- 状态上写个 connected

但真正关键的是：

```text
MCP tool 能不能进入项目自己的工具体系
```

所以我们先把这两条线做成第一版验证，是为了后面接平台时不再靠猜。

---

## 二、Hono Gateway 这一刀到底做了什么

### 1. 目标不是“接一个 HTTP 框架”

这条线真正想解决的问题是：

```text
HTTP 入口应该只是入口适配器
不应该成为新的 Agent 主流程实现点
```

所以当前边界被收成了：

```text
Hono Route
  ↓
GatewayPort
  ↓
RuntimeGatewayPort
  ↓
RuntimeBundle public methods
```

### 2. 为什么不能让 Hono 直接调用 AgentLoop

因为 Hono 只应该负责：

- 路由
- 请求解析
- 响应输出
- server 生命周期

它不应该知道：

- TaskPlan 怎么生成
- TaskSnapshot 怎么推进
- TeamCoordinator 怎么协调
- FollowUp 怎么自动推进

如果把这些逻辑写进 route，后面 CLI / HTTP / 桌面端就会各写一套。

### 3. 第一版具体落地了什么

当前已经有：

```text
GET  /health
POST /chat
POST /execute-plan
```

对应代码落点：

```text
src/gateway/gateway-port.ts
src/gateway/runtime-gateway-port.ts
src/gateway/hono-web-app.ts
src/gateway/web-gateway.ts
```

这里最重要的不是多了几个文件，而是把“入口调用什么”收成了稳定契约。

### 4. 这条线学到的关键点

这一刀最终沉淀成的知识点是：

- `50-gateway-port-http-adapter.md`

一句话记住就是：

```text
Hono 是入口适配器
Runtime 才是 Agent 主流程门面
```

---

## 三、MCP SDK 这一刀到底做了什么

### 1. 不是只写了占位类

MCP 这条线当前已经不是“未来考虑接 SDK”，而是完成了第一版真实接入验证。

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

也就是说，SDK 已经真的进入了基础设施层。

### 2. 为什么还要多一层 ToolAdapter

因为 MCP 世界里的 tool，和项目内部 `ToolRegistry` 的工具定义，不是同一套结构。

如果不做适配，就会出现两个坏结果：

- `ToolRegistry` 被迫认识 SDK 类型
- `AgentLoop` 被迫知道“这个工具是不是 MCP 工具”

所以当前又多了一层：

```text
McpToolAdapter
```

它负责把：

```text
MCP tool
```

翻成：

```text
项目内部 ToolDefinition
```

### 3. 第一版已经做到哪里

当前已经完成：

- `mock / stdio / http` 三种 transport 验证
- `McpConnection` 单连接管理
- `McpClientManager` 多 server 生命周期
- `listTools()` 获取工具定义
- `callTool()` 执行 MCP 工具
- Runtime `start()` 时把 MCP tools 注册进 `ToolRegistry`
- Runtime `stop()/dispose()` 时自动卸载

这意味着：

```text
MCP tool 在 Agent 看来
已经可以像本地工具一样被调用
```

### 4. 但为什么又说它还不是主线

因为当前做成的是：

```text
第一版连接层和工具接入验证
```

不是：

```text
MCP 整体能力已经成为当前主体功能的推进中心
```

后面还没继续做的包括：

- `resources`
- `prompts`
- `roots`
- `logging`
- `completions`
- `sampling`
- `elicitation`
- `tasks`

所以现在对 MCP 最准确的阶段判断是：

```text
已经完成“官方 SDK 怎么接进来”的第一版答案
但还没有进入“围绕 MCP 继续扩主线能力”的阶段
```

### 5. 这条线沉淀成了什么

当前对应的知识点是：

- `51-mcp-sdk-connection-tool-adapter.md`

同时还单独补了一份路线图：

- `docs/integrations/mcp-roadmap.md`

这份路线图的作用不是催着现在继续做，而是告诉后面最合理的顺序应该是：

```text
tools
-> resources
-> prompts
-> roots / logging / completions
-> sampling / elicitation / tasks
```

---

## 四、这一阶段最该记住的两条边界

### 1. Gateway 边界

```text
入口层负责接收请求
Runtime 负责执行用例
AgentLoop 负责单轮执行
```

不要让 HTTP 框架直接变成新的主流程层。

### 2. MCP 边界

```text
官方 SDK 留在基础设施层
项目核心仍然只依赖自己的 ToolRegistry 和领域接口
```

不要让 SDK 类型直接污染 Runtime、AgentLoop 和工具主链。

---

## 五、这一阶段新增了哪些知识点

这一阶段新增的核心知识点有两个：

1. `50-gateway-port-http-adapter.md`
   - 主题：GatewayPort 与 HTTP Adapter 边界

2. `51-mcp-sdk-connection-tool-adapter.md`
   - 主题：MCP SDK 连接层与 ToolAdapter

这两个知识点本质上都在回答同一类问题：

```text
外部协议和外部框架
应该在系统的哪一层停住
```

---

## 六、这一阶段完成后，主线应该怎么继续

这一阶段做完后，最容易误解的一点是：

```text
是不是主线已经转去做 Gateway / MCP 了
```

答案是否定的。

更准确的判断是：

```text
主线阶段：
依然是 V5 完成后，准备回到 V6 显式协作协议

支线预研：
Hono Gateway 和 MCP SDK 第一版已经踩通
后面需要时再沿着已验证边界继续展开
```

也就是说，这一阶段的价值不是“换主线”，而是：

- 把未来的平台入口边界站住
- 把未来的外部工具协议边界站住
- 让后面继续回到主体功能时，心里已经有数

---

## 七、一句话收口

这一阶段最本质的收获不是“接上了 Hono”或“接上了 MCP SDK”，而是：

**我们把“外部入口怎么接进来”和“外部工具协议怎么接进来”这两条未来一定会遇到的边界，提前做成了第一版可验证答案。**
