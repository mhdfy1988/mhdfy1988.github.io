# 知识点-02 - 配置优先级与深合并

## 先说结论

配置系统不是简单地“读一个 JSON 文件”。成熟一点的配置系统至少要回答四个问题：

```text
配置结构是什么
默认值是什么
用户从哪里覆盖
多个来源冲突时谁优先
```

当前项目采用的优先级是：

```text
defaults.ts 默认配置
  -> harness.config.json 配置文件
  -> HARNESS_AGENT_* 环境变量
  -> CLI overrides
  -> HarnessSettings
```

越往后优先级越高。

源码落点：

- `../../src/config/settings.ts`
- `../../src/config/defaults.ts`
- `../../src/config/config-loader.ts`
- `../../src/entry/cli.ts`
- `../../harness.config.example.json`

## 为什么要有配置优先级

同一个配置项可能来自多个地方：

```text
默认模型：fake-rule-model
配置文件指定模型：demo-model
环境变量指定模型：env-model
CLI 临时指定模型：--model cli-model
```

如果不定义优先级，系统就会变得不可预测：

```text
这次为什么用了 env-model？
为什么命令行参数没生效？
为什么配置文件被覆盖了？
```

所以配置优先级本质上是启动契约的一部分。

## 当前项目的配置分层

### settings.ts

只定义类型。

它回答：

```text
最终配置长什么样？
```

例如：

```text
app
agent
model
memory
learning
reflection
permissions
plugins
mcp
gateway
cli
```

### defaults.ts

只定义默认值。

它回答：

```text
用户什么都不配时系统怎么启动？
```

### config-loader.ts

负责加载和合并。

它回答：

```text
默认值、配置文件、环境变量、CLI 覆盖怎么合成最终 HarnessSettings？
```

### runtime/

只消费最终配置。

它不应该关心配置来自哪里。

## 深合并是什么

浅覆盖的问题是：一个嵌套对象只改一个字段，却把整个对象替换掉。

例如默认配置：

```ts
model: {
  provider: "fake",
  modelName: "fake-rule-model",
}
```

如果用户只覆盖：

```json
{
  "model": {
    "modelName": "my-model"
  }
}
```

我们希望最终结果是：

```ts
model: {
  provider: "fake",
  modelName: "my-model",
}
```

而不是：

```ts
model: {
  modelName: "my-model",
}
```

这就是深合并的价值。

## 为什么 app 和 agent 要拆开

我们之前专门调整过这一点。

`app` 是项目公共身份：

```text
name
version
description
```

它可以被 CLI、Gateway、日志、文档共用。

`agent` 是 Agent 行为配置：

```text
persona
maxToolRounds
```

它影响模型行为和每轮工具循环。

如果把两者混在一起，会导致：

```text
产品身份
运行行为
模型人格
版本信息
```

全部挤在一个对象里，后面很难扩展。

## 配置也是副作用边界

一个很 Agent 系统味道的例子是：

```text
permissions.mode = plan
```

当进入 plan 模式时，runtime 会关闭学习/反思写入，避免出现：

```text
工具写入被权限禁止
但 reflection 又偷偷把内容写进 memory
```

所以配置不仅决定功能开关，还决定副作用边界。

## 一轮加载流程

CLI 启动时：

```text
Commander 解析 --config / --model / --permission-mode
  -> createCliSettings(options)
  -> loadSettings({ configPath, overrides })
  -> createDefaultSettings()
  -> 读取 harness.config.json
  -> 读取环境变量
  -> 应用 CLI overrides
  -> 返回 HarnessSettings
  -> createRuntimeBundle(settings)
```

这里要注意：

```text
config-loader 负责产出最终配置
runtime 负责按配置创建对象
```

## 常见误解

### 误解一：配置文件就是配置系统

不对。配置文件只是配置来源之一。

### 误解二：默认配置可以直接改成用户配置

不应该。默认值应该稳定，用户覆盖应该作为额外层合并。

### 误解三：深合并越深越好

也不一定。数组通常不应该盲目深合并，比如插件列表、MCP server 列表，有时直接替换更清晰。

## 值得记住

```text
配置系统的核心不是“读文件”，而是“形成稳定、可解释的启动契约”。
```

以后看成熟项目配置系统，可以按这个顺序拆：

```text
类型定义在哪里
默认值在哪里
配置文件怎么读
环境变量怎么覆盖
CLI 参数怎么覆盖
最后谁消费配置
```

