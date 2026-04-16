# 知识点-06 - 工厂注入与 Fake 测试

## 先说结论

工厂注入让复杂系统可以在测试里替换关键组件。

当前项目的形式是：

```ts
createRuntimeBundle(settings, {
  factories: {
    createModelClient: () => fakeModel,
    createGatewayManager: () => fakeGateway,
    createMcpClientManager: () => fakeMcp,
  },
});
```

这样测试不需要启动真实模型、真实 Gateway、真实 MCP，也能验证 Runtime 的控制流和状态边界。

源码落点：

- `../../src/runtime/factories/runtime-factories.ts`
- `../../src/runtime/runtime-bundle.ts`
- `../../tests/runtime/runtime-bundle.test.mjs`

## 为什么需要工厂注入

Runtime 管很多外部或可替换组件：

```text
model
gateway
mcp
memory
taskStore
taskOrchestrator
```

如果 Runtime 内部直接写死：

```ts
const model = new FakeModelClient(...);
const gateway = new GatewayManager(...);
```

测试就很难替换它们。

而有了 factories，Runtime 只需要调用：

```text
factories.createModelClient(settings.model)
factories.createGatewayManager(settings.gateway)
factories.createMcpClientManager(settings.mcp.servers)
```

具体返回什么，可以由默认工厂决定，也可以由测试覆盖。

## 当前测试里有哪些 fake

### FakeGatewayManager

用于测试：

```text
gateway.start 是否被调用
gateway.stop 是否被调用
gateway.dispose 是否被调用
gateway.start 失败时 runtime 是否回滚
```

它还能通过参数模拟启动失败：

```ts
new FakeGatewayManager(true)
```

### FakeMcpClientManager

用于测试：

```text
mcp.start / stop / dispose 调用次数
mcp connected 状态
planning context 里是否能看到 mcp server
```

### ReplyOnlyModelClient

用于测试模型直接返回普通回复：

```text
已完成当前任务摘要
```

这样可以验证 runtime 是否把任务判为 completed。

### ThrowingModelClient

用于测试模型直接抛异常：

```text
model execution failed
```

这样可以验证异常路径是否写入：

```text
lastExecution.status = failed
lastExecution.source = error
```

## Fake、Mock、Stub 的区别

这里不用死背概念，但可以粗略理解：

```text
Stub：返回固定数据
Mock：带行为断言，关心有没有被调用
Fake：一个简化但可运行的替代实现
```

当前项目里的测试对象更像轻量 fake：

```text
它们有状态
有方法
能模拟成功或失败
但不连接真实外部系统
```

## 为什么不用真实组件测试

如果测试启动真实组件，会遇到：

```text
需要真实 API key
需要真实网络
端口可能冲突
MCP server 不稳定
模型返回不确定
失败场景不好制造
测试速度慢
```

而 Runtime 层很多测试真正关心的是：

```text
状态有没有变化
回滚有没有发生
方法有没有被调用
错误有没有传递
```

这些用 fake 更稳定。

## 当前测试覆盖了什么

runtime 测试覆盖：

```text
created -> ready -> stopped -> disposed
ready 前不能 agent.run
factory 覆盖是否生效
planning context 能否读取 fake mcp
start 失败是否回滚
startNextAndExecute 是否回写 snapshot
执行异常是否写 lastExecution
replan preview 是否不替换 active plan
```

这些都是系统级边界测试，不是普通小函数测试。

## 和工厂模式的关系

工厂注入是工厂模式在测试里的直接收益：

```text
生产环境使用默认工厂
测试环境覆盖部分工厂
Runtime 主体不变
```

这让 Runtime 既能保持真实装配逻辑，又能被测试精确控制。

## 常见误解

### 误解一：Fake 测试不真实，所以没价值

不对。Fake 测试非常适合验证控制流、状态机和错误路径。

### 误解二：有 Fake 测试就不需要集成测试

也不对。Fake 测试验证内部逻辑，集成测试验证真实外部协议。

### 误解三：直接 monkey patch 更快

短期可能更快，长期会让测试依赖实现细节。工厂注入更清晰。

## 值得记住

```text
工厂注入让复杂系统可替换，Fake 测试让复杂系统可验证。
```

成熟 Agent 系统里，凡是模型、工具、网关、存储、外部连接，都应该考虑能否通过工厂或接口替换。否则测试会越来越难写。

