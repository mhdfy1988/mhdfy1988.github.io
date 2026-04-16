# 13 - Hook 事件扩展点

## 先说结论

Hook 是事件扩展点。主流程在稳定节点发出事件，外部 handler 可以订阅这些事件做日志、指标、审计、插件扩展等。

源码落点：

- `../../src/hooks/hook-runner.ts`
- `../../src/runtime/runtime-bundle.ts`

## 为什么需要 Hook

没有 hook 时，主流程会越来越多副作用：

```text
启动时打印日志
工具调用前记录审计
工具调用后统计耗时
插件启动后发事件
gateway 停止后清理资源
```

如果这些都写死在主逻辑里，主流程会变得很脏。

Hook 的做法是：

```text
主流程只 emit 事件
外部 handler 决定要做什么
```

## 当前 HookRunner 怎么工作

概念上是：

```text
hooks.register(eventName, handler)
hooks.emit(eventName, payload)
```

Runtime 在关键位置 emit：

```text
runtime:before-start
runtime:started
runtime:start-failed
runtime:before-stop
runtime:stopped
runtime:disposed
```

工具调用时 emit：

```text
tool:pre
tool:post
```

插件和 gateway 生命周期也会 emit：

```text
plugin:started
plugin:stopped
plugin:disposed
gateway:started
gateway:stopped
gateway:disposed
```

## Hook 和生命周期的关系

一句话：

```text
生命周期是主干，hook 是挂点。
```

生命周期提供稳定阶段：

```text
before-start
started
before-stop
stopped
disposed
```

Hook 挂在这些阶段上。

如果没有生命周期，hook 就会乱：

```text
到底什么时候算 started？
插件启动前还是 Gateway 启动后？
失败时哪个事件代表已经回滚？
```

## Hook 和 Plugin 的关系

Hook 是事件机制。  
Plugin 是能力包。

Plugin 可以利用 hook 做扩展，但 hook 本身不等于 plugin。

可以理解为：

```text
Hook 提供时机
Plugin 提供能力
Runtime 负责触发
```

## 当前项目里的日志 hook

当 `settings.hooks.logToolEvents` 开启时，Runtime 会注册一些日志 handler：

```text
runtime:started -> 打印 [runtime] ready
plugin:started  -> 打印 [plugin] started core-memory
tool:pre        -> 打印 [hook:pre] toolName
tool:post       -> 打印 [hook:post] toolName
```

这说明日志不是写死在工具执行里，而是通过 hook 接入。

## 常见误解

### 误解一：Hook 可以替代主流程

不对。Hook 是扩展点，不是核心控制流。

### 误解二：哪里想扩展就哪里 emit

不应该。Hook 应该挂在稳定语义点，而不是随手 emit。

### 误解三：Hook 越多越灵活

过多 hook 会让系统难以理解。Hook 应该少而稳定。

## 值得记住

```text
Hook 的价值是让副作用可插拔，而不是让主流程更复杂。
```

