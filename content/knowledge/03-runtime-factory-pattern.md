# 03 - Factory 工厂模式在 Runtime 中的用法

## 先说结论

工厂模式让 Runtime 不直接绑定具体实现，而是通过 `createXxx(...)` 创建组件。

当前项目里的工厂集中在：

```text
src/runtime/factories/
```

源码落点：

- `../../src/runtime/factories/runtime-factories.ts`
- `../../src/runtime/factories/model-factory.ts`
- `../../src/runtime/factories/memory-factory.ts`
- `../../src/runtime/factories/gateway-factory.ts`
- `../../src/runtime/factories/mcp-factory.ts`
- `../../src/runtime/factories/task-store-factory.ts`
- `../../src/runtime/factories/task-orchestrator-factory.ts`

## 为什么 Runtime 需要工厂

Runtime 是装配中心，但它不应该变成具体实现仓库。

如果 Runtime 直接写：

```ts
const model = new FakeModelClient();
const memory = new InMemoryStore();
const taskStore = new InMemoryTaskStore();
```

那么以后换真实模型、SQLite 记忆、文件任务存储时，Runtime 主体会不断膨胀。

工厂把变化点隔离出去：

```text
Runtime 只知道 createModelClient(...)
至于创建 fake 模型还是真实模型，由 factory 决定
```

## 当前有哪些 factory

当前默认工厂包括：

```text
createMemoryStore
createModelClient
createGatewayManager
createMcpClientManager
createTaskStore
createTaskOrchestrator
```

这些都是未来可能替换的点。

例如：

```text
memory: in-memory -> sqlite / vector db
model: fake -> openai-compatible
taskStore: in-memory -> file / sqlite
gateway: placeholder -> real HTTP / desktop / messaging
```

## 工厂和测试的关系

测试可以覆盖局部 factory：

```ts
createRuntimeBundle(settings, {
  factories: {
    createModelClient: () => new ReplyOnlyModelClient("已完成"),
    createGatewayManager: () => fakeGateway,
  },
});
```

这样可以精确制造场景：

```text
模型返回 completed
模型抛异常
gateway 启动失败
mcp 连接成功
```

这比真实外部依赖稳定得多。

## 工厂和配置的关系

配置决定“想要什么实现”：

```text
settings.model.provider
settings.memory.provider
settings.gateway
```

factory 负责“按配置创建实现”：

```text
createModelClient(settings.model)
createMemoryStore(settings.memory)
```

Runtime 负责“把创建出来的对象连接起来”。

这三层不要混：

```text
config 只描述
factory 负责创建
runtime 负责装配
```

## 常见误解

### 误解一：工厂只是为了少写 new

不对。工厂的重点是隔离可替换实现。

### 误解二：所有东西都要工厂化

也不对。稳定的小对象可以直接创建。适合工厂化的是 provider、store、manager 这类变化点。

### 误解三：工厂会让代码更复杂

一开始会多几个文件，但当你需要测试替换、真实 provider、插件化扩展时，它会降低复杂度。

## 值得记住

```text
Factory 让 Runtime 保持“装配中心”，而不是变成“具体实现仓库”。
```

判断一个组件是否需要 factory，可以问：

```text
它以后会不会有多个实现？
测试里要不要替换它？
它是否连接外部系统？
```

