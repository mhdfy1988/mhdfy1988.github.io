# 学习记录-01-入口层与 Commander CLI

## 这一篇解决什么问题

最开始看 Agent 项目时，最容易卡住的点是：

```text
我在终端输入一条命令
代码到底从哪里开始跑？
```

所以第一篇不急着看 AgentLoop，而是先把入口层搞清楚。

这一篇的目标是：

```text
从命令行命令
追到 src/entry/cli.ts
再追到 runtime 的具体用例函数
```

## Node CLI 的基本入口

Node CLI 的本质是：

```text
package.json 里的 bin 字段
  -> 指向一个 JS 文件
  -> 安装时包管理器生成可执行命令
  -> 用户输入命令时执行这个 JS 文件
```

所以命令不是凭空出现的。

它通常来自：

```json
{
  "bin": {
    "harness-agent": "./dist/entry/cli.js"
  }
}
```

这表示：

```text
harness-agent
  -> dist/entry/cli.js
```

## 为什么 process.argv.slice(2)

Node 进程启动时，`process.argv` 前两个位置通常是：

```text
0: node 可执行文件路径
1: 当前脚本路径
```

真正的用户参数从第 3 个开始。

所以常见写法是：

```ts
const args = process.argv.slice(2);
```

它不是只拿两个参数，而是：

```text
跳过前两个系统参数
拿到后面所有用户输入
```

## 为什么后来切到 Commander

早期可以用：

```ts
if (args[0] === "--demo") {
  await runDemo();
} else if (text) {
  await runOnce(text);
} else {
  await runInteractive();
}
```

这对 demo 足够，但命令一多会很乱。

比如后面要有：

- `interactive`
- `plan`
- `execute-plan`
- `resume`
- `replan`
- `status`
- `history`
- `archive`
- `restore`

继续写 `if / else` 会越来越难维护。

所以切到 Commander。

## Commander 在这里做什么

Commander 解决的是：

```text
命令解析
参数解析
子命令注册
help 输出
action 分发
```

也就是：

```text
harness-agent execute-plan "完成一个任务"
  -> Commander 识别 execute-plan
  -> 调用 runExecutePlan(...)
```

## 入口层不应该做什么

入口层不是 Agent 核心。

它不应该负责：

- 创建复杂业务对象
- 直接改任务状态
- 决定多 Agent 策略
- 保存具体执行结果

入口层更像适配器：

```text
外部命令
  -> Runtime 用例函数
```

## 当前阅读主线

这一篇主要看：

- `src/entry/cli.ts`
- `src/entry/index.ts`
- `package.json`
- `src/runtime/runtime-bundle.ts`

阅读顺序建议：

```text
package.json bin
  -> src/entry/cli.ts
  -> Commander command(...)
  -> action(...)
  -> runtime.xxx(...)
```

## 本篇结论

入口层最重要的不是“命令怎么写”，而是：

```text
外部世界如何进入系统内部
```

只要这个边界清楚，后面 CLI、Gateway、桌面端、IDE 插件都可以变成不同入口，但内部 Runtime 用例不用乱。