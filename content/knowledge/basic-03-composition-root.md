# 知识点-03 - 装配根 Composition Root

## 先说结论

装配根（Composition Root）是系统里集中创建对象、连接依赖的地方。

当前项目里的装配根是：

```text
createRuntimeBundle()
```

它的职责不是跑业务，而是把系统从一堆零件装成一台机器。

源码落点：

- `../../src/runtime/runtime-bundle.ts`
- `../../src/runtime/factories/runtime-factories.ts`
- `../../src/config/config-loader.ts`

## 为什么需要装配根

如果没有装配根，各模块可能会这样写：

```text
AgentLoop 自己 new ModelClient
ContextBuilder 自己 new MemoryStore
ToolRegistry 自己 new PermissionChecker
CLI 自己 new TaskOrchestrator
```

这样会带来几个问题：

```text
依赖散落
测试难替换
配置难统一
生命周期难管理
模块之间越来越互相知道
```

装配根把这些对象集中创建：

```text
这里创建对象
这里注入依赖
这里决定用哪个实现
业务模块只使用传进来的依赖
```

## 当前 createRuntimeBundle 装配了什么

当前 Runtime 会装配：

```text
SessionState
InMemoryLearningStore
MemoryStore
PermissionChecker
HookRunner
SkillRegistry
PluginRegistry
ReflectionLoop
GatewayManager
McpClientManager
ToolRegistry
ContextBuilder
ModelClient
Planner
Replanner
TaskStore
TaskOrchestrator
AgentLoop
```

这些对象不是孤立存在的，它们之间有明确依赖：

```text
ContextBuilder 需要 memory / learning / skills / plugins / mcp
AgentLoop 需要 session / contextBuilder / model / tools / permissions / hooks
ReflectionLoop 需要 learning / memory / skills
TaskOrchestrator 需要 taskStore
```

装配根把这些关系写在一个地方，读起来就像系统地图。

## 装配根和工厂模式的关系

`createRuntimeBundle()` 不是直接写死所有实现，而是先解析 factories：

```text
createDefaultRuntimeFactories()
  -> createMemoryStore
  -> createModelClient
  -> createGatewayManager
  -> createMcpClientManager
  -> createTaskStore
  -> createTaskOrchestrator
```

这样 Runtime 仍然是装配中心，但具体实现可以换。

例如测试中可以传：

```ts
createRuntimeBundle(settings, {
  factories: {
    createModelClient: () => new ReplyOnlyModelClient("已完成"),
  },
});
```

这就是装配根和工厂模式配合的好处。

## 装配根和业务逻辑的边界

装配根应该做：

```text
创建对象
连接对象
应用配置
注册插件能力
建立生命周期入口
```

不应该做：

```text
具体执行某个任务
解析模型自然语言结果
决定下一项任务是否完成
直接读写 CLI 参数
```

这些应该分别交给：

```text
AgentLoop
TaskExecutionEvaluator
TaskOrchestrator
entry/cli.ts
```

## 一轮实际例子

当 CLI 运行：

```powershell
npm.cmd run dev -- chat 你好
```

链路是：

```text
entry/cli.ts
  -> loadSettings()
  -> createRuntimeBundle(settings)
       创建 session / memory / tools / model / agentLoop
  -> runtime.start()
  -> runtime.agent.run("你好")
```

这里 `createRuntimeBundle()` 只负责把 `runtime.agent` 装出来，真正跑一轮的是 `AgentLoop.run()`。

## 常见误解

### 误解一：装配根就是 main 函数

不完全对。main/CLI 入口负责接收外部输入，装配根负责创建内部系统。

### 误解二：装配根越小越好

不一定。装配根天然会比较集中，因为它表达的是系统依赖图。关键是它不要承载业务细节。

### 误解三：所有模块都可以自己 new 依赖

这会让依赖关系变得隐式，后面很难测试和替换。

## 值得记住

```text
Composition Root 让依赖关系集中、清楚、可替换。
```

看成熟 Agent 项目时，可以先找它的装配根。找到装配根，就等于找到了系统是怎么被组装起来的。

