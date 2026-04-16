# 07 - Store 仓储模式

## 先说结论

Store 仓储模式把“状态怎么用”和“状态存在哪里”分开。

当前任务系统只依赖 `TaskStore` 接口：

```text
save
getActive
clearActive
archiveActive
listHistory
restoreArchived
```

至于底层是内存、JSON 文件、SQLite，调用方不用关心。

源码落点：

- `../../src/task-state/task-store.ts`
- `../../src/task-state/in-memory-task-store.ts`
- `../../src/task-state/file-task-store.ts`
- `../../src/runtime/factories/task-store-factory.ts`

## 它解决什么问题

任务编排需要频繁读写状态：

```text
初始化计划
启动任务
完成任务
阻塞任务
失败任务
归档计划
恢复历史
```

如果每个地方都直接读写文件，会出现：

```text
文件路径散落
JSON 格式散落
clone 逻辑散落
历史格式散落
测试依赖磁盘
```

Store 把这些收起来。

## TaskStore 接口

当前接口：

```ts
save(state)
getActive()
clearActive()
archiveActive(reason?)
listHistory()
restoreArchived(options?)
```

它表达的是任务状态的使用语义：

```text
保存当前 active plan
读取当前 active plan
清空当前 active plan
归档当前 active plan
查看历史
从历史恢复
```

这比暴露 `readFile` / `writeFile` 更稳定。

## InMemoryTaskStore

内存版适合：

```text
runtime 默认行为
单元测试
快速验证
无磁盘副作用场景
```

它的特点：

```text
进程结束数据就没了
速度快
容易测试
不适合跨命令恢复
```

## FileTaskStore

文件版适合 CLI 跨命令恢复：

```text
.harness-agent/active-plan.json
.harness-agent/plan-history.json
```

它的特点：

```text
进程结束后仍然保留
支持 resume / status / history / restore
适合本地学习版
不适合高并发写入
```

## 为什么要 clone

Store 读写时会返回副本，避免外部代码拿到引用后直接污染内部状态。

例如：

```text
const active = await store.getActive()
active.snapshot.tasks[0].status = "completed"
```

如果这是内部引用，就绕过了 orchestrator。  
返回 clone 可以减少这种风险。

## 后续如何扩展

以后可以新增：

```text
SqliteTaskStore
RemoteTaskStore
EncryptedFileTaskStore
```

只要实现 `TaskStore` 接口，上层 Runtime / Orchestrator 不需要大改。

## 常见误解

### 误解一：Store 只是文件读写工具

不对。Store 是状态访问边界，它表达业务语义。

### 误解二：内存版没有意义

内存版很适合测试和默认 runtime，不是所有场景都需要持久化。

### 误解三：有了 Store 就不需要 Orchestrator

不对。Store 只负责存取，Orchestrator 决定状态怎么变。

## 值得记住

```text
Store 管“状态放哪”，Orchestrator 管“状态怎么变”。
```

