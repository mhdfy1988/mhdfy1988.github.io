# 知识点-05 - 启动失败回滚机制

## 先说结论

启动失败回滚机制回答的是：

```text
系统启动到一半失败了，已经启动成功的组件怎么办？
```

成熟的 `start()` 不能只负责启动，还要负责启动失败后的收尾。

源码落点：

- `../../src/runtime/runtime-bundle.ts`
- `../../src/runtime/lifecycle.ts`
- `../../tests/runtime/runtime-bundle.test.mjs`

## 为什么需要回滚

当前 Runtime 启动顺序大致是：

```text
plugins.startEnabled()
  -> mcp.start()
  -> gateway.start(...)
  -> status = ready
```

假设发生这种情况：

```text
plugin 已经启动成功
mcp 已经连接成功
gateway 启动失败
```

如果这时直接 throw：

```text
throw new Error("gateway start failed")
```

会留下一个半启动系统：

```text
plugin 还活着
mcp 还连着
gateway 没起来
runtime 又不是 ready
```

这就是危险状态。

## 当前项目怎么回滚

`createRuntimeBundle()` 的 `start()` 里会记录已经成功启动的部分：

```text
startedPlugins
mcpStarted
startedGateways
```

当启动失败时，会调用：

```text
rollbackFailedStart(...)
```

回滚流程：

```text
gateway.stop()
  -> mcp.stop()
  -> plugins.stopPlugins(startedPlugins)
  -> runtime:start-failed
  -> status = failed
```

实际场景：

```text
plugin.onStart() 成功
-> mcp.start() 成功
-> gateway.start() 失败
-> gateway.stop() 回滚
-> mcp.stop() 回滚
-> plugin.onStop() 回滚
-> runtime:start-failed
-> 状态进入 failed
```

## 为什么回滚顺序通常反过来

启动是从内部能力到外部入口逐步打开：

```text
plugin
-> mcp
-> gateway
```

外部入口通常依赖内部能力。回滚时要反过来：

```text
gateway
-> mcp
-> plugin
```

否则可能出现：

```text
Gateway 还在接请求
MCP 已经断了
Plugin 已经停了
```

这会让外部请求打到一个内部资源不完整的系统。

## 为什么要保留 completed context

如果某个生命周期执行器抛错，理想情况下要知道：

```text
哪些组件已经完成启动
失败发生在哪个组件
失败发生在哪个阶段
```

当前项目用 `isLifecycleExecutionError(...)` 判断错误里是否包含已完成上下文。这样回滚时可以只回滚确实启动成功的部分。

这比简单写：

```text
catch { stop everything }
```

更精确。

## start 失败不是 stopped

失败后状态进入：

```text
failed
```

而不是：

```text
stopped
```

原因是：

```text
stopped 表示系统曾经正常启动，然后正常停止
failed 表示系统启动过程没有完整成功
```

这两个状态语义不同。

## 测试怎么验证

测试里有 fake gateway：

```text
FakeGatewayManager(true)
```

它会在 `start()` 时抛错。测试验证：

```text
runtime.start() 会 reject
runtime.getStatus() 是 failed
gateway.stop 被调用
mcp.stop 被调用
plugin:stopped 事件被触发
runtime:start-failed 事件被触发
```

这类测试不是测某个函数返回值，而是在测系统边界：

```text
失败路径是否安全
资源是否回收
状态是否准确
```

## 和 Agent 系统的关系

Agent Runtime 后续可能启动很多外部资源：

```text
HTTP server
WebSocket
MCP client
Browser session
Plugin background job
Message gateway
File watcher
```

这些资源只要有一个启动失败，都可能造成半启动状态。回滚机制就是为了避免系统“看似启动了，其实内部坏了一半”。

## 常见误解

### 误解一：启动失败直接 throw 就够了

不够。throw 只是通知调用方失败了，不会自动清理已经启动的资源。

### 误解二：失败后调用 dispose 就好了

不一定。dispose 可能假设系统处于正常状态。启动失败回滚需要知道哪些组件已经启动成功。

### 误解三：短命令 CLI 不需要回滚

也不对。短命令一样可能启动 MCP、Gateway、插件。如果失败不清理，会影响下一次命令或留下后台句柄。

### 误解四：回滚失败可以完全忽略

不能完全忽略。当前项目会把原始错误和回滚错误拼起来，至少让调用方知道系统可能没有清理干净。

## 值得记住

```text
start() 的责任不是“尝试启动”，而是“要么完整 ready，要么尽量回到干净失败态”。
```

以后看到成熟系统的启动逻辑，可以重点找：

```text
启动顺序
已启动组件记录
失败 catch
反向 stop / cleanup
失败状态
失败事件
测试覆盖
```

