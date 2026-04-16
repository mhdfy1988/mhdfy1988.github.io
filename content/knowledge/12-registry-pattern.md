# 12 - Registry 注册表模式

## 先说结论

注册表模式（Registry Pattern）负责把能力集中登记起来，再按名称、状态或类别查找和使用。

当前项目里有三类核心 Registry：

```text
ToolRegistry
SkillRegistry
PluginRegistry
```

源码落点：

- `../../src/tools/tool-registry.ts`
- `../../src/skills/skill-registry.ts`
- `../../src/plugins/plugin-registry.ts`

## 为什么需要 Registry

Agent 系统的能力会不断变多：

```text
工具越来越多
技能越来越多
插件越来越多
MCP 能力越来越多
```

如果所有能力都写死在 `AgentLoop` 里，会变成：

```text
if toolName === "memory.remember"
if toolName === "memory.recall"
if skillName === "xxx"
if pluginName === "core-memory"
```

这会污染主循环。

Registry 把能力管理从主流程里拆出来。

## ToolRegistry

`ToolRegistry` 管工具。

它负责：

```text
register(tool)
list()
listSchemas()
call(name, input)
```

工具 schema 会进入 context，让模型知道：

```text
当前有哪些工具
工具参数是什么
工具描述是什么
```

但真正执行时仍然要经过：

```text
PermissionChecker
HookRunner
ToolRegistry.call()
```

所以注册不等于允许执行。

## SkillRegistry

`SkillRegistry` 管技能说明。

技能更像：

```text
程序性记忆
可复用流程
模型可参考的能力说明
```

它不一定直接执行副作用。真正执行仍然要走工具或 Agent 流程。

## PluginRegistry

`PluginRegistry` 管插件。

插件可以贡献：

```text
tools
skills
onStart
onStop
onDispose
```

当前内置的 `core-memory` 插件就贡献了：

```text
memory tools
memory skill
```

Runtime 启动时会：

```text
plugins.register(...)
for enabled plugin:
  skills.register(...)
  tools.register(...)
```

## Registry 和 Plugin 的关系

可以这样理解：

```text
Plugin 是能力包
Registry 是能力目录
Runtime 负责把能力包里的能力注册进目录
```

也就是说：

```text
plugin 不直接跑 AgentLoop
plugin 贡献能力
registry 管理能力
agent/context 使用能力
```

## 常见误解

### 误解一：Registry 就是数组

不对。数组只是实现方式。Registry 的重点是提供统一管理语义。

### 误解二：注册了就一定能调用

不对。工具还要经过 permissions，插件还要看 enabled，MCP 还要看连接状态。

### 误解三：Registry 可以替代插件系统

不完全。Registry 管单类能力，Plugin 可以打包多类能力和生命周期。

## 值得记住

```text
Registry 让能力可扩展，但不让能力污染主流程。
```

看成熟 Agent 项目时，可以找这些注册表：

```text
tool registry
command registry
plugin registry
skill registry
model provider registry
```

