# 学习记录-02-Config 启动契约与加载

## 这一篇接在入口之后

入口层解决的是：

```text
命令怎么进入系统
```

Config 解决的是：

```text
系统启动时需要哪些配置
这些配置从哪里来
冲突时谁优先
最终交给 Runtime 的配置长什么样
```

如果没有配置层，后面所有模块都会自己读环境变量、自己写默认值，系统会很快变乱。

## 配置系统要回答的四个问题

一个最小可维护的配置系统至少要回答：

1. 默认值是什么
2. 用户配置在哪里
3. 命令行参数怎么覆盖
4. 最终配置是否有效

所以当前项目把配置拆成：

- `settings.ts`
- `defaults.ts`
- `config-loader.ts`
- `index.ts`
- `harness.config.example.json`

## HarnessSettings 是启动契约

`HarnessSettings` 的意义不是“随便放字段”。

它更像一份启动契约：

```text
Runtime 启动前
系统必须知道哪些信息
```

比如：

- agent 元信息
- model 配置
- memory 配置
- mcpServers
- tools
- plugins
- gateway
- taskStore
- runtime 生命周期相关配置

这些配置不是某个模块私有的小变量，而是系统启动时要统一确认的材料。

## 默认配置不等于写死

默认配置的作用是：

```text
让项目在没有用户配置时也能跑起来
```

但默认配置不是最终答案。

最终配置应该来自合并：

```text
默认配置
  -> 用户配置文件
  -> 命令行覆盖
```

越往后优先级越高。

## 为什么需要 deep merge

配置常常是嵌套对象。

比如用户只想改：

```json
{
  "model": {
    "provider": "fake"
  }
}
```

这不应该把整个 `model` 配置都覆盖掉。

所以需要深合并：

```text
只覆盖用户明确写的字段
保留其他默认字段
```

## ConfigLoader 负责什么

`ConfigLoader` 主要负责：

- 找配置路径
- 读取 JSON
- 合并默认配置
- 应用 override
- 返回最终 `HarnessSettings`

它的输出应该稳定。

后面的 Runtime 不应该关心：

```text
这个字段来自默认配置？
来自用户文件？
还是来自 CLI 参数？
```

Runtime 只关心最终 settings。

## CLI 和 Config 的关系

CLI 可以提供：

- `--config`
- `--model`
- `--workspace`
- `--max-steps`

但 CLI 不应该自己拼一套系统对象。

更稳的方式是：

```text
CLI 解析命令行参数
  -> 调 config loader
  -> 得到 settings
  -> 创建 Runtime
```

## 本篇结论

Config 层的价值是：

```text
把系统启动需要的所有配置
统一收束成一份明确契约
```

后面 Runtime、AgentLoop、多 Agent、Gateway 都应该依赖这份契约，而不是各自到处读取配置。