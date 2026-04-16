# 知识点-01 - Node CLI 入口与 bin 机制

## 先说结论

Node CLI 的本质不是“某个文件自动执行”，而是：

```text
包管理器根据 package.json 的 bin 字段生成一个系统命令
这个系统命令再去执行项目里的入口脚本
入口脚本再把命令行参数交给解析器
解析器最后调用真正的业务入口
```

当前项目里的链路是：

```text
用户输入 harness-agent
  -> package.json bin 映射
  -> dist/entry/cli.js
  -> src/entry/cli.ts
  -> Commander program.parseAsync(process.argv)
  -> runDemo / runOnce / runInteractive / runPlan / runExecutePlan
  -> createRuntimeBundle()
```

源码落点：

- `../../package.json`
- `../../src/entry/cli.ts`
- `../../src/entry/index.ts`

## 这个知识点解决什么问题

它解决的是你一开始问过的那个问题：

```text
我在终端输入一个命令，代码到底是怎么跑进 main / cli 入口的？
```

在 JS / TS 项目里，一般不是靠语言自动找 `main()`。它通常靠工具链约定：

```text
package.json
  -> scripts
  -> bin
  -> node
  -> 入口 JS 文件
```

所以和 Python 的 console_scripts 很像：

```text
Python: pyproject.toml / setup.py -> console_scripts -> 函数
Node: package.json -> bin -> JS 文件
```

## 当前项目怎么做

`package.json` 里有：

```json
{
  "bin": {
    "harness-agent": "./dist/entry/cli.js"
  }
}
```

这表示项目安装或 `npm link` 后，会生成一个命令：

```text
harness-agent
```

这个命令指向：

```text
dist/entry/cli.js
```

开发阶段我们写的是：

```text
src/entry/cli.ts
```

构建后才会变成：

```text
dist/entry/cli.js
```

所以要分清：

```text
源码入口：src/entry/cli.ts
运行入口：dist/entry/cli.js
命令入口：harness-agent
```

## shebang 是什么

`src/entry/cli.ts` 顶部有：

```ts
#!/usr/bin/env node
```

这行叫 shebang。它告诉操作系统：

```text
这个文件要用 node 来执行
```

如果没有这行，在类 Unix 环境里直接执行脚本时，系统可能不知道该用什么解释器。Windows 下 npm 会生成 `.cmd` / `.ps1` shim，行为会有一点不同，但最终也是为了执行 Node 脚本。

## npm run、node dist、全局命令的区别

### npm run dev

当前项目里：

```json
{
  "scripts": {
    "dev": "tsx src/entry/cli.ts"
  }
}
```

所以：

```powershell
npm.cmd run dev -- plan 实现 web gateway
```

实际是：

```text
tsx src/entry/cli.ts plan 实现 web gateway
```

它适合开发阶段，直接跑 TypeScript。

### node dist/entry/cli.js

构建后：

```powershell
npm.cmd run build
node dist/entry/cli.js --help
```

这是直接跑编译后的 JS 文件。

### harness-agent.cmd

`npm.cmd link` 后：

```powershell
harness-agent.cmd --help
```

这走的是 `package.json bin` 生成的命令入口。

在 Windows PowerShell 里建议用 `.cmd`，避免命中 `.ps1` shim 被执行策略拦截。

## 为什么 entry 层不要写业务逻辑

入口层只负责这几件事：

```text
解析命令
解析参数
加载配置
调用 runtime
打印结果
```

它不应该直接做：

```text
模型调用
工具执行
任务状态更新
replan 细节
memory 写入
```

原因是后面会有多个入口：

```text
CLI
Web Gateway
Desktop Gateway
Messaging Gateway
```

如果业务逻辑写死在 CLI 里，Web 和桌面端就不能复用。

## 一轮真实执行例子

用户输入：

```powershell
npm.cmd run dev -- execute-plan 实现 web gateway 骨架
```

执行链路：

```text
npm.cmd
  -> scripts.dev
  -> tsx src/entry/cli.ts
  -> Commander 读取 process.argv
  -> 命中 execute-plan 子命令
  -> runExecutePlan(goal, settings)
  -> createPersistentRuntimeBundle(settings)
  -> runtime.plan(goal)
  -> runtime.initializePlan(plan)
  -> runtime.taskOrchestrator.startNext()
  -> runtime.executeCurrentTask(started)
```

这里 CLI 只是把外部命令转成 runtime 方法调用。

## 常见误解

### 误解一：JS 项目会自动找 main 函数

不对。Node 项目通常靠 `package.json` 的 `main`、`scripts`、`bin` 等字段表达入口。

### 误解二：src/entry/cli.ts 就是用户最终执行的文件

开发时是。发布或 link 后通常执行的是 `dist/entry/cli.js`。

### 误解三：CLI 入口就是系统主流程

不对。CLI 是入口适配器。系统主流程应该沉到 runtime / agent / orchestration。

## 值得记住

```text
bin 负责把系统命令连到脚本，entry 负责把外部输入连到 runtime。
```

以后看任何 Node CLI 项目，先找：

```text
package.json scripts
package.json bin
入口文件顶部 shebang
入口文件里怎么 parse argv
parse 后调用哪个内部模块
```

