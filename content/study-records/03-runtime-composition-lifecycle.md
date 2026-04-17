# 学习记录-03-Runtime 装配与生命周期

## 这一篇解决什么问题

入口层和配置层解决以后，下一个问题是：

```text
系统里这么多对象
到底在哪里创建
在哪里连接
在哪里启动和关闭
```

这个位置就是 Runtime。

## Runtime 不是 AgentLoop

这是这一篇最重要的判断。

`AgentLoop` 负责：

```text
一轮输入怎么执行
```

`Runtime` 负责：

```text
整个系统怎么装起来
怎么启动
怎么停止
对外暴露哪些用例
```

所以不要把所有东西都塞进 `AgentLoop`。

## Runtime 是装配根

装配根（Composition Root）就是集中创建对象和连接依赖的地方。

当前 Runtime 会装配：

- SessionState
- ContextBuilder
- ModelClient
- ToolRegistry
- PermissionChecker
- HookRunner
- MemoryStore
- LearningStore
- ReflectionLoop
- MCP Client Manager
- PluginRegistry
- AgentLoop
- TaskStore
- Planner
- Replanner
- TaskOrchestrator

如果这些对象到处自己 new，依赖关系会很快失控。

## 为什么要做 factory

Runtime 里有些对象未来会替换。

比如：

- fake model 换成真实 model
- in-memory store 换成 file store
- fake MCP 换成真实 MCP
- 单 Agent 换成多 Agent

所以创建逻辑不应该散落在各处。

通过 factory，可以做到：

```text
Runtime 负责装配
Factory 负责创建具体实现
```

测试时也能注入 fake。

## 生命周期解决什么问题

只创建对象还不够。

有些对象需要启动和停止：

- MCP 连接
- Gateway 服务
- Hook 生命周期
- 后台任务
- 文件句柄
- 长连接

所以 Runtime 需要生命周期：

```text
created
  -> starting
  -> running
  -> stopping
  -> stopped
  -> disposed
```

生命周期的意义是让系统知道：

```text
现在能不能接任务
启动失败要不要回滚
关闭时要按什么顺序释放资源
```

## 启动失败为什么要回滚

如果 Runtime 启动到一半失败，比如：

```text
Hook 启动成功
MCP 启动失败
Gateway 还没启动
```

这时不能直接抛错结束。

已经启动成功的部分要停止掉。

这就是启动失败回滚：

```text
start A 成功
start B 成功
start C 失败
  -> stop B
  -> stop A
```

否则会留下半启动状态。

## Runtime 对外暴露什么

Runtime 不只是返回一个 `agent`。

它还应该逐步暴露这些用例：

- run once
- interactive
- create plan
- execute plan
- resume
- replan
- status
- history
- archive
- restore
- drive followUp

这样 CLI、Gateway、IDE 都可以调用 Runtime，而不是直接操作底层对象。

## 本篇结论

Runtime 的价值是：

```text
把散落的系统组件
装成一个有生命周期、有用例入口的运行时
```

如果入口层是门口，Config 是启动契约，那么 Runtime 就是系统真正装起来的地方。