# 知识点-04 - 生命周期状态机设计

## 先说结论

生命周期状态机回答的是：

```text
系统现在处于什么阶段？
这个阶段允许做什么？
不允许做什么？
失败后应该进入什么状态？
```

当前 Runtime 的状态是：

```text
created
starting
ready
stopping
stopped
failed
disposed
```

源码落点：

- `../../src/runtime/runtime-bundle.ts`
- `../../src/runtime/lifecycle.ts`
- `../assets/runtime-lifecycle.svg`
- `../../tests/runtime/runtime-bundle.test.mjs`

## 为什么需要生命周期

如果没有生命周期，调用方可能会做出很多危险操作：

```text
runtime 还没 start 就 run
runtime 正在 stopping 又 start
runtime 已经 disposed 还继续 run
gateway start 失败后还当作 ready
```

这些不是简单的 if 判断问题，而是系统状态管理问题。

生命周期状态机把这些边界显式化。

## 每个状态是什么意思

### created

对象已经创建完成，但外部资源还没启动。

此时：

```text
可以 start
可以 dispose
不能 agent.run
```

### starting

正在启动插件、MCP、Gateway。

此时：

```text
不能重复 start
不能 agent.run
失败要进入 failed
```

### ready

系统已经启动完成，可以处理请求。

此时：

```text
可以 runtime.agent.run(...)
可以 stop
可以 dispose
```

### stopping

正在停止系统资源。

此时：

```text
不能 start
不应该接收新请求
```

### stopped

系统已经停止，但对象还在内存里。

当前设计允许：

```text
stopped -> ready
stopped -> disposed
```

### failed

启动或运行阶段失败。

这个状态很重要，因为它告诉外部：

```text
系统没有正常 ready
不要假装还能处理请求
```

### disposed

系统已经最终清理。

此时：

```text
不能再次 start
不能 agent.run
```

## 当前状态转换

正常启动：

```text
created
  -> starting
  -> ready
```

正常停止：

```text
ready
  -> stopping
  -> stopped
```

最终清理：

```text
stopped
  -> disposed
```

启动失败：

```text
starting
  -> failed
```

## 生命周期和 hook 的关系

生命周期是主干，hook 是挂点。

当前 Runtime 会在稳定阶段发事件：

```text
runtime:before-start
runtime:started
runtime:start-failed
runtime:before-stop
runtime:stopped
runtime:disposed
```

为什么 hook 要依附生命周期？

因为如果没有清晰阶段，扩展点就会乱：

```text
到底在插件启动前打日志？
还是在 Gateway 启动后打日志？
失败后哪个事件代表系统已经回滚？
```

生命周期给 hook 提供稳定坐标。

## 和组件生命周期接口的关系

`lifecycle.ts` 里定义了运行时组件的通用接口。

意义是：

```text
Plugin / MCP / Gateway 都可以被 Runtime 按统一方式启动、停止和清理
```

后续如果某个组件也需要生命周期，就能接入同一套语义。

## 常见误解

### 误解一：生命周期只是日志顺序

不对。生命周期是运行边界。比如 `ready` 前不能执行 agent。

### 误解二：只有长进程才需要生命周期

不对。即使 CLI 是短命令，只要它会启动外部资源，也需要 start / dispose 收尾。

### 误解三：failed 后还能继续凑合用

不应该。failed 表示启动链路没有完整成功，需要重新处理。

## 值得记住

```text
生命周期状态机让“系统是否可运行”变成明确规则，而不是靠感觉判断。
```

看成熟 Agent 项目时，除了看主循环，还要看它有没有明确的启动、停止、失败和清理语义。

