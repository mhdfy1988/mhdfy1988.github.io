# 学习记录-07-Vitest 测试体系与质量门禁

这一阶段我们把测试体系从“能跑”推进到“能表达领域语义、能形成质量门禁”。

重点覆盖：

- Vitest 配置与测试入口
- `setupFiles` 全局测试能力
- 自定义 matcher
- fixture / test builder
- 参数化测试
- fake timer
- coverage threshold
- CI summary / PR comment
- XML 报告解析与成熟库边界

---
# Vitest 测试体系迁移设计

这份文档列出把当前测试体系从 `node --test` 迁移到 `vitest` 需要修改哪些文件，以及建议按什么顺序做。

当前状态：Vitest 第三十五版增强已经完成。默认 `npm.cmd test` 已经切到 Vitest，旧的 `node:test` / `.test.mjs` 链路已经清空，并且已经补上参数化规则表测试、matcher 第六版、按关键模块细化的 coverage 阈值、GitHub Actions CI matrix、时间相关测试基础设施，以及把假时间真正落到了 runtime 并发场景测试里。第三十一版进一步把“持续驱动假时间直到异步任务完成”的逻辑沉淀成公共 helper；第三十二版补上了 CI Step Summary；第三十三版增强了失败用例摘要；第三十四版补上 coverage 阈值对比、可选 baseline diff 和同仓库 PR 自动评论；第三十五版继续补齐了从主分支 artifact 自动拉 baseline coverage、PR comment 快速概览样式，以及用成熟 XML 解析库替代手写 JUnit XML 正则解析。

```text
npm.cmd test
  先执行 pretest: npm run typecheck
  再执行 vitest run
  跑全部 tests/**/*.test.ts

npm.cmd run test:vitest
  直接执行 vitest run
  适合在已经单独做过 typecheck 时快速验证测试
```

这次验证发现一个关键点：

```text
Vitest 不能把 import test from "node:test" 自动识别成自己的测试用例。
如果直接 include tests/**/*.test.mjs，文件会执行，但 Vitest 会报 No test suite found。
```

所以第一版采用“旧测试继续交给 `node:test`，新测试交给 `vitest`”的方式，而不是假装 Vitest 能无缝托管现有 `.mjs` 文件。第六版完成后，所有旧 `.mjs` 测试都已经迁移成 `.test.ts`，因此默认入口可以安全切到 Vitest。

第二版已经正式迁移了 4 组测试：

```text
tests/orchestration/task-execution-evaluator.test.ts
tests/config/settings-schema.test.ts
tests/planning/plan-schema.test.ts
tests/team/collaboration-schema.test.ts
```

对应旧 `.mjs` 文件已经删除。当前验证结果：

```text
npm.cmd test
  node:test 旧链路：84 个测试通过

npm.cmd run test:vitest
  Vitest 新链路：4 个文件、28 个测试通过

合计仍然是 112 个测试语义。
```

第三版继续迁移了 store 类测试：

```text
tests/task-state/task-state.test.ts
tests/task-state/file-task-store.test.ts
tests/team/collaboration-log.test.ts
```

对应旧 `.mjs` 文件已经删除。当前验证结果：

```text
npm.cmd test
  node:test 旧链路：66 个测试通过

npm.cmd run test:vitest
  Vitest 新链路：7 个文件、46 个测试通过

合计仍然是 112 个测试语义。
```

第四版继续迁移了轻量协作测试：

```text
tests/team/collaboration-protocol.test.ts
tests/team/collaboration-history-window.test.ts
tests/team/role-task-executor.test.ts
```

对应旧 `.mjs` 文件已经删除。当前验证结果：

```text
npm.cmd test
  node:test 旧链路：58 个测试通过

npm.cmd run test:vitest
  Vitest 新链路：10 个文件、54 个测试通过

合计仍然是 112 个测试语义。
```

第五版继续迁移了中等复杂度的编排和重新规划测试：

```text
tests/orchestration/orchestration.test.ts
tests/orchestration/orchestration-recover.test.ts
tests/planning/default-replanner.test.ts
```

对应旧 `.mjs` 文件已经删除。当前验证结果：

```text
npm.cmd test
  node:test 旧链路：48 个测试通过

npm.cmd run test:vitest
  Vitest 新链路：13 个文件、64 个测试通过

合计仍然是 112 个测试语义。
```

第六版完成了最后两个大集成测试迁移：

```text
tests/team/team-coordinator.test.ts
tests/runtime/runtime-bundle.test.ts
```

对应旧 `.mjs` 文件已经删除，默认测试入口也已经切换：

```text
npm.cmd test
  Vitest 主链路：15 个文件、112 个测试通过
```

第六版里还顺手修正了一个 runtime 类型边界：

```text
RuntimeFactories.createModelClient
  从返回 FakeModelClient
  改成返回 ModelClient
```

原因是 runtime 装配层不应该绑定 fake 模型实现。它只需要依赖 `ModelClient` 接口，这样测试模型、fake 模型、未来真实模型 SDK 适配器都可以通过同一个边界接入。

目标不是“为了换框架而换框架”，而是让后续 Agent 架构演进时有更好的测试体验：

```text
更好的 watch
更好的目录级运行
更好的 mock / spy
更好的错误展示
后续可接 coverage
```

## 当前状态

当前项目测试已经完成 Vitest 主链路迁移：

```text
测试框架：Vitest
测试文件：tests/**/*.test.ts
测试对象：src 源码
默认命令：npm.cmd test
```

`package.json` 当前脚本：

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "typecheck:test": "tsc --noEmit -p tsconfig.test.json",
    "build": "tsc -p tsconfig.json",
    "dev": "tsx src/entry/cli.ts",
    "pretest": "npm run typecheck",
    "test": "vitest run",
    "test:agent": "vitest run tests/agent",
    "test:config": "vitest run tests/config",
    "test:context": "vitest run tests/context",
    "test:coverage": "vitest run --coverage",
    "test:gateway": "vitest run tests/gateway",
    "test:hooks": "vitest run tests/hooks",
    "test:learning": "vitest run tests/learning",
    "test:lifecycle": "vitest run tests/runtime/lifecycle.test.ts",
    "test:memory": "vitest run tests/memory",
    "test:mcp": "vitest run tests/mcp",
    "test:model": "vitest run tests/model",
    "test:orchestration": "vitest run tests/orchestration",
    "test:permissions": "vitest run tests/permissions",
    "test:planning": "vitest run tests/planning",
    "test:plugins": "vitest run tests/plugins",
    "test:reflection": "vitest run tests/reflection",
    "test:runtime": "vitest run tests/runtime",
    "test:session": "vitest run tests/session",
    "test:skills": "vitest run tests/skills",
    "test:task-state": "vitest run tests/task-state",
    "test:team": "vitest run tests/team",
    "test:tools": "vitest run tests/tools",
    "test:vitest": "vitest run",
    "test:watch": "vitest"
  }
}
```

旧测试文件曾经是 `.mjs`，并且引用的是编译后的 `dist`：

```js
import { DefaultReplanner } from "../../dist/planning/index.js";
```

也就是说，旧链路测试流程是：

```text
npm.cmd test
  ↓
pretest: npm run build
  ↓
tsc 编译 src -> dist
  ↓
node --test 执行 tests/**/*.test.mjs
  ↓
测试 dist 产物
```

这套方案的优点是很稳，缺点是 TDD 体验弱，mock 和覆盖率也不够舒服。现在主链路已经改成 Vitest 直测 `src`，如果未来还想额外验证 `dist` 产物，可以单独加 `test:dist`，不要把它混回主测试入口。

## 需要修改哪些文件

### 1. package.json

需要新增依赖：

```json
{
  "devDependencies": {
    "vitest": "^x.y.z"
  }
}
```

第一版脚本曾经建议这样改：

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "typecheck:test": "tsc --noEmit -p tsconfig.test.json",
    "build": "tsc -p tsconfig.json",
    "dev": "tsx src/entry/cli.ts",
    "pretest": "npm run build",
    "test": "node --test \"tests/**/*.test.mjs\"",
    "test:vitest": "vitest run",
    "test:watch": "vitest"
  }
}
```

第一版不建议马上把 `test` 改成 `vitest run`。

原因：

```text
当前 node:test 已经稳定跑通 112 个测试。
先并行引入 Vitest，确认一致后再切默认 test。
node:test 脚本必须显式限制到 tests/**/*.test.mjs，否则它也会扫到 Vitest 的 .test.ts 文件。
```

### 2. package-lock.json

安装 `vitest` 后会自动更新。

命令：

```powershell
npm.cmd install -D vitest
```

如果要启用 coverage，还可能需要：

```powershell
npm.cmd install -D @vitest/coverage-v8
```

第一版先不装 coverage provider，也不加 `test:coverage` 脚本。等真正需要覆盖率时，再一起引入 `@vitest/coverage-v8`。

### 3. 新增 vitest.config.ts

建议新增：

```text
vitest.config.ts
```

第一版配置：

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

这表示：

```text
Vitest 第一版只跑真正的 Vitest .test.ts 测试
现有 .mjs 测试继续交给 node:test
```

### 4. 新增 tsconfig.test.json

因为第一版已经新增 `.test.ts`，所以需要给测试文件单独一份类型检查配置。主 `tsconfig.json` 仍然只管 `src`，测试类型检查走：

```powershell
npm.cmd run typecheck:test
```

新增：

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true,
    "types": ["node"],
  },
  "include": ["src/**/*.ts", "tests/**/*.test.ts", "vitest.config.ts"]
}
```

这样拆开的原因：

```text
主 tsconfig 继续只描述生产源码。
测试 tsconfig 额外包含 tests 和 vitest.config.ts。
```

### 5. tsconfig.json

第一版不改主配置。

当前主配置：

```json
{
  "compilerOptions": {
    "types": ["node"],
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

如果后续大量新增 `.test.ts`，继续维护 `tsconfig.test.json`，不要把测试文件塞进主 `tsconfig.json`。

### 6. 测试文件

第一版没有大规模改测试文件，只新增了一个 Vitest 示例文件：

```text
tests/orchestration/task-execution-evaluator.test.ts
```

它使用 Vitest API：

```ts
import { describe, expect, test } from "vitest";
```

并直接从源码导入：

```ts
import {
  evaluateTaskExecutionError,
  evaluateTaskExecutionReply,
  parseStructuredTaskExecutionResult,
} from "../../src/orchestration/index.js";
```

注意这里仍然写 `.js` 后缀，这是因为项目使用 `moduleResolution: "NodeNext"`。TypeScript 源码里也是这种 ESM 风格：

```text
源码阶段写 .js specifier
TypeScript / Vitest 负责解析到 .ts 文件
编译后 dist 里也能保持合法 ESM import
```

当前已经没有仍在旧链路里的 `.mjs` 测试文件。

第一版曾经采用的真实处理方式是：

```text
不要让 Vitest 直接 include 这些 .mjs 文件。
它们会继续由 node:test 执行。
每次正式迁移一个文件时，再把该文件改成 Vitest 风格 .test.ts。
```

第六版完成后，这条临时策略已经结束。

当前已经迁移到 Vitest 的 `.test.ts` 测试文件：

```text
tests/orchestration/task-execution-evaluator.test.ts
tests/config/settings-schema.test.ts
tests/planning/plan-schema.test.ts
tests/team/collaboration-schema.test.ts
tests/task-state/task-state.test.ts
tests/task-state/file-task-store.test.ts
tests/team/collaboration-log.test.ts
tests/team/collaboration-protocol.test.ts
tests/team/collaboration-history-window.test.ts
tests/team/role-task-executor.test.ts
tests/orchestration/orchestration.test.ts
tests/orchestration/orchestration-recover.test.ts
tests/planning/default-replanner.test.ts
tests/team/team-coordinator.test.ts
tests/runtime/runtime-bundle.test.ts
```

完全迁移后的写法：

```ts
import { describe, expect, test } from "vitest";
```

断言从：

```js
assert.equal(value, expected);
assert.deepEqual(value, expected);
assert.throws(() => fn(), SomeError);
await assert.rejects(() => promiseFn(), SomeError);
```

逐步变成：

```ts
expect(value).toBe(expected);
expect(value).toEqual(expected);
expect(() => fn()).toThrow(SomeError);
await expect(promiseFn()).rejects.toThrow(SomeError);
```

## 建议迁移顺序

### 第 1 步：并行接入 Vitest

修改：

```text
package.json
package-lock.json
vitest.config.ts
tsconfig.test.json
tests/orchestration/task-execution-evaluator.test.ts
```

先只新增一个 Vitest 示例测试，不删除原有 `.mjs` 测试。

验收：

```powershell
npm.cmd run typecheck
npm.cmd run typecheck:test
npm.cmd test
npm.cmd run test:vitest
```

目标：

```text
node:test 和 vitest 两套命令都能跑。
```

### 第 2 步：正式迁移最小测试文件

已完成。第一版新增了 Vitest 版本：

```text
tests/orchestration/task-execution-evaluator.test.ts
```

第二版确认语义一致后，已经删除旧版本：

```text
tests/orchestration/task-execution-evaluator.test.mjs
```

原因：

- 文件不算大。
- 主要是纯函数测试。
- 涉及 Zod 结构化任务结果，适合作为 Vitest 示例。

可选做法：

```text
确认 task-execution-evaluator.test.ts 覆盖旧 .mjs 的全部语义
删除 task-execution-evaluator.test.mjs
直接从 src 导入，而不是 dist
使用 vitest 的 test / expect
```

如果从 `src` 导入，要注意 ESM 路径：

```ts
import { evaluateTaskExecutionReply } from "../../src/orchestration/task-execution-evaluator";
```

Vitest 能处理 TypeScript，但需要我们统一导入风格。

### 第 3 步：迁移 schema 类测试

已完成。下面这些旧文件已经迁移成 `.test.ts` 并删除旧 `.mjs`：

```text
tests/config/settings-schema.test.mjs
  -> tests/config/settings-schema.test.ts

tests/planning/plan-schema.test.mjs
  -> tests/planning/plan-schema.test.ts

tests/team/collaboration-schema.test.mjs
  -> tests/team/collaboration-schema.test.ts
```

原因：

```text
schema 测试独立性强，迁移风险低。
```

### 第 4 步：迁移 store 类测试

已完成。下面这些旧文件已经迁移成 `.test.ts` 并删除旧 `.mjs`：

```text
tests/task-state/file-task-store.test.mjs
  -> tests/task-state/file-task-store.test.ts

tests/task-state/task-state.test.mjs
  -> tests/task-state/task-state.test.ts

tests/team/collaboration-log.test.mjs
  -> tests/team/collaboration-log.test.ts
```

注意点：

- 这些测试会读写临时文件。
- 继续使用 `mkdtemp` / `rm` 即可。
- 不需要 mock fs。

### 第 5 步：迁移 coordinator / runtime 大测试

已完成。最后迁移的是：

```text
tests/team/team-coordinator.test.mjs
tests/runtime/runtime-bundle.test.mjs
```

原因：

```text
这两个文件覆盖最多，先保持稳定。
等前面目录都迁完，再动它们。
```

第六版实际迁移结果：

```text
tests/team/team-coordinator.test.mjs
  -> tests/team/team-coordinator.test.ts

tests/runtime/runtime-bundle.test.mjs
  -> tests/runtime/runtime-bundle.test.ts
```

迁移完成后，项目里已经没有 `tests/**/*.test.mjs`。

## 是否要从 dist 改成 src

这是迁移时最关键的选择。

### 方案 A：继续测试 dist

优点：

- 最接近当前行为。
- 迁移成本低。
- 不影响当前 build -> test 流程。

缺点：

- TDD 慢，改源码后要先 build。
- Vitest 的 TypeScript 直跑优势用不上。

### 方案 B：测试 src

优点：

- TDD 快。
- 可以直接写 `.test.ts`。
- 更符合 Vitest 的常见用法。

缺点：

- 要统一导入路径。
- 需要确认 NodeNext / ESM 下 Vitest 解析没坑。
- 测试的是源码，不再直接验证 dist 产物。

推荐路线已经完成：

```text
Vitest 测试 src，作为默认主链路。
pretest 先做 typecheck，保证生产源码类型正确。
测试专用类型检查继续走 typecheck:test。
如果未来需要验证 dist，再单独新增 test:dist。
```

最终可以形成：

```json
{
  "scripts": {
    "test": "vitest run",
    "test:dist": "npm run build && vitest run --config vitest.dist.config.ts",
    "test:watch": "vitest"
  }
}
```

这个最终形态不是第一版目标。第一版只做双轨并行。

## Mock 策略

Vitest 引入后，不要滥用 mock。

当前项目已经有很多好的 fake：

```text
FakeModelClient
InMemoryTaskStore
InMemoryCollaborationLog
fake gateway
fake mcp
fake task executor
```

原则：

```text
优先 fake class
需要观察调用次数时才用 vi.fn()
不要把核心状态流测试 mock 成空壳
```

适合 `vi.fn()` 的地方：

- hook 是否被调用。
- callback 是否被调用。
- 某个 executor 是否执行了几次。
- 某个 factory 是否被调用。

不适合 mock 的地方：

- TaskOrchestrator 状态推进。
- TaskSnapshot 写回。
- TeamCoordinator followUp 生成。
- Replanner 生成 revision。

这些应该继续用真实对象测状态流。

## Coverage 策略

第一版不强制覆盖率阈值。

后续可以加：

```json
{
  "scripts": {
    "test:coverage": "vitest run --coverage"
  }
}
```

建议优先关注这些目录：

```text
src/config
src/planning
src/orchestration
src/task-state
src/team
src/runtime
```

不要一开始追求全局数字。

更实际的目标：

```text
关键状态流必须有测试
关键协议 schema 必须有失败用例
关键恢复路径必须有测试
```

## 第一版改动清单

第一版只做这些：

```text
package.json
  - 增加 vitest devDependency
  - 增加 typecheck:test
  - 把 test 收窄成 node --test "tests/**/*.test.mjs"
  - 增加 test:vitest
  - 增加 test:watch

package-lock.json
  - npm install 自动更新

vitest.config.ts
  - 新增 vitest node 环境配置
  - include tests/**/*.test.ts

tsconfig.test.json
  - 新增测试专用类型检查配置

tests/orchestration/task-execution-evaluator.test.ts
  - 新增第一份 Vitest 风格示例测试
  - 先不删除原来的 .mjs 文件，避免旧链路测试数量减少

docs/integrations/vitest-testing-design.md
  - 更新迁移状态
```

第一版不做：

```text
不迁移所有测试文件
不删除 node:test
不把 test 默认命令切到 vitest
不强制 coverage 阈值
不重写所有 assert
```

## 第二版改动清单

第二版已经完成：从“复制一个 Vitest 示例”进入了“正式迁移一组测试”。

```text
tests/orchestration/task-execution-evaluator.test.mjs
  -> 已删除，语义迁移到 task-execution-evaluator.test.ts
```

同时迁移了 schema 类测试：

```text
tests/config/settings-schema.test.mjs
  -> tests/config/settings-schema.test.ts

tests/planning/plan-schema.test.mjs
  -> tests/planning/plan-schema.test.ts

tests/team/collaboration-schema.test.mjs
  -> tests/team/collaboration-schema.test.ts
```

第二版迁移时要注意：

```text
每迁一个文件，都要确认 node:test 数量减少是预期的。
对应 Vitest 数量要补回来，不能丢断言。
```

第二版验证结果：

```text
npm.cmd run typecheck
npm.cmd run typecheck:test
npm.cmd test
  84 个 node:test 测试通过
npm.cmd run test:vitest
  4 个 Vitest 文件、28 个测试通过
```

## 第三版改动清单

第三版已经完成：迁移 store 类测试，并保留真实文件读写行为。

```text
tests/task-state/task-state.test.mjs
  -> tests/task-state/task-state.test.ts

tests/task-state/file-task-store.test.mjs
  -> tests/task-state/file-task-store.test.ts

tests/team/collaboration-log.test.mjs
  -> tests/team/collaboration-log.test.ts
```

第三版保留的测试策略：

```text
不 mock fs
继续用 mkdtemp / rm 创建临时目录
继续验证跨实例读取
继续验证读取坏 JSON / 坏快照时会抛 schema error
```

第三版新增的 TypeScript 注意点：

```text
测试 fixture 要显式标注 TaskPlan / CollaborationEnvelope 这类领域类型。
故意构造坏数据时，可以局部使用 as any 或类型断言，表示这里模拟外部不可信输入。
从存储层读出的 payload 如果类型是 unknown，测试里要先做局部断言，再访问字段。
```

第三版验证结果：

```text
npm.cmd run typecheck
npm.cmd run typecheck:test
npm.cmd test
  66 个 node:test 测试通过
npm.cmd run test:vitest
  7 个 Vitest 文件、46 个测试通过
```

## 第四版改动清单

第四版已经完成：迁移轻量协作测试。

```text
tests/team/collaboration-protocol.test.mjs
  -> tests/team/collaboration-protocol.test.ts

tests/team/collaboration-history-window.test.mjs
  -> tests/team/collaboration-history-window.test.ts

tests/team/role-task-executor.test.mjs
  -> tests/team/role-task-executor.test.ts
```

第四版保留的测试策略：

```text
协议工具测试继续验证深拷贝和终态判断。
历史窗口测试继续验证连续 blocker / 连续 review failed 模式识别。
RoleTaskExecutor 测试继续使用 CapturingModelClient 捕获最终 user prompt，不 mock AgentLoop 内部流程。
```

第四版新增的 TypeScript 注意点：

```text
带私有字段的 class 不能用普通对象冒充，例如 McpClientManager。
这种情况下直接 new McpClientManager([])，比强行 as any 更稳。
测试里的 fake model 可以实现 ModelClient，只捕获最后一条 user message。
```

第四版验证结果：

```text
npm.cmd run typecheck
npm.cmd run typecheck:test
npm.cmd test
  58 个 node:test 测试通过
npm.cmd run test:vitest
  10 个 Vitest 文件、54 个测试通过
```

## 第五版改动清单

第五版已经完成：迁移中等复杂度的 orchestration / replanner 测试。

```text
tests/orchestration/orchestration.test.mjs
  -> tests/orchestration/orchestration.test.ts

tests/orchestration/orchestration-recover.test.mjs
  -> tests/orchestration/orchestration-recover.test.ts

tests/planning/default-replanner.test.mjs
  -> tests/planning/default-replanner.test.ts
```

第五版保留的测试策略：

```text
TaskOrchestrator 测试继续使用 InMemoryTaskStore，验证真实状态推进。
recover 测试继续验证 in_progress -> pending 的跨命令恢复语义。
DefaultReplanner 测试继续验证保留 completed 任务、插入 unblock 任务、生成新 revision。
```

第五版新增的 TypeScript 注意点：

```text
TaskPlan 类型来自 planning 层。
ActivePlanState 类型来自 task-state 层。
这说明“计划定义”和“执行快照状态”是两个边界，不要混在一个模块理解。
```

第五版验证结果：

```text
npm.cmd run typecheck
npm.cmd run typecheck:test
npm.cmd test
  48 个 node:test 测试通过
npm.cmd run test:vitest
  13 个 Vitest 文件、64 个测试通过
```

## 第六版改动清单

第六版已经完成：迁移最后两个大测试，并把默认测试命令切到 Vitest。

```text
tests/team/team-coordinator.test.mjs
  -> tests/team/team-coordinator.test.ts

tests/runtime/runtime-bundle.test.mjs
  -> tests/runtime/runtime-bundle.test.ts
```

同时更新：

```text
package.json
  - pretest 从 npm run build 改为 npm run typecheck
  - test 从 node --test "tests/**/*.test.mjs" 改为 vitest run
  - 保留 test:vitest，方便显式运行 Vitest

src/runtime/factories/runtime-factories.ts
src/runtime/runtime-bundle.ts
src/runtime/factories/model-factory.ts
  - createModelClient 返回类型统一为 ModelClient
  - runtime.model 类型统一为 ModelClient
```

第六版保留的测试策略：

```text
TeamCoordinator 测试继续覆盖 owner 分配、review plan、runnable batch、followUp、escalation。
RuntimeBundle 测试继续覆盖生命周期、runtime 装配、任务执行、批量执行、协作日志、review、followUp、replan、恢复、启动失败回滚。
测试 fake 继续保持在测试文件内，不把测试替身泄漏到生产架构。
```

第六版新增的 TypeScript 注意点：

```text
旧 JS 测试里的 fake class 需要显式声明字段和方法返回类型。
模型测试替身应该实现 ModelClient，而不是假装自己是 FakeModelClient。
带 private 字段的真实 class 不适合用普通对象冒充；测试中需要局部类型断言或更清晰的接口边界。
payload 从协作日志读出来后，如果类型是 unknown / {}，测试要先断言成 EscalationNotice / BlockerReport 等协议类型，再访问字段。
```

第六版验证结果：

```text
npm.cmd run typecheck
  通过

npm.cmd run typecheck:test
  通过

npm.cmd test
  Vitest 主链路：15 个文件、112 个测试通过
```

## 第七版增强项

第七版不是迁移，而是在 Vitest 已经成为主测试入口之后，补工程体验。

这版新增两类能力：

```text
覆盖率报告
按模块运行测试
```

### 1. 覆盖率报告

新增依赖：

```text
@vitest/coverage-v8
```

它是 Vitest 官方配套的 V8 覆盖率 provider。这里没有手写覆盖率逻辑，因为覆盖率统计属于通用工程能力，优先使用成熟方案。

新增命令：

```powershell
npm.cmd run test:coverage
```

对应脚本：

```json
{
  "test:coverage": "vitest run --coverage"
}
```

当前 coverage 配置：

```ts
coverage: {
  provider: "v8",
  reporter: ["text", "html"],
  include: ["src/**/*.ts"],
  exclude: [
    "src/**/index.ts",
    "src/entry/**",
    "src/**/*.d.ts",
  ],
  reportsDirectory: "coverage",
}
```

这样配置的原因：

```text
include 只统计 src 源码，不统计测试文件。
exclude 排除 index.ts 这种纯导出文件，避免覆盖率被门面文件稀释。
entry 入口当前主要是 CLI 接线层，后续等入口测试完善后再纳入覆盖率。
reporter 同时输出 text 和 html，终端能快速看摘要，也能打开 coverage/index.html 看详情。
coverage/ 已经在 .gitignore 里，不会进入提交。
```

### 2. 按模块运行测试

新增命令：

```powershell
npm.cmd run test:config
npm.cmd run test:gateway
npm.cmd run test:learning
npm.cmd run test:lifecycle
npm.cmd run test:memory
npm.cmd run test:mcp
npm.cmd run test:model
npm.cmd run test:planning
npm.cmd run test:orchestration
npm.cmd run test:permissions
npm.cmd run test:reflection
npm.cmd run test:runtime
npm.cmd run test:task-state
npm.cmd run test:team
npm.cmd run test:tools
```

对应脚本：

```json
{
  "test:config": "vitest run tests/config",
  "test:gateway": "vitest run tests/gateway",
  "test:learning": "vitest run tests/learning",
  "test:lifecycle": "vitest run tests/runtime/lifecycle.test.ts",
  "test:memory": "vitest run tests/memory",
  "test:mcp": "vitest run tests/mcp",
  "test:model": "vitest run tests/model",
  "test:planning": "vitest run tests/planning",
  "test:orchestration": "vitest run tests/orchestration",
  "test:permissions": "vitest run tests/permissions",
  "test:reflection": "vitest run tests/reflection",
  "test:runtime": "vitest run tests/runtime",
  "test:task-state": "vitest run tests/task-state",
  "test:team": "vitest run tests/team",
  "test:tools": "vitest run tests/tools"
}
```

这样做的价值：

```text
学习 runtime 时，只跑 runtime 测试。
学习 team coordinator 时，只跑 team 测试。
改 replanner / planner 时，只跑 planning 测试。
改任务快照或文件存储时，只跑 task-state 测试。
改 memory / tools / permissions 这类基础边界时，只跑对应模块测试。
改 learning / reflection / lifecycle 这类状态沉淀或生命周期逻辑时，只跑对应模块测试。
改 mcp / model / gateway 这类外部连接边界时，只跑对应模块测试。
```

这不是替代 `npm.cmd test`，而是开发过程中的局部反馈工具。正式收尾仍然跑完整测试。

第七版验证结果：

```text
npm.cmd run typecheck
  通过

npm.cmd run typecheck:test
  通过

npm.cmd test
  Vitest 主链路：15 个文件、112 个测试通过

npm.cmd run test:runtime
  runtime 模块：1 个文件、38 个测试通过

npm.cmd run test:team
  team 模块：6 个文件、27 个测试通过

npm.cmd run test:coverage
  覆盖率报告生成成功
  Statements: 82.31%
  Branches: 68.64%
  Functions: 87.52%
  Lines: 82.23%
```

## 第八版覆盖补强

第八版继续增强 Vitest，但这次不是加工具，而是补低覆盖基础模块的测试。

新增测试文件：

```text
tests/memory/in-memory-store.test.ts
tests/tools/tool-registry.test.ts
tests/tools/memory-tools.test.ts
tests/permissions/permission-checker.test.ts
```

覆盖的能力：

```text
InMemoryStore
  - 默认 scope / confidence
  - 自定义 scope / sourceLearningId / confidence
  - 相同 key 覆盖
  - readAll 更新时间倒序
  - key/content 大小写不敏感搜索
  - 空 query 返回全部

ToolRegistry
  - 注册和 get
  - schema 生成
  - readOnly / parameters 默认值
  - call 时传入 args 和 context
  - 未知工具返回失败结果而不是抛异常

MemoryTools
  - memory.remember 写入长期记忆
  - key 为空时使用 default
  - content 为空时返回失败
  - memory.recall 格式化结果
  - 没有结果时返回友好提示

PermissionChecker
  - 未知工具禁止执行
  - full_auto 允许写入型工具
  - plan 允许只读工具
  - plan 禁止写入型工具
  - default 当前临时允许写入型工具
```

这版的学习点：

```text
补 coverage 不是只追数字，而是优先补“基础边界”的行为。
memory / tools / permissions 都是后续 Agent 主循环会依赖的底层能力。
底层能力越稳定，后面改 runtime / team / orchestration 时越不容易被隐性 bug 牵着走。
```

新增模块脚本：

```json
{
  "test:memory": "vitest run tests/memory",
  "test:permissions": "vitest run tests/permissions",
  "test:tools": "vitest run tests/tools"
}
```

第八版验证结果：

```text
npm.cmd run typecheck:test
  通过

npm.cmd run test:memory
  memory 模块：1 个文件、4 个测试通过

npm.cmd run test:tools
  tools 模块：2 个文件、7 个测试通过

npm.cmd run test:permissions
  permissions 模块：1 个文件、4 个测试通过

npm.cmd test
  Vitest 主链路：19 个文件、127 个测试通过

npm.cmd run test:coverage
  覆盖率报告生成成功
  Statements: 84.12%
  Branches: 71.06%
  Functions: 89.54%
  Lines: 84.09%
```

## 第九版覆盖补强

第九版继续补低覆盖但边界清晰的状态模块：

```text
learning
reflection
runtime lifecycle
```

新增测试文件：

```text
tests/learning/in-memory-learning-store.test.ts
tests/reflection/reflection-loop.test.ts
tests/runtime/lifecycle.test.ts
```

覆盖的能力：

```text
InMemoryLearningStore
  - record 自动补齐 id / createdAt
  - 默认 confidence / status
  - 显式 status 覆盖
  - markStatus 更新已有记录
  - markStatus 找不到记录时返回 undefined
  - recent 默认返回最近 5 条
  - recent 按新到旧排序

ReflectionLoop
  - enabled=false 时只保留学习记录
  - “记住”类用户输入提升为长期记忆
  - 已存在长期记忆时不重复写入
  - 可复用流程提升为 skill
  - 没有可提升内容时保留在经验候选区

Runtime Lifecycle
  - onStart 按注册顺序执行
  - onStop / onDispose 按反向顺序执行
  - 缺少 hook 的组件也能穿透完成
  - hook 失败时抛 LifecycleExecutionError
  - 错误对象保留 phase / componentName / completed
  - 非 Error 类型的失败原因也能格式化进错误消息
```

新增模块脚本：

```json
{
  "test:learning": "vitest run tests/learning",
  "test:reflection": "vitest run tests/reflection",
  "test:lifecycle": "vitest run tests/runtime/lifecycle.test.ts"
}
```

这版的学习点：

```text
learning 是经验候选区，重点测默认值、状态变更和最近记录顺序。
reflection 是“学习 -> 长期资产”的提升层，重点测 memory / skill 的沉淀边界。
lifecycle 是 runtime 装配安全网，重点测启动顺序、停止顺序和失败时的 completed 快照。
```

第九版验证结果：

```text
npm.cmd run typecheck:test
  通过

npm.cmd run test:learning
  learning 模块：1 个文件、4 个测试通过

npm.cmd run test:reflection
  reflection 模块：1 个文件、5 个测试通过

npm.cmd run test:lifecycle
  lifecycle 测试：1 个文件、5 个测试通过

npm.cmd test
  Vitest 主链路：22 个文件、141 个测试通过

npm.cmd run test:coverage
  覆盖率报告生成成功
  Statements: 85.70%
  Branches: 72.34%
  Functions: 90.45%
  Lines: 85.65%
```

## 第十版覆盖补强

第十版继续补外部连接边界层：

```text
mcp
model
gateway
```

新增测试文件：

```text
tests/mcp/mcp-client-manager.test.ts
tests/model/fake-model-client.test.ts
tests/gateway/gateway-adapters.test.ts
```

覆盖的能力：

```text
McpClientManager
  - 构造时只保留 enabled server
  - 初始 connected=false
  - start 后全部 enabled server connected=true
  - stop / dispose 后连接状态回到 false
  - listServers 返回新数组，避免调用方增删数组影响内部列表

FakeModelClient
  - tool 消息后基于工具结果回复
  - 任务执行提示返回结构化 JSON 代码块
  - 用户要求“记住”时调用 memory.remember
  - 没有 memory.remember 时解释不能保存长期记忆
  - 用户询问偏好时调用 memory.recall
  - 普通对话会带上当前长期记忆数量

GatewayAdapter / GatewayManager
  - WebGatewayAdapter 启停、重复 start 幂等、端口读取
  - disabled adapter start 后保持未运行
  - MessagingGatewayAdapter 保留平台名和 tokenEnv
  - GatewayManager list 展示所有 gateway
  - GatewayManager start 只启动 enabled gateway
  - GatewayManager stop 返回停止前正在运行的 gateway
  - GatewayManager dispose 返回 dispose 前状态并清理运行状态
  - createHandler 把 gateway 输入文本转交给 runAgent
```

新增模块脚本：

```json
{
  "test:mcp": "vitest run tests/mcp",
  "test:model": "vitest run tests/model",
  "test:gateway": "vitest run tests/gateway"
}
```

这版的学习点：

```text
mcp / model / gateway 都是未来会替换成真实外部集成的边界。
第一版测试不需要模拟真实网络，而是先固定“启停状态、输入输出、适配器契约”。
这样后续接真实 MCP client、真实模型 SDK、真实 HTTP gateway 时，只要保持这些契约不破坏，上层 runtime 就更稳。
```

第十版验证结果：

```text
npm.cmd run typecheck:test
  通过

npm.cmd run test:mcp
  mcp 模块：1 个文件、4 个测试通过

npm.cmd run test:model
  model 模块：1 个文件、6 个测试通过

npm.cmd run test:gateway
  gateway 模块：1 个文件、7 个测试通过

npm.cmd test
  Vitest 主链路：25 个文件、158 个测试通过

npm.cmd run test:coverage
  覆盖率报告生成成功
  Statements: 87.08%
  Branches: 74.11%
  Functions: 92.29%
  Lines: 86.88%
```

## 第十一版覆盖补强

第十一版继续补输入整理和分发边界：

```text
config-loader
plan-normalizer
task-executor-registry
```

新增测试文件：

```text
tests/config/config-loader.test.ts
tests/planning/plan-normalizer.test.ts
tests/team/task-executor-registry.test.ts
```

覆盖的能力：

```text
config-loader
  - default < file < env < overrides 的配置优先级
  - 显式相对 configPath 解析
  - 文件配置只覆盖局部字段，未覆盖字段保留默认值
  - 环境变量解析成 provider / mode / boolean / number
  - 不存在配置文件时报错
  - 非对象 JSON 配置时报错
  - 非法端口和非法权限模式时报错
  - mergeSettings 深合并对象
  - 数组字段按 override 整体替换

plan-normalizer
  - 半成品计划补齐 planId / summary / status / 时间
  - 任务补齐 id / description / status / priority / owner
  - assumptions / constraints / acceptance / dependsOn / relatedPaths 清理空值并去重
  - 保留显式字段
  - 根据标题和描述推断 analysis / implementation / verification / documentation / coordination
  - acceptance 为空时生成默认验收标准
  - 导出的合法枚举列表保持稳定

task-executor-registry
  - register 后可以按 owner get
  - list 按注册顺序返回 executor
  - 同 owner 重复注册会替换旧 executor
  - resolve 优先返回精确 executor
  - resolve 找不到目标 owner 时回退 main executor
  - 没有目标 owner 且没有 main fallback 时抛明确错误
```

这版的学习点：

```text
config-loader 是外部配置进入系统的入口，重点测试优先级和类型转换。
plan-normalizer 是 planner/replanner 输出进入正式计划前的整理层，重点测试默认值和推断规则。
task-executor-registry 是多 Agent 角色分发的轻量注册表，重点测试精确匹配和 main fallback。
```

这三组不新增单独脚本，继续使用已有模块脚本：

```powershell
npm.cmd run test:config
npm.cmd run test:planning
npm.cmd run test:team
```

第十一版验证结果：

```text
npm.cmd run typecheck:test
  通过

npm.cmd run test:config
  config 模块：2 个文件、12 个测试通过

npm.cmd run test:planning
  planning 模块：3 个文件、13 个测试通过

npm.cmd run test:team
  team 模块：7 个文件、32 个测试通过

npm.cmd test
  Vitest 主链路：28 个文件、173 个测试通过

npm.cmd run test:coverage
  覆盖率报告生成成功
  Statements: 89.65%
  Branches: 79.34%
  Functions: 93.76%
  Lines: 89.52%
```

## 第十二版覆盖补强

第十二版继续补 Agent 主循环外围的基础积木：

```text
agent
context
hooks
plugins
session
skills
```

新增或纳入记录的测试文件：

```text
tests/agent/agent-loop.test.ts
tests/context/context-builder.test.ts
tests/hooks/hook-runner.test.ts
tests/plugins/plugin-registry.test.ts
tests/session/session-state.test.ts
tests/skills/skill-registry.test.ts
```

覆盖的能力：

```text
AgentLoop
  - 模型直接回复时记录 user / assistant 消息
  - learningEnabled=false 时不污染学习记录
  - 工具调用被允许时执行工具、写入 tool 消息、触发 tool hooks
  - plan 权限拒绝写入型工具时，把拒绝原因作为 tool 消息返回给模型
  - 工具循环超过 maxToolRounds 时主动停下
  - 用户输入包含“记住”时使用更高学习置信度

ContextBuilder
  - 汇总 session messages
  - 汇总 recent learning
  - 汇总 long-term memory
  - 汇总 skills
  - 只纳入 enabled plugins
  - 汇总 MCP server 状态
  - 汇总 tool schemas

HookRunner
  - 没有 handler 时 emit 可安全穿透
  - 同一事件 handler 按注册顺序串行执行
  - emit 会自动补 event 字段
  - 不同事件互不影响
  - handler 抛错时 emit 失败，并停止后续 handler

PluginRegistry
  - register / list / enabled
  - 同名插件重复注册会替换旧版本
  - startEnabled 只启动启用插件
  - stopEnabled / disposeEnabled 按反向顺序执行
  - stopPlugins / disposePlugins 只处理传入列表

SessionState
  - sessionId 显式传入或自动生成
  - turnNumber 从 0 开始递增
  - 按顺序记录 user / assistant / tool 消息
  - getMessages 返回新数组，避免调用方增删数组污染 session

SkillRegistry
  - register / get / list
  - 同名技能重复注册会替换旧版本
  - createDefaultSkillRegistry 注册 memory-basics 默认技能
```

新增模块脚本：

```json
{
  "test:agent": "vitest run tests/agent",
  "test:context": "vitest run tests/context",
  "test:hooks": "vitest run tests/hooks",
  "test:plugins": "vitest run tests/plugins",
  "test:session": "vitest run tests/session",
  "test:skills": "vitest run tests/skills"
}
```

这版的学习点：

```text
AgentLoop 是执行内核，但它依赖很多外围基础积木。
ContextBuilder 决定模型“看见什么”。
HookRunner 决定生命周期和工具事件如何被外部扩展。
PluginRegistry / SkillRegistry 是后续插件和技能系统的最小注册表。
SessionState 是一轮轮对话能够持续推进的消息容器。

这些模块本身不复杂，但它们一旦出错，后面的 planner / runtime / team coordinator 都会被拖偏。
所以补测试时不要只盯大模块，也要把这些基础边界固定住。
```

第十二版验证结果：

```text
npm.cmd run typecheck
  通过

npm.cmd run typecheck:test
  通过

npm.cmd run test:agent
  agent 模块：1 个文件、5 个测试通过

npm.cmd run test:context
  context 模块：1 个文件、1 个测试通过

npm.cmd run test:hooks
  hooks 模块：1 个文件、4 个测试通过

npm.cmd run test:plugins
  plugins 模块：1 个文件、5 个测试通过

npm.cmd run test:session
  session 模块：1 个文件、4 个测试通过

npm.cmd run test:skills
  skills 模块：1 个文件、3 个测试通过

npm.cmd run test:task-state
  task-state 模块：2 个文件、16 个测试通过

npm.cmd test
  Vitest 主链路：34 个文件、198 个测试通过

npm.cmd run test:coverage
  覆盖率报告生成成功
  Statements: 91.08%
  Branches: 81.51%
  Functions: 94.67%
  Lines: 90.99%
```

## 第十三版覆盖补强

第十三版继续补覆盖率报告里偏低、但边界清晰的模块：

```text
planning/default-planner
planning/plan-validator
runtime/factories
orchestration/task-orchestrator 分支
```

新增或扩展的测试文件：

```text
tests/planning/default-planner.test.ts
tests/planning/plan-validator.test.ts
tests/runtime/runtime-factories.test.ts
tests/orchestration/orchestration.test.ts
```

覆盖的能力：

```text
DefaultPlanner
  - 生成 analysis -> implementation -> verification 三段式计划
  - currentSummary 会进入 assumptions
  - relevantPaths 只取前 4 个作为共享路径
  - 缺少 relevantPaths / availableTools 时返回 warnings
  - 文档类目标会把核心任务识别为 documentation
  - 文档类目标会额外生成“更新相关文档”任务

plan-validator
  - validateTaskPlan 对合法计划返回空 issues
  - 聚合 plan 层和 task 层业务错误
  - 检查空 tasks
  - 检查重复 taskId
  - 检查缺失依赖
  - 检查自依赖
  - assertValidTaskPlan 会先走结构校验，再走业务校验

runtime factories
  - createMemoryStore 创建 InMemoryStore，并传入 defaultConfidence
  - createMemoryStore 拒绝未实现 provider
  - createModelClient 创建 FakeModelClient
  - createModelClient 拒绝 openai-compatible 等未实现 provider
  - createGatewayManager / createMcpClientManager 创建对应管理器
  - createTaskStore / createTaskOrchestrator 创建任务存储和默认编排器
  - createDefaultRuntimeFactories 暴露 runtime 装配所需的全部工厂函数

TaskOrchestrator
  - 没有 active plan 时抛明确错误
  - completed 计划再次 startNext 时保持 completed
  - failed 计划再次 startNext 时保持 failed
  - blocked 任务存在且没有 runnable 任务时保持 paused
  - recover 在没有遗留 in_progress 任务时不改任务状态
  - startTask 拒绝依赖未满足的任务
  - startTask 拒绝非 pending 任务
  - startTask 遇到已 in_progress 任务时复用当前状态，不重复启动
  - retryTask 可以重试 failed 任务，并补 synthetic lastExecution
```

这版的学习点：

```text
1. Zod 结构校验和业务校验是两层。

   例如 planId 为空这种问题，已经会被 Zod schema 拦截，
   不会继续进入 PlanValidationError。

   所以测试业务校验时，应该构造“结构合法但业务非法”的数据，
   例如重复 taskId、缺失依赖、自依赖。

2. factory 测试不是为了证明 new 能用。

   它主要固定“provider 选择”和“依赖边界”：
   fake provider 现在能创建，未实现 provider 必须明确报错。

3. TaskOrchestrator 的状态机测试要覆盖终态和非法动作。

   happy path 只能证明流程能跑通。
   completed / failed / paused / no active / dependency not completed 这些边界，
   才能防止后续改多 Agent 调度时把状态机改松。
```

第十三版验证结果：

```text
npm.cmd run typecheck
  通过

npm.cmd run typecheck:test
  通过

npm.cmd run test:planning
  planning 模块：5 个文件、20 个测试通过

npm.cmd run test:runtime
  runtime 模块：3 个文件、49 个测试通过

npm.cmd run test:orchestration
  orchestration 模块：3 个文件、26 个测试通过

npm.cmd test
  Vitest 主链路：37 个文件、218 个测试通过

npm.cmd run test:coverage
  覆盖率报告生成成功
  Statements: 92.65%
  Branches: 84.16%
  Functions: 95.41%
  Lines: 92.51%
```

## 第十四版覆盖补强

第十四版继续补剩余较明显的 runtime 守卫分支和 task-state schema 失败路径：

```text
runtime/runtime-bundle guards
task-state/task-state-schema
```

新增测试文件：

```text
tests/runtime/runtime-bundle-guards.test.ts
tests/task-state/task-state-schema.test.ts
```

覆盖的能力：

```text
RuntimeBundle guards
  - start 已经 ready 时幂等，不重复启动 gateway / mcp
  - stop 已经 stopped 时幂等，不重复停止
  - dispose 已经 disposed 时幂等，不重复销毁
  - disposed 后再次 start 会报明确错误
  - created 状态直接 stop 会进入 stopped
  - 没有 active plan 时，coordination / replan / retry / resume 入口都返回明确错误
  - replan 会拒绝不存在的任务、非 blocked 任务、没有 blocked 任务的计划
  - retry 会拒绝不存在的任务、非 blocked/failed 任务、没有可 retry 任务的计划
  - executeCurrentTask 遇到没有 currentTask 的 action 会直接返回空执行结果
  - executeRunnableBatch 遇到没有 currentTask 的 action 会直接返回空 batch
  - driveFollowUp 覆盖 no followUp / manual / 缺少源任务 / 计划已完成 等停止分支

TaskStateSchema
  - parseActivePlanStateShape 可以解析完整 lastExecution
  - lastExecution 包含 followUp / escalation / actor / reviews 时也能通过
  - plan.planId / snapshot.planId 不一致会失败
  - plan.goal / snapshot.goal 不一致会失败
  - plan.tasks 和 snapshot.tasks 集合不一致会失败
  - plan.status 和 snapshot.status 不一致会失败
  - runnableTaskIds 重复或引用不存在任务会失败
  - 未知字段和非法嵌套枚举会失败
  - parseArchivedPlanStateShape 校验 archivedAt / archiveReason
  - parseArchivedPlanStateListShape 校验归档列表
```

这版的学习点：

```text
1. Runtime 的守卫测试不只是“报错测试”。

   它固定的是入口边界：
   什么时候能 start / stop / dispose，
   没有 active plan 时哪些入口必须立即拒绝，
   自动 followUp 在什么情况下应该停止。

   这类测试会保护后续接 Gateway、桌面端、持续在线平台层时不把状态机改松。

2. task-state schema 是持久化快照的防线。

   TypeScript interface 只在编译期有用，真正从文件、history、archive 读回来的数据仍然不可信。
   所以 active/archive 快照必须用运行时 schema 校验：
   结构错要拦，跨字段关系错也要拦。

3. schema 测试要同时覆盖“结构字段”和“跨字段不变式”。

   例如 taskId 是否为空是结构字段；
   plan.tasks 和 snapshot.tasks 是否一一对应，则是跨字段不变式。
```

第十四版验证结果：

```text
npm.cmd run typecheck
  通过

npm.cmd run typecheck:test
  通过

npm.cmd run test:runtime
  runtime 模块：4 个文件、55 个测试通过

npm.cmd run test:task-state
  task-state 模块：3 个文件、21 个测试通过

npm.cmd test
  Vitest 主链路：39 个文件、229 个测试通过

npm.cmd run test:coverage
  覆盖率报告生成成功
  Statements: 94.08%
  Branches: 86.65%
  Functions: 95.77%
  Lines: 93.97%
```

## 第十五版分层命名整理

第十五版不是继续补覆盖率，而是把测试体系再往前整理一层：

```text
保留“按源码模块分目录”的结构
再增加“按测试层分组运行”的命名和脚本视角
```

为什么这样做：

```text
按模块分目录，适合改某个源码模块时快速定位测试。
按测试层分组，适合学习、排查、补测试时从“测试意图”出发。

也就是说：
tests/planning/plan-schema.test.ts
还是留在 planning 目录里
但它在运行层面属于 schema / pure logic 这一层。
```

第十五版确定的四层口径：

```text
1. schema / pure logic
2. store / persistence
3. orchestration / state flow
4. runtime / integration flow
```

### 1. schema / pure logic

这一层重点测：

```text
协议结构是否合法
枚举和字段裁剪是否正确
纯函数输出是否稳定
轻量规则判断是否正确
```

当前归入这一层的测试：

```text
tests/config/settings-schema.test.ts
tests/planning/plan-schema.test.ts
tests/planning/plan-validator.test.ts
tests/planning/plan-normalizer.test.ts
tests/planning/default-planner.test.ts
tests/orchestration/task-execution-evaluator.test.ts
tests/team/collaboration-schema.test.ts
tests/task-state/task-state-schema.test.ts
tests/permissions/permission-checker.test.ts
tests/hooks/hook-runner.test.ts
```

新增命令：

```powershell
npm.cmd run test:layer:schema
```

### 2. store / persistence

这一层重点测：

```text
内存/文件存储读写
副本隔离
归档与恢复
最近记录顺序
持久化边界
```

当前归入这一层的测试：

```text
tests/memory/in-memory-store.test.ts
tests/learning/in-memory-learning-store.test.ts
tests/task-state/task-state.test.ts
tests/task-state/file-task-store.test.ts
tests/team/collaboration-log.test.ts
tests/session/session-state.test.ts
```

新增命令：

```powershell
npm.cmd run test:layer:store
```

### 3. orchestration / state flow

这一层重点测：

```text
状态机推进
任务编排
角色分发
恢复语义
followUp / retry / replan 这类流程层行为
```

当前归入这一层的测试：

```text
tests/agent/agent-loop.test.ts
tests/reflection/reflection-loop.test.ts
tests/planning/default-replanner.test.ts
tests/orchestration/orchestration.test.ts
tests/orchestration/orchestration-recover.test.ts
tests/team/collaboration-history-window.test.ts
tests/team/collaboration-protocol.test.ts
tests/team/role-task-executor.test.ts
tests/team/task-executor-registry.test.ts
tests/team/team-coordinator.test.ts
```

新增命令：

```powershell
npm.cmd run test:layer:orchestration
```

### 4. runtime / integration flow

这一层重点测：

```text
装配是否正确
跨模块协作是否成立
runtime 守卫是否稳定
外部适配边界是否一致
```

当前归入这一层的测试：

```text
tests/config/config-loader.test.ts
tests/context/context-builder.test.ts
tests/gateway/gateway-adapters.test.ts
tests/mcp/mcp-client-manager.test.ts
tests/model/fake-model-client.test.ts
tests/plugins/plugin-registry.test.ts
tests/skills/skill-registry.test.ts
tests/tools/tool-registry.test.ts
tests/tools/memory-tools.test.ts
tests/runtime/lifecycle.test.ts
tests/runtime/runtime-factories.test.ts
tests/runtime/runtime-bundle-guards.test.ts
tests/runtime/runtime-bundle.test.ts
```

新增命令：

```powershell
npm.cmd run test:layer:runtime
```

第十五版新增脚本：

```json
{
  "test:layer:schema": "vitest run ...",
  "test:layer:store": "vitest run ...",
  "test:layer:orchestration": "vitest run ...",
  "test:layer:runtime": "vitest run ..."
}
```

这版的学习点：

```text
测试分层不是为了制造第二套目录结构，而是为了增加第二套“阅读和运行视角”。

目录仍然跟着源码模块走：
  planning / runtime / team / task-state

但运行和学习时可以切换成层视角：
  schema
  store
  orchestration
  runtime

这样以后你想学：
  “协议和纯逻辑”
就跑 test:layer:schema

想学：
  “任务状态流和协作流”
就跑 test:layer:orchestration

想学：
  “整体装配和跨模块协作”
就跑 test:layer:runtime
```

第十五版验证结果：

```text
npm.cmd run test:layer:schema
  通过

npm.cmd run test:layer:store
  通过

npm.cmd run test:layer:orchestration
  通过

npm.cmd run test:layer:runtime
  通过

npm.cmd test
  通过
```

## 第十六版热点分支补强

第十六版重新回到 coverage 报告里的三个热点：

```text
planning/default-replanner
orchestration/task-orchestrator
runtime/runtime-bundle
```

这一版新增/扩展的测试文件：

```text
tests/planning/default-replanner.test.ts
tests/orchestration/orchestration.test.ts
tests/runtime/runtime-bundle-guards.test.ts
```

覆盖的能力：

```text
DefaultReplanner
  - relevantPaths 为空时会给 warning
  - 找不到 blocked task 时抛明确错误
  - unblock task id 与历史任务冲突时自动追加序号
  - 其他 failed 任务会被重置为 pending 并补 replan note

TaskOrchestrator
  - 已有 in_progress 任务时，startNext 返回 running message
  - 无 runnable 且无 blocked 时，返回“依赖未满足”的 paused 提示
  - 无 runnable 且存在 failed task 时，整张计划进入 failed
  - completed 状态下 pause 不再改动计划
  - complete / block / fail / retry 在非法状态下会抛明确错误

RuntimeBundle
  - start 失败时即便抛出的是非 Error，也会转成字符串写入 runtime:start-failed hook
  - previewReplanBlockedTask 的 diff 会记录 preservedCompletedTaskIds
```

这版的学习点：

```text
1. coverage 往后补时，不要只看“模块名”，要看“剩余分支是不是值得补”。

   例如 DefaultReplanner 的核心 happy path 早就通了，
   但 warning、异常路径、id 冲突这类边角位点，
   正是后续重构最容易被顺手弄坏的地方。

2. 状态机的质量，很多时候不是体现在 happy path，而是体现在“拒绝非法动作”。

   比如：
   - 还没 in_progress 就 complete
   - 没有 blocked/failed 却 retry
   - 已 completed 再 pause

   这些边界测住后，后面加多 Agent、并发 batch、恢复执行时才不容易把状态机搞松。

3. Runtime 里的内部 helper 不一定都值得为了覆盖率强行暴露。

   能通过公开 API 打到的分支优先补。
   像 replan diff 里的 preservedCompletedTaskIds，就适合通过 previewReplanBlockedTask 间接验证。
   但 removedTaskIds 这种如果当前公开流程根本不会产生，就没必要为了覆盖率去硬改生产接口。
```

第十六版验证结果：

```text
npm.cmd run typecheck:test
  通过

npm.cmd run test:planning
  planning 模块：5 个文件、23 个测试通过

npm.cmd run test:orchestration
  orchestration 模块：3 个文件、31 个测试通过

npm.cmd run test:runtime
  runtime 模块：4 个文件、57 个测试通过

npm.cmd test
  Vitest 主链路：39 个文件、239 个测试通过

npm.cmd run test:coverage
  覆盖率报告生成成功
  Statements: 94.99%
  Branches: 87.70%
  Functions: 95.96%
  Lines: 94.90%
```

## 第十七版覆盖率阈值

第十七版不再继续追着热点分支补测试，而是把当前已经跑出来的 coverage 成果固化成门槛：

```text
vitest.config.ts
  -> test.coverage.thresholds
```

这一版落下去的阈值是：

```text
statements: 92
branches: 85
functions: 94
lines: 92
```

为什么先定这一版，而不是一上来就把阈值顶到当前实际值附近：

```text
当前覆盖率已经是：
  Statements: 94.99%
  Branches: 87.70%
  Functions: 95.96%
  Lines: 94.90%

如果阈值直接贴着当前值设置，
后面哪怕只是正常重构、删掉一批重复测试、或者新增一个暂时未补齐分支的小模块，
也可能把主测试入口立刻卡死。

所以第一版 coverage threshold 的目标不是“逼近极限”，
而是先把明显的质量回退挡住。
```

这版选择的是“全局阈值”，没有开启 `perFile`：

```text
先检查整仓总体覆盖率
不要求每个文件单独过线
不给还在演进中的模块引入过重负担
```

原因是当前项目还处在快速演进期：

```text
我们最近还在持续补 runtime / orchestration / planning / team 这些核心模块，
如果现在就开 perFile，
会把很多“暂时合理、但还没补齐”的文件直接变成阻塞点。

先用全局门槛守底线，
等后面公共测试夹具整理完、测试结构再稳定一点，
再考虑第二版：
  - perFile
  - 更高 threshold
  - CI 强制校验
```

这版的学习点：

```text
1. coverage report 和 coverage threshold 不是一回事。

   report 只是告诉你“现在是多少”；
   threshold 才是把这个数字变成规则。

   没有 threshold 时，覆盖率再高，也只是一次性的观察结果。

2. 第一版阈值要先做“守底线”，不要一上来做“贴脸线”。

   如果阈值贴得太紧，团队会开始为了让数字过线而补测试，
   反而容易写出低价值、只为凑覆盖率的测试。

   更合理的节奏是：
   先把明显回退挡住，
   再随着测试夹具和测试结构成熟，逐步抬高。

3. perFile 是第二阶段能力，不是第一阶段必选项。

   全局 threshold 适合先固化测试体系总体质量；
   perFile 更适合测试结构稳定之后，再用来约束局部薄弱模块。
```

第十七版验证结果：

```text
npm.cmd run test:coverage
  覆盖率报告生成成功
  Statements: 94.99%
  Branches: 87.70%
  Functions: 95.96%
  Lines: 94.90%

  threshold:
    statements >= 92
    branches >= 85
    functions >= 94
    lines >= 92
```

## 第十八版公共测试夹具

第十八版不再直接补 coverage，而是把最近几轮反复出现的测试辅助对象收成第一版公共夹具：

```text
tests/helpers/task-plan-fixtures.ts
tests/helpers/task-state-fixtures.ts
tests/helpers/runtime-fixtures.ts
tests/helpers/temp-dir.ts
```

这一版抽出来的夹具分成四类：

```text
1. TaskPlan 夹具
   - createTaskItem
   - createTaskPlan
   - createSingleTaskPlan
   - createParallelGatewayPlan
   - createCircularDependencyPlan
   - createPreFailedPlan

2. TaskState 夹具
   - createActivePlanState

3. Runtime 夹具
   - createSilentSettings

4. 文件系统夹具
   - withTempDir
```

这次已经迁移到公共夹具的测试文件：

```text
tests/orchestration/orchestration.test.ts
tests/task-state/task-state.test.ts
tests/task-state/file-task-store.test.ts
tests/planning/plan-validator.test.ts
tests/task-state/task-state-schema.test.ts
tests/config/config-loader.test.ts
tests/team/collaboration-log.test.ts
tests/runtime/runtime-bundle.test.ts
tests/runtime/runtime-bundle-guards.test.ts
```

为什么先抽这一层，而不是一上来把所有 fake / builder 全部集中化：

```text
这次优先抽的是“跨目录重复、语义稳定、不会绑死单个测试文件”的夹具。

比如：
  TaskPlan 样例
  ActivePlanState 样例
  静默 runtime settings
  临时目录生命周期

这些东西已经在 planning / orchestration / task-state / runtime / config / team 之间重复出现，
而且语义边界相对稳定，抽出来会明显降低重复。

但像某些只服务于单个大测试文件的专用 fake model / fake gateway / fake executor，
现在还不急着抽。
如果过早抽成“万能测试框架”，
反而会把测试意图藏起来。
```

这版的学习点：

```text
1. 公共测试夹具要抽“语义稳定”的，不要抽“偶然相似”的。

   如果两个测试只是刚好都 new 了某个对象，
   但关注点完全不同，那不一定值得抽。

   真正适合进入 helpers 的，是那种：
   - 多个目录重复出现
   - 领域含义一致
   - 后续还会继续复用
   的测试数据和测试环境。

2. 夹具不只是省代码，更重要的是统一口径。

   例如 createTaskPlan / createActivePlanState 抽出来之后，
   后面 planning、orchestration、task-state 这些测试看到的“最小计划”就是同一套默认语义，
   这样后续改字段、补默认值、改边界时，不会每个测试文件各自漂移。

3. 文件系统类测试最适合先抽生命周期 helper。

   withTempDir 这种 callback 形式很适合文件测试：
   - 创建目录
   - 执行测试
   - 自动清理

   这样比每个测试各写一遍 mkdtemp + try/finally + rm 更稳，也更不容易漏清理。

4. 第一版公共夹具应该保守，不要急着做成“大而全测试框架”。

   这次没有去抽：
   - 所有 fake model
   - 所有 fake gateway
   - 所有 collaboration envelope builder

   不是因为它们永远不该抽，
   而是因为现在先把最稳定的底层夹具收住，收益最大、风险最小。
```

第十八版验证结果：

```text
npm.cmd run typecheck:test
  通过

npm.cmd run test:config
  2 个文件、12 个测试通过

npm.cmd run test:task-state
  3 个文件、21 个测试通过

npm.cmd run test:team
  7 个文件、32 个测试通过

npm.cmd run test:runtime
  4 个文件、57 个测试通过

npm.cmd run test:orchestration
  3 个文件、31 个测试通过

npm.cmd run test:planning
  5 个文件、23 个测试通过

npm.cmd test
  39 个文件、239 个测试通过

npm.cmd run test:coverage
  Statements: 94.99%
  Branches: 87.70%
  Functions: 95.96%
  Lines: 94.90%
```

## 第十九版测试工程能力补全

这一版不是继续追单个源码分支覆盖率，而是把 Vitest 作为“测试工程基础设施”再补完整一层：

```text
1. setupFiles
2. 自定义 matcher
3. perFile coverage
4. CI reporter
5. 公共测试夹具第二版
```

这一版新增/修改的核心文件：

```text
vitest.shared.ts
vitest.per-file.config.ts
vitest.ci.config.ts
vitest.config.ts
tsconfig.test.json
package.json
.gitignore

tests/setup/vitest.setup.ts
tests/setup/vitest.d.ts
tests/setup/custom-matchers.ts
tests/setup/custom-matchers.test.ts

tests/helpers/collaboration-fixtures.ts
tests/team/collaboration-schema.test.ts
tests/team/collaboration-protocol.test.ts
tests/team/collaboration-history-window.test.ts
tests/team/collaboration-log.test.ts
tests/team/role-task-executor.test.ts
tests/orchestration/orchestration.test.ts
tests/task-state/task-state.test.ts
```

### 1. setupFiles

这一层落在：

```text
tests/setup/vitest.setup.ts
```

当前做的事情很克制：

```ts
import { expect } from "vitest";
import { customMatchers } from "./custom-matchers.js";

expect.extend(customMatchers);
```

也就是说，`setupFiles` 现在先承担“全局测试装配入口”的角色，而不是一上来塞满所有副作用。

为什么要先加这层：

```text
没有 setupFiles 时，
每个测试文件如果都要自己 import / extend matcher，
很快就会出现：
  - 重复样板
  - 某些文件忘了注册 matcher
  - 全局测试能力分散在各个测试文件里

加了 setupFiles 之后，
Vitest 每次启动测试时都会先执行这一层，
后面全局 matcher、全局清理、统一 fake 初始化，都有了一个固定落点。
```

这一版故意没有往里面塞：

```text
不额外加全局 mock
不做强制 afterEach 清理
不做测试环境变量写死
```

原因很简单：现在先把“全局入口”立住，后面再按需要继续加内容，不要一开始把 setupFiles 变成黑盒。

### 2. 自定义 matcher

这一层落在：

```text
tests/setup/custom-matchers.ts
tests/setup/vitest.d.ts
tests/setup/custom-matchers.test.ts
```

这次先补了 3 个和当前任务快照语义直接相关的 matcher：

```text
toHaveSnapshotStatus(expectedStatus)
toHaveRunnableTaskIds(expectedTaskIds)
toHaveTaskSnapshot(taskId, expectedPartial)
```

它们解决的问题不是“更炫”，而是“把领域断言从细碎字段判断里提出来”。

以前测试里经常会出现：

```text
expect(snapshot.status).toBe("executing")
expect(snapshot.runnableTaskIds).toEqual(["t2"])
expect(snapshot.tasks[1]?.status).toBe("in_progress")
expect(snapshot.tasks[1]?.attemptCount).toBe(1)
```

这种写法当然没错，但读的时候会被实现细节拖住。

现在可以直接写成：

```ts
expect(state).toHaveSnapshotStatus("executing");
expect(state).toHaveRunnableTaskIds(["t2"]);
expect(state).toHaveTaskSnapshot("t2", {
  status: "in_progress",
  attemptCount: 1,
  assignedOwner: "worker",
  assignmentSource: "coordinator",
});
```

这样一眼就能看出测试真正关心的语义是：

```text
整个快照处于什么状态
当前哪些任务可运行
某个任务快照有哪些关键字段
```

`vitest.d.ts` 的作用也很关键：

```text
它不是“装饰文件”，而是把这些 matcher 补进 Vitest 的类型系统里。
没有它，运行时 matcher 虽然能用，但编辑器和 typecheck:test 不知道这些方法存在。
```

这一版的边界也很明确：

```text
现在只抽“高频、稳定、确实有领域语义”的 matcher。
不把所有断言都包装成 matcher。
```

### 3. perFile coverage

这一层落在：

```text
vitest.per-file.config.ts
vitest.shared.ts
package.json
```

新增命令：

```powershell
npm.cmd run test:coverage:per-file
```

这次不是只看整仓 coverage，而是把 `perFile` 真正打开：

```text
perFile: true
statements: 85
branches: 50
functions: 87
lines: 85
```

为什么这版阈值这样定，而不是更高：

```text
它的目标是让“每个文件都不能明显太薄”，
而不是现在就把所有边角模块硬压到同一条高线。

当前项目里像：
  defaults.ts
  planning-context.ts
  runtime-bundle.ts
这种文件，
它们的分支形态和职责边界并不完全一样。

所以第一版 perFile threshold 的策略是：
  - 先保证每个文件都有基本厚度
  - 先把特别薄的文件挡住
  - 后面再按目录或按 glob 慢慢抬线
```

这版跑下来的结果说明它不是纸面配置：

```text
npm.cmd run test:coverage:per-file
  40 个文件、240 个测试通过
  per-file threshold 通过
```

### 4. CI reporter

这一层落在：

```text
vitest.ci.config.ts
vitest.shared.ts
package.json
.gitignore
```

新增命令：

```powershell
npm.cmd run test:ci
```

CI 配置现在已经具备两类输出：

```text
1. junit
   -> reports/vitest/junit.xml

2. coverage reporter
   -> text
   -> json-summary
   -> cobertura
```

为什么要补这层：

```text
普通本地开发时，我们只需要在终端看测试是否通过；
但一旦接 CI、GitHub Actions、质量面板、测试历史记录，
就需要结构化产物，而不是只有控制台文本。

junit 适合给 CI 平台吃测试结果。
cobertura / json-summary 适合给覆盖率平台或后续脚本吃。
```

`pretest:ci` 现在也会先跑：

```powershell
npm.cmd run typecheck:test
```

这保证 CI 视角下不只是“运行时能过”，而是连测试类型系统也先过一遍。

这版真实验证结果：

```text
npm.cmd run test:ci
  40 个文件、240 个测试通过
  junit report 已生成:
    reports/vitest/junit.xml
```

### 5. 公共测试夹具第二版

这一版没有把 helpers 做成“大而全测试框架”，而是继续沿着“语义稳定、跨文件复用”的原则补第二版。

新增：

```text
tests/helpers/collaboration-fixtures.ts
```

这次抽出来的是协作协议相关夹具：

```text
createTaskHandoffEnvelope
createCompletionSummaryEnvelope
createReviewResultEnvelope
createBlockerReportEnvelope
createEscalationNoticeEnvelope
createCollaborationMessage
```

它们主要服务这些测试：

```text
tests/team/collaboration-schema.test.ts
tests/team/collaboration-protocol.test.ts
tests/team/collaboration-history-window.test.ts
tests/team/collaboration-log.test.ts
tests/team/role-task-executor.test.ts
```

这版还有一个很实际的设计点：

```text
协作夹具的 overrides 不是只允许“完全合法”的字段，
而是允许测试故意注入非法值和未知字段。
```

原因是 schema / persistence 测试本来就需要大量 negative case：

```text
非法 owner
非法 status
未知字段
kind / payload 不匹配
```

如果公共夹具只能生产“完美合法对象”，
那每次测坏数据都得在测试里强行写类型断言，反而会把负面用例写得又丑又散。

所以这一版公共夹具第二版的核心价值是：

```text
既统一合法协作消息的默认口径，
也允许我们优雅地构造外部不可信输入。
```

### 这一版形成的整体结构

到这里，Vitest 这条线已经从“能跑测试”进化成了比较完整的一套测试工程底座：

```text
test
  └─ 默认运行全部测试

setupFiles
  └─ 挂全局测试能力

custom matchers
  └─ 提升领域断言表达力

coverage threshold
  └─ 守整仓底线

perFile coverage
  └─ 守单文件底线

ci reporter
  └─ 产出 junit / cobertura / json-summary

helpers v1 + v2
  └─ 统一 TaskPlan / TaskState / Runtime / Collaboration 测试夹具
```

### 这版的学习点

```text
1. setupFiles 是“测试装配根”，不是“杂物间”。

   它最重要的价值不是代码行数多，而是给全局测试能力提供唯一稳定入口。

2. 自定义 matcher 的价值在于“提升领域语义可读性”，而不是“把 expect 写花哨”。

   适合抽 matcher 的，是那种会反复出现、并且能够直接表达领域状态的断言。

3. perFile coverage 和全局 coverage 是两层不同约束。

   全局 coverage 防止整仓倒退；
   perFile coverage 防止局部文件特别薄。

4. CI reporter 不是为了本地看着热闹，而是为了让测试结果进入自动化链路。

5. 公共测试夹具不只是“省重复代码”，更重要的是统一测试对象口径。

   第一版统一 TaskPlan / TaskState / Runtime；
   第二版统一 Collaboration envelope。

6. 负面测试也需要被设计。

   一个好的测试夹具，不只会生产 happy path 数据，
   还要允许我们合理地制造非法输入，去测 schema 和持久化防线。
```

### 第十九版验证结果

```text
npm.cmd run typecheck
  通过

npm.cmd run typecheck:test
  通过

npm.cmd test
  Vitest 主链路：40 个文件、240 个测试通过

npm.cmd run test:coverage:per-file
  40 个文件、240 个测试通过
  per-file threshold 通过

npm.cmd run test:ci
  40 个文件、240 个测试通过
  junit report 已写入 reports/vitest/junit.xml

当前 coverage:
  Statements: 94.99%
  Branches: 87.70%
  Functions: 95.96%
  Lines: 94.90%
```

## 第二十版测试工程增强

第二十版不是重开一条新线，而是在第十九版基础上把“还差一点工程味”的四件事真正补齐：

```text
1. 自定义 matcher 第二版
2. coverage 继续细化
3. CI 直接接入
4. 公共测试夹具第三版
```

这一版新增/修改的核心文件：

```text
tests/setup/custom-matchers.ts
tests/setup/vitest.d.ts
tests/setup/custom-matchers.test.ts

tests/helpers/agent-fixtures.ts
tests/helpers/model-fixtures.ts
tests/helpers/gateway-fixtures.ts
tests/helpers/runtime-fixtures.ts
tests/helpers/team-fixtures.ts

tests/agent/agent-loop.test.ts
tests/gateway/gateway-adapters.test.ts
tests/planning/default-planner.test.ts
tests/runtime/runtime-bundle-guards.test.ts
tests/runtime/runtime-bundle.test.ts
tests/runtime/runtime-factories.test.ts
tests/team/collaboration-protocol.test.ts
tests/team/collaboration-schema.test.ts
tests/team/role-task-executor.test.ts
tests/team/task-executor-registry.test.ts
tests/orchestration/orchestration.test.ts

vitest.shared.ts
vitest.coverage-thresholds.ts
vitest.per-file.config.ts
vitest.ci.config.ts
tsconfig.test.json

.github/workflows/ci.yml
```

### 1. 自定义 matcher 第二版

第十九版时，matcher 还主要集中在任务快照：

```text
toHaveSnapshotStatus
toHaveRunnableTaskIds
toHaveTaskSnapshot
```

第二十版继续把 matcher 扩到三类领域对象：

```text
Plan
  - toHavePlanStatus(expectedStatus)
  - toHavePlanTask(taskId, expectedPartial)

Collaboration
  - toHaveCollaborationKind(expectedKind)
  - toHaveCollaborationStatus(expectedStatus)
  - toHaveCollaborationPayload(expectedPartial)

Runtime
  - toHaveRuntimeStatus(expectedStatus)
```

为什么这一版值得做：

```text
当前项目已经不只是“任务快照状态机”了，
还包含：
  - 计划对象
  - 协作协议对象
  - runtime 生命周期对象

如果这些断言继续全部写成细碎字段访问，
测试能跑是能跑，但越来越不利于阅读。
```

这一版之后，测试里可以直接写：

```ts
expect(result.plan).toHavePlanStatus("ready");
expect(result.plan).toHavePlanTask("t2", {
  title: "处理核心变更",
  dependsOn: ["t1"],
});

expect(parsed).toHaveCollaborationKind("task-handoff");
expect(parsed).toHaveCollaborationPayload({
  taskTitle: "补 collaboration schema",
});

expect(runtime).toHaveRuntimeStatus("ready");
```

这类 matcher 解决的核心问题是：

```text
让测试关注领域语义，而不是被对象路径牵着走。
```

第二十版还做了一个很重要的收口：

```text
这些 matcher 都支持“包装对象”解析，
而不只支持裸对象本体。
```

例如：

```text
toHavePlanTask
  可以直接对 result.plan 断言
  也可以直接对 orchestration action result 断言

toHaveRuntimeStatus
  既支持 runtime.status
  也支持 runtime.getStatus()
```

也就是说，matcher 这一层已经开始具备“领域适配”能力，而不是单纯语法糖。

### 2. coverage 继续细化

第十九版已经有了：

```text
全局 threshold
perFile threshold
```

第二十版继续做的不是“盲目抬线”，而是把 coverage 阈值拆成：

```text
基础 per-file 底线
关键模块 / 关键 glob 细化阈值
```

这层现在集中放在：

```text
vitest.coverage-thresholds.ts
```

当前结构是：

```text
perFileCoverageThresholds
  -> 守住全文件最低线

scopedCoverageThresholds
  -> 对关键模块单独给更高要求

refinedCoverageThresholds
  -> 最终合并给 per-file / CI 配置
```

这次有个很真实的经验：

```text
“按目录统一抬线”在当前阶段太粗。
```

一开始如果直接写：

```text
src/team/**/*.ts
src/planning/**/*.ts
src/config/**/*.ts
```

Vitest 会把阈值逐个落到匹配到的文件上。
这会导致：

```text
一个目录里只要有一两个天然分支薄、但当前合理的文件，
整个目录规则就会变得很难用。
```

所以第二十版改成更细的关键模块 / 关键 glob：

```text
src/config/config-loader.ts
src/planning/default-*.ts
src/planning/plan-schema.ts
src/planning/plan-normalizer.ts
src/orchestration/task-orchestrator.ts
src/orchestration/task-execution-evaluator.ts
src/runtime/runtime-bundle.ts
src/task-state/*task-store.ts
src/team/default-team-coordinator.ts
```

也就是说，这一版的设计原则是：

```text
不要用粗目录阈值去惩罚还在演进中的边角文件；
优先把真正关键的核心模块先钉住。
```

### 3. CI 直接接入

第十九版时，`test:ci` 已经能在本地跑出：

```text
junit
cobertura
json-summary
```

但那时还只是“本地模拟 CI 配置”，并没有真正接进工作流。

第二十版新增：

```text
.github/workflows/ci.yml
```

现在这条工作流已经会真正执行：

```text
1. actions/checkout
2. actions/setup-node
3. npm ci
4. npm run typecheck
5. npm run test:ci
6. 上传 junit + cobertura + coverage-summary
```

也就是说，CI 这件事现在不再只是“未来能接”，而是已经有了实际入口。

这版为什么重要：

```text
test:ci 是本地视角的命令；
.github/workflows/ci.yml 是仓库视角的自动化入口。

前者证明配置可运行，
后者才代表它真的能被平台接管。
```

这也是为什么这版要专门单独落一个 workflow 文件，而不是只在文档里写一句“后面可以接 GitHub Actions”。

### 4. 公共测试夹具第三版

前两版公共夹具已经有：

```text
TaskPlan
TaskState
Runtime settings
Collaboration envelope
```

第二十版继续往前抽的，是“会在多个目录反复出现的 fake 协作者”：

```text
tests/helpers/agent-fixtures.ts
  - createAgentResult

tests/helpers/model-fixtures.ts
  - SequenceModelClient
  - CapturingModelClient
  - ReplyOnlyModelClient
  - ConcurrentTrackingModelClient
  - RoleAwareReviewModelClient
  - ThrowingModelClient

tests/helpers/gateway-fixtures.ts
  - createGatewaySettings
  - createGatewayHandler

tests/helpers/runtime-fixtures.ts
  - CountingGatewayManager
  - CountingMcpClientManager
  - createSilentSettings

tests/helpers/team-fixtures.ts
  - createRoleTaskPlan
  - createTaskExecutorInput
  - createRoleTaskExecutor
  - createTaskExecutor
```

这一版的重点不是“把所有测试都包起来”，而是把重复率高、语义已经稳定的 fake 收到 helpers。

比如：

```text
SequenceModelClient
以前散在 agent / runtime 测试里；
现在统一放到 model-fixtures.ts

CountingGatewayManager / CountingMcpClientManager
以前在 runtime 各测试文件里重复定义；
现在统一放到 runtime-fixtures.ts

createRoleTaskExecutor / createTaskExecutorInput
以前只存在于 role-task-executor.test.ts 本地；
现在变成 team 层可复用夹具
```

这样做的价值不只是“少写几行”，更重要的是：

```text
测试 fake 的语义开始稳定了。
```

以后再看测试时，你会更容易分辨：

```text
这是在验证业务状态流
还是只是在临时造一个协作者
```

### 这一版形成的结构变化

第二十版之后，Vitest 这一层的整体形态更完整了：

```text
setupFiles
  -> 全局测试装配入口

custom matchers v2
  -> snapshot / plan / collaboration / runtime

coverage thresholds
  -> 全局底线
  -> per-file 底线
  -> scoped glob / module 阈值

CI workflow
  -> 本地命令 test:ci
  -> 仓库自动化入口 .github/workflows/ci.yml

helpers v3
  -> 领域数据夹具
  -> fake 协作者夹具
```

### 这版的学习点

```text
1. matcher 第二版的重点不是“继续包 expect”，而是“让断言跟着领域对象走”。

2. coverage 细化时，按目录拉高阈值不一定是好策略。

   对还在演进的仓库来说，
   关键模块 / 关键 glob 往往比粗目录阈值更实用。

3. test:ci 和 CI workflow 是两层不同概念。

   有 test:ci，只代表本地能模拟；
   有 workflow，才代表仓库层自动化真的接进去了。

4. 公共测试夹具到了第三版，已经不只是“测试数据 builder”，
   还开始承载 fake model / fake gateway / team executor 这类协作者。

5. 抽 helpers 的原则仍然不变：

   抽重复、抽稳定、抽语义；
   不抽偶然、不抽一次性、不抽会把测试意图藏起来的包装层。
```

### 第二十版验证结果

```text
npm.cmd run typecheck:test
  通过

npm.cmd run test:agent
  1 个文件、5 个测试通过

npm.cmd run test:gateway
  1 个文件、7 个测试通过

npm.cmd run test:planning
  5 个文件、23 个测试通过

npm.cmd run test:runtime
  4 个文件、57 个测试通过

npm.cmd test
  40 个文件、240 个测试通过

npm.cmd run test:coverage:per-file
  40 个文件、240 个测试通过

npm.cmd run test:ci
  40 个文件、240 个测试通过
  junit report 已写入 reports/vitest/junit.xml
```

## 验收标准

当前验收：

```powershell
npm.cmd run typecheck
npm.cmd run typecheck:test
npm.cmd test
npm.cmd run test:vitest
```

必须全部通过。

第二版验收：

```powershell
npm.cmd run test:vitest
```

被迁移文件的测试数量和语义不能减少。

最终验收已经达到：

```text
test 默认命令切到 vitest run
所有测试文件迁移到 Vitest 风格
watch 可用
coverage 可用
模块级测试命令可用
```

## 风险与处理

### 风险 1：Vitest 不能直接收集现有 .mjs 里的 node:test 用例

处理：

```text
不要把 tests/**/*.test.mjs 放进 Vitest include。
旧 .mjs 继续交给 node:test。
新增或迁移后的 .test.ts 才交给 Vitest。
```

### 风险 2：从 dist 改到 src 后导入路径混乱

处理：

```text
旧 node:test 继续测 dist。
新 Vitest 测试先测 src。
这样既保留产物验证，又获得 Vitest 的 TDD 体验。
```

### 风险 3：mock 用多了，状态流测试变虚

处理：

```text
保留 fake class
只在需要观察调用时使用 vi.fn()
```

## 当前建议

第二十二版增强已经完成。当前可用命令是：

```text
npm.cmd run typecheck
npm.cmd run typecheck:test
npm.cmd test
npm.cmd run test:agent
npm.cmd run test:vitest
npm.cmd run test:coverage
npm.cmd run test:coverage:per-file
npm.cmd run test:ci
npm.cmd run test:context
npm.cmd run test:gateway
npm.cmd run test:hooks
npm.cmd run test:learning
npm.cmd run test:lifecycle
npm.cmd run test:memory
npm.cmd run test:mcp
npm.cmd run test:model
npm.cmd run test:permissions
npm.cmd run test:plugins
npm.cmd run test:reflection
npm.cmd run test:runtime
npm.cmd run test:session
npm.cmd run test:skills
npm.cmd run test:team
npm.cmd run test:tools
npm.cmd run test:planning
npm.cmd run test:orchestration
npm.cmd run test:task-state
npm.cmd run test:config
npm.cmd run test:layer:schema
npm.cmd run test:layer:store
npm.cmd run test:layer:orchestration
npm.cmd run test:layer:runtime
```

下一步更适合继续补这些：

```text
Vitest 主线可以收口，后续只在真实需求出现时再增强
时间夹具继续扩展（专门的 Date.now / timer spy 适配层）
如果后续新增 scheduler / retry delay 测试，默认优先接 withFakeTimeUntilSettled
```

## 第二十一版：matcher 第三版 / CI matrix / 时间相关测试基础设施

这一版补的是前面已经明确挂在待办上的 3 个点：

```text
1. matcher 第三版
2. CI matrix / 平台差异验证
3. fake timer / 时间夹具进一步收口
```

### 1. matcher 第三版

这次新增的领域断言落在：

```text
tests/setup/custom-matchers.ts
tests/setup/vitest.d.ts
tests/setup/custom-matchers.test.ts
```

新增 matcher：

```text
toHaveReviewPlan(expectedPartial)
toHaveReviewResult(owner, expectedPartial)
toHaveFollowUp(expectedPartial)
toHaveReplanDiff(expectedPartial)
```

这几类 matcher 解决的是 runtime / team / replan 这一层越来越像“结构化协议对象”，但测试还在手写路径访问的问题。

现在测试可以直接写成：

```ts
expect(execution).toHaveReviewPlan({
  policyName: "default-sequential-review-chain",
  executionMode: "sequential",
  reviewers: [{ reviewerOwner: "verifier" }],
});

expect(execution).toHaveReviewResult("verifier", {
  evaluation: { status: "completed" },
});

expect(execution).toHaveFollowUp({
  action: "retry",
  suggestedOwner: "worker",
});

expect(preview).toHaveReplanDiff({
  removedTaskIds: [],
  preservedCompletedTaskIds: [],
});
```

这一版还有一个关键实现点：`matchPartialObject(...)` 不再只是浅比较，而是支持：

```text
对象里的对象做递归 partial match
数组里的对象按位置递归 partial match
普通标量继续走 equals
```

这让下面这种断言成为可能：

```ts
expect(execution).toHaveReviewResult("verifier", {
  evaluation: {
    status: "completed",
  },
});
```

也就是说，这一版 matcher 已经开始真正承载“协议层断言”，不只是给 `expect(...)` 换个名字。

### 2. CI matrix / 平台差异验证

这一版把 `.github/workflows/ci.yml` 从单 job 改成了两层：

```text
verify
  -> ubuntu-latest / windows-latest
  -> Node 20 / Node 22
  -> typecheck + typecheck:test + test:vitest

coverage
  -> ubuntu-latest / Node 20
  -> typecheck + test:ci
  -> 上传 junit / cobertura / coverage-summary
```

这么拆的原因不是“把所有事情都塞进 matrix”，而是把两类目标分开：

```text
verify 负责回答：
  不同 Node 版本、不同平台，主链路能不能稳定跑通？

coverage 负责回答：
  在一个稳定组合上，结构化报告和覆盖率产物能不能稳定产出？
```

如果把 coverage 也直接塞进全部 matrix 组合，会有两个问题：

```text
1. 成本高：每个组合都跑覆盖率，时间和产物都会膨胀
2. 噪声大：我们当前要验证的是平台差异，不是让每个平台都产同一套报告
```

所以这版采取的是更稳的工程拆法：

```text
matrix job 验兼容性
single coverage job 产正式报告
```

### 3. fake timer / 时间夹具进一步收口

这次新增了：

```text
tests/helpers/time-fixtures.ts
```

里面分成两种时间模型：

```text
createManualClock(initial)
  -> 适合代码本身支持注入 now() 的场景
  -> 例如 TaskOrchestrator 这种状态机 / 编排器

withFakeTime(initial, run)
  -> 适合代码内部直接用 Date.now / new Date / setTimeout 的场景
  -> 例如 InMemoryStore / plan-normalizer
```

这两类时间夹具分别接到了：

```text
tests/orchestration/orchestration.test.ts
tests/orchestration/orchestration-recover.test.ts
tests/memory/in-memory-store.test.ts
tests/planning/plan-normalizer.test.ts
```

为什么要分两种，而不是只推 fake timer：

```text
状态机 / 调度器更适合手动时钟：
  它本来就有 now 注入点，直接喂一个 ManualClock 最清楚

直接依赖 Date.now / new Date / setTimeout 的代码更适合 fake timer：
  这样不需要为了测试去反向侵入生产代码接口
```

所以这一版时间基础设施收口出来的真正原则是：

```text
能注入 now 的模块，优先手动时钟
直接读系统时间的模块，优先 fake timer
不要为了统一手法而牺牲代码边界本身的清晰度
```

### 这一版的学习点

```text
1. matcher 越往协议层走，越需要支持递归 partial match，而不是只做浅比较
2. CI matrix 的重点是“兼容性验证”，不等于“每个组合都跑最重的那套产物”
3. 时间测试基础设施不应该只有一种：
   - 注入式状态机适合 manual clock
   - 系统时钟代码适合 fake timer
4. 把时间 helper 收口到 tests/helpers 之后，测试文件本身会更像“业务场景”，而不是“时间黑魔法”
```

### 这一版的验证结果

```text
npm.cmd run typecheck:test
  通过

npm.cmd run test:memory
  1 个文件、4 个测试通过

npm.cmd run test:planning
  5 个文件、23 个测试通过

npm.cmd run test:orchestration
  3 个文件、31 个测试通过

npm.cmd run test:runtime
  4 个文件、57 个测试通过

npm.cmd test
  40 个文件、241 个测试通过

npm.cmd run test:coverage:per-file
  40 个文件、241 个测试通过

npm.cmd run test:ci
  40 个文件、241 个测试通过
  junit 报告写入 reports/vitest/junit.xml

当前 coverage:
  Statements: 94.99%
  Branches: 87.70%
  Functions: 95.96%
  Lines: 94.90%
```

## 第二十二版：matcher 第四版（review routing / escalation / history / digest）

第二十二版的重点不是再去扩 CI，也不是再去扩时间 helper，而是继续把测试断言从“路径访问”往“协议语义”推进一层。

这次新增 / 扩展的是：

```text
tests/setup/custom-matchers.ts
tests/setup/vitest.d.ts
tests/setup/custom-matchers.test.ts
```

新增 matcher：

```text
toHaveReviewRouting(taskId, expectedPartial)
toHaveEscalation(expectedPartial)
toHaveCoordinationDigest(expectedPartial)
toHaveHistoryPattern(type, expectedPartial)
```

### 1. 这版 matcher 解决什么问题

前一版已经能很好表达：

```text
reviewPlan
reviewResult
followUp
replan diff
```

但在 `team` 和 `runtime` 这两层，测试里仍然有一批断言比较“路径味”：

```ts
summary.escalations[0]?.action
summary.digest.summary
window.patterns[0]?.type
frame.reviews[0]?.policyName
messages[2]?.payload?.trigger?.kind
```

这些断言不是错，只是越来越不利于阅读。
因为测试真正想表达的是：

```text
当前有没有升级决策
协调摘要是不是这个意思
协作历史命中了哪种模式
某个任务是不是进入了这条 review routing
```

所以第二十二版做的事很直接：

```text
把这些“协议层对象”的断言也提升成领域 matcher
```

### 2. 四类 matcher 的语义

#### `toHaveReviewRouting(taskId, expectedPartial)`

适用于：

```text
CoordinationFrame.reviews
以及其他包了一层 frame 的对象
```

现在可以直接写：

```ts
expect(frame).toHaveReviewRouting("t1", {
  executionMode: "sequential",
  policyName: "test-review-policy",
  reviewers: [{ reviewerOwner: "verifier" }],
});
```

而不需要自己去找：

```ts
frame.reviews.find((item) => item.taskId === "t1")
```

#### `toHaveEscalation(expectedPartial)`

适用于：

```text
execution.escalation
task.lastExecution.escalation
summary.escalations[]
frame.escalations[]
```

也就是说，同一个 matcher 能覆盖：

```text
单对象 escalation
数组形态的 escalation 决策
lastExecution 里的 escalation
```

这很重要，因为 escalation 在不同层里的“容器形态”不一样，但语义是同一件事。

#### `toHaveCoordinationDigest(expectedPartial)`

适用于：

```text
summary.digest
frame.summary
execution.coordinationSummary
```

这里做了一个很实用的适配：

```text
如果是 execution.coordinationSummary
会自动把 digestSummary 映射成 summary
把 nextRecommendedAction 保留下来
```

所以测试可以统一写成：

```ts
expect(summary).toHaveCoordinationDigest({
  blockedTaskIds: ["t1"],
});

expect(execution).toHaveCoordinationDigest({
  summary: "测试中由 teamCoordinator 接管执行后汇总。",
  nextRecommendedAction: "人工确认后再继续。",
});
```

#### `toHaveHistoryPattern(type, expectedPartial)`

适用于：

```text
CollaborationHistoryWindow.patterns
以及包了一层 historyWindow 的对象
```

例如：

```ts
expect(window).toHaveHistoryPattern("consecutive-review-failures", {
  count: 3,
});
```

这比直接盯 `patterns[0]` 更稳，因为测试现在是在说：

```text
“命中了哪种模式”
```

而不是：

```text
“第 0 个数组元素碰巧长什么样”
```

### 3. 这版 matcher 的实现特点

这版继续沿用前一版的递归 partial match，但又补了一层“容器适配”：

```text
review routing:
  从 frame.reviews 里按 taskId 找

escalation:
  从 escalation / lastExecution.escalation / escalations[] 里找

coordination digest:
  从 digest / summary / coordinationSummary 里找

history pattern:
  从 patterns[] 里按 type 找
```

也就是说，matcher 现在不只是“换个断言名字”，而是已经在做一件更有价值的事：

```text
把不同层里同一语义对象的容器差异收掉
```

### 4. 这版接入了哪些真实测试

这版不是只补 `custom-matchers.test.ts`，也把代表性业务测试换过去了：

```text
tests/team/collaboration-history-window.test.ts
tests/team/team-coordinator.test.ts
tests/runtime/runtime-bundle.test.ts
```

代表性的变化包括：

```text
collaboration-history-window
  patterns[0] -> toHaveHistoryPattern(...)

team-coordinator
  summary.escalations[0] -> toHaveEscalation(...)
  summary.digest -> toHaveCoordinationDigest(...)
  frame.reviews -> toHaveReviewRouting(...)

runtime-bundle
  execution/task 上的 escalation / followUp -> matcher
  escalation-notice message -> 直接用 collaboration matcher 断 payload
```

这里还有一个很实际的小收获：

```text
不是所有 manual escalation 场景都应该带 blockedTaskIds
```

比如“连续 review 未通过”的人工升级，本质上更像：

```text
完成态上的收口问题
```

它未必等价于“当前有 blocked task”。
这也是为什么这版改造里，有一条 digest 断言最后从：

```text
blockedTaskIds: ["t1"]
```

收成了：

```text
blockedTaskIds: []
```

这个调整本身也是个知识点：

```text
manual escalation 不等于 blocked task
```

### 5. 这版的学习点

```text
1. matcher 继续往协议层推进时，真正重要的不是“名字更长”，而是“把容器差异收掉”
2. history pattern 这类断言，优先按语义键（type）找，不要按数组下标找
3. escalation / digest 这种对象，跨层形态不统一是常态，测试层适配比业务层硬统一更值
4. review 未通过触发的 manual，不一定意味着 blockedTaskIds 一定非空
5. 协议类 matcher 最适合承接“同一语义、不同容器”的场景
```

### 第二十二版验证结果

```text
npm.cmd run typecheck:test
  通过

npm.cmd run test:team
  7 个文件、32 个测试通过

npm.cmd run test:runtime
  4 个文件、57 个测试通过

npm.cmd test
  40 个文件、242 个测试通过

npm.cmd run test:ci
  40 个文件、242 个测试通过

当前 coverage:
  Statements: 94.99%
  Branches: 87.78%
  Functions: 95.96%
  Lines: 94.90%
```

## 第二十四版：matcher 第六版（reviewer chain / latest reviews / batch summary）

这一版继续沿着“测试写成领域语言”的方向推进，补的是：

```text
1. reviewer chain 断言
2. latest reviews 适配
3. batch summary 聚合断言
4. review / batch fixtures 第四版
```

### 1. 新增的 matcher 能力

这次落地在：

```text
tests/setup/custom-matchers.ts
tests/setup/vitest.d.ts
tests/setup/custom-matchers.test.ts
```

新增的主要 matcher 是：

```text
toHaveReviewerChain(expectedOwners)
toHaveBatchSummary(expectedPartial)
```

同时把 `toHaveReviewResult(...)` 的解析能力扩到了：

```text
reviewResults
reviews
lastExecution.reviews
latestReviews
payload.latestReviews
```

这意味着像 `escalation-notice` 这类消息里挂着的 `latestReviews`，现在也能直接复用 review matcher，不需要再手动沿 payload 路径一点点取值。

### 2. 这版为什么值得做

因为 runtime 里已经开始出现两类很适合抽 matcher 的语义：

```text
reviewer chain：这轮审查到底是谁按什么顺序参与
batch summary：这一轮批执行到底跑了几项、谁执行、最终收敛成什么状态
```

如果不抽出来，测试就会反复写这种原始断言：

```text
batch.results.length
batch.prepared.runningTasks?.map(...)
batch.final.state.snapshot.tasks.map(...)
execution.reviewPlan.reviewers.map(...)
messages[4].payload.latestReviews[0]
```

这些都能看懂，但它们说的是“字段路径”，不是“协作语义”。

### 3. 这次新增的 fixture

这版顺手补了 fixture 第四版：

```text
tests/helpers/review-fixtures.ts
tests/helpers/batch-fixtures.ts
```

职责分别是：

```text
review-fixtures：生成 review plan / latest review
batch-fixtures：生成 batch execution result
```

这样 custom matcher 自测不需要一直手搓大对象，review/batch 语义也能单独复用。

### 4. 迁移到新 matcher 的代表性测试

这次实际迁移了几类 runtime 测试：

```text
1. parallel worker batch 执行
2. serial batch 执行
3. 单 reviewer 顺序审查
4. 多 reviewer 顺序审查
5. 多 reviewer 并行审查
6. escalation-notice 里的 latestReviews
```

对应文件主要是：

```text
tests/runtime/runtime-bundle.test.ts
tests/setup/custom-matchers.test.ts
```

### 5. 这版补出来的关键经验

这一轮有两个特别值得记住的点：

```text
1. latestReviews 这类字段很适合在 matcher 层做容器适配，而不是把每个测试都写成 payload 路径爬虫
2. batch summary 这类断言，最适合抽“聚合视角”，而不是继续让测试逐项拼凑长度、taskIds、owners、final statuses
```

另外还有一个过程层面的坑：

```text
在 Windows PowerShell 里不要直接敲 vitest，优先走 npx.cmd vitest 或 npm.cmd 脚本
```

### 第二十四版验证结果

```text
npm.cmd run typecheck:test
  通过

npx.cmd vitest run tests/setup/custom-matchers.test.ts
  1 个文件、5 个测试通过

npm.cmd run test:runtime
  4 个文件、57 个测试通过

npm.cmd test
  40 个文件、244 个测试通过

npm.cmd run test:ci
  40 个文件、244 个测试通过

npm.cmd run test:coverage:per-file
  40 个文件、244 个测试通过

当前 coverage:
  Statements: 94.99%
  Branches: 87.86%
  Functions: 95.96%
  Lines: 94.90%
```

## 第二十五版：参数化测试整理（review policy / coordination rules）

这一版不再继续堆 matcher，而是把一部分“天然就是规则表”的测试真正改成了参数化测试。

这次新增的是：

```text
tests/team/default-task-review-policy.test.ts
tests/team/coordination-rules.test.ts
```

### 1. 为什么先落在这两块

因为这两层最适合做 `test.each`：

```text
DefaultTaskReviewPolicy：输入条件 -> 输出 review plan
coordination-rules：输入状态 -> 输出 followUp / retry / manual / replan 决策
```

它们本来就不是“单故事测试”，而是“规则矩阵测试”。

如果继续把这种逻辑写成一个个独立 test，后面补 case 会越来越散；
改成参数化之后，就能把“规则集合”直接铺开来看。

### 2. 这版具体覆盖了什么

#### default-task-review-policy

这一组覆盖了：

```text
1. worker + implementation + completed -> verifier
2. worker + high priority implementation + completed -> verifier -> main
3. explorer + implementation -> no review
4. worker + analysis -> no review
5. worker + implementation + blocked -> no review
```

#### coordination-rules

这一组覆盖了：

```text
1. shouldRunVerifierReview 的触发矩阵
2. suggestFollowUpAction 的主要分支：
   - continue
   - continue + review passed
   - retry worker
   - retry explorer
   - manual
   - replan
```

### 3. 这一版补出来的关键经验

这轮有一个很值得记住的语义点：

```text
suggestFollowUpAction 里，evaluation.status === "completed" 的优先级高于 review 判断
```

我一开始把一条规则写成了：

```text
执行 completed + review blocked -> retry worker
```

但真实代码不是这么走的。
当前实现会先命中 completed 分支，所以这组输入不会走 retry。

后来我把参数化用例修正成：

```text
执行未完成 + review blocked -> retry worker
```

这个过程本身也说明了参数化测试的价值：

```text
它不仅能省代码，还能更快暴露“规则顺序”和“脑内预期”不一致的问题。
```

### 4. 这版的学习点

```text
1. 参数化测试最适合规则矩阵，不适合所有测试都一股脑改成 test.each
2. policy / rule 层最该优先做参数化，因为它们天然是“输入条件 -> 输出决策”
3. 当参数化用例失败时，优先检查规则顺序，而不是先怀疑 Vitest
4. matcher 解决“怎么读测试”，参数化测试解决“怎么扩规则”
5. 两者结合起来，测试才会同时具备可读性和可扩展性
```

### 第二十五版验证结果

```text
npm.cmd run typecheck:test
  通过

npm.cmd run test:team
  9 个文件、48 个测试通过

npm.cmd test
  42 个文件、260 个测试通过

npm.cmd run test:ci
  42 个文件、260 个测试通过

当前 coverage:
  Statements: 95.04%
  Branches: 87.86%
  Functions: 95.96%
  Lines: 94.95%
```

## 第二十六版：参数化测试第二版（teamCoordinator 恢复矩阵）

这一版继续沿着“把测试写成规则说明书”的方向推进，不过这次不再落在纯规则函数，而是往上提了一层，收到了 `teamCoordinator.summarizeFrame(...)`。

这次主要改的是：

```text
tests/team/team-coordinator.test.ts
```

### 1. 这版为什么选 teamCoordinator

因为这里已经有一批非常明显的“输入来源不同 -> followUp / escalation 不同”的用例：

```text
review 未通过：latestReviews / recentCollaborations
recentCollaborations：completion-summary / blocker-report / escalation-notice / 连续 blocker / 连续 review
```

如果继续把它们一个个平铺成独立 test，能看，但会越来越像“复制粘贴的故事测试”。

### 2. 这版抽出来的两个小 helper

为了不让 `test.each` 变成一大坨对象字面量，我先抽了三层最小 helper：

```text
createGatewayAdapterState(status)
summarizeSingleTask(state, now, input)
expectSingleFollowUp(summary, expected)
```

这样参数化块里看见的就是：

```text
输入来源
当前任务状态
预期 followUp / escalation / digest
```

而不是每次都重复：

```text
createState(...)
buildCoordinationContext(...)
new DefaultTeamCoordinator()
buildFrame(...)
summarizeFrame(...)
```

### 3. 这次实际参数化了哪些矩阵

#### review 未通过恢复矩阵

这一组收成了 2 条 case：

```text
1. latestReviews 来源
2. recentCollaborations.review-result 来源
```

它们最终都应该落到：

```text
planStatus = reviewing
followUp = retry worker
escalation = retry
```

#### recentCollaborations 恢复矩阵

这一组收成了 5 条 case：

```text
1. completion-summary -> continue
2. blocker-report -> retry explorer
3. escalation-notice -> manual
4. 连续 blocker 历史 -> manual
5. 连续 review 历史 -> manual
```

这组特别适合参数化，因为它本质就是：

```text
消息来源 / 历史窗口模式 -> 当前任务后续建议
```

### 4. 这版补出来的关键经验

这轮还有一个很实在的点：

```text
不是所有参数化测试都应该直接裸写 test.each
```

如果没有前面的 helper，`teamCoordinator` 这层会变得很重；
但一旦把“造 state / 调 summarize / 断单条 followUp”这三步抽干净，`test.each` 就会立刻变成规则表视角。

另外，这轮还修了一个类型层的小坑：

```text
summarizeSingleTask 的 input 类型应该省掉 frame / taskId，
否则 helper 内部再补 frame 时，TS 会提示字段重复覆盖。
```

### 5. 这版的学习点

```text
1. 参数化测试最适合“同一入口、多个输入来源”的恢复矩阵
2. teamCoordinator 这种中层模块，先抽 helper 再做 test.each，效果会比直接硬改更好
3. 当多个 case 最终落到同一 followUp 语义时，参数化最能突出“不同来源，同一决策”
4. helper 的类型边界也要收干净，不然 TS 会比测试先告诉你设计不顺
5. 参数化测试第二版的价值，不只是少写代码，而是把恢复规则真正整理成一张表
```

### 第二十六版验证结果

```text
npm.cmd run typecheck:test
  通过

npm.cmd run test:team
  9 个文件、48 个测试通过

npm.cmd test
  42 个文件、260 个测试通过

npm.cmd run test:ci
  42 个文件、260 个测试通过

当前 coverage:
  Statements: 95.04%
  Branches: 87.86%
  Functions: 95.96%
  Lines: 94.95%
```

## 第二十七版：参数化测试第三版（runtime followUp 自动推进 / escalation 来源矩阵）

这一版继续沿着“把测试写成规则说明书”的方向推进，不过这次落点不再是 teamCoordinator，而是更靠近执行主链的 `runtime`。

这次主要改的是：

```text
tests/runtime/runtime-bundle.test.ts
tests/runtime/runtime-bundle-guards.test.ts
```

### 1. 这版为什么选 runtime

因为 `runtime.driveFollowUp(...)` 已经天然长成了一张规则表：

```text
continue -> 自动继续下一项
retry -> 自动重试，并可能带 suggestedOwner
replan -> 自动修订计划并继续执行
manual / no followUp / 缺少源任务 / 计划已完成 -> 停止自动推进
```

如果继续把这些 case 一个个散开写成故事测试，能看，但会越来越难回答一个问题：

```text
当前 followUp 规则整体到底长什么样？
```

所以第二十七版做的事很直接：

```text
把 runtime 这层的自动推进规则和人工升级来源规则，正式收成两张参数化矩阵。
```

### 2. 这版实际参数化了哪两组矩阵

#### driveFollowUp 停止分支矩阵

这组落在：

```text
tests/runtime/runtime-bundle-guards.test.ts
```

收成了 4 条 case：

```text
1. 没有 followUp
2. followUp = manual
3. 缺少源任务上下文
4. 当前计划已经完成
```

每条 case 都统一断：

```text
steps[0] 的 action / reason / sourceTaskId
stoppedReason
```

也就是说，这组测试现在回答的是：

```text
“driveFollowUp 为什么停下来”
```

而不是继续把 4 段几乎同构的测试平铺在那里。

#### driveFollowUp 自动推进矩阵

这组落在：

```text
tests/runtime/runtime-bundle.test.ts
```

收成了 3 条 case：

```text
1. continue 自动继续下一项
2. retry 自动重试并保持建议 owner
3. replan 自动修订计划并继续执行
```

这里不只是在断 `followUp.action`，而是统一从同一个入口看：

```text
firstExecution.followUp 是什么
第一步自动推进怎么做
preparedState / execution / replan diff 写回成了什么
最终 stoppedReason 或 final state 是什么
```

也就是说，这组测试现在回答的是：

```text
“runtime 遇到不同 followUp 时，会把计划往哪条轨道上推”
```

#### manual escalation 来源矩阵

这组同样落在：

```text
tests/runtime/runtime-bundle.test.ts
```

收成了 2 条 case：

```text
1. blocker-report 来源
2. review-result 来源
```

统一断言的内容是：

```text
collaboration kinds
triggerMessageIndex
escalation-notice.parentMessageId
escalation payload 里的 trigger / blocker / latestReviews / nextRecommendedAction
```

这组测试真正表达的是：

```text
人工升级不是只有“发生了 manual”这么简单，
还要看 escalation-notice 最终是挂在 blocker 语境上，还是 review 语境上。
```

### 3. 这版抽出来的 helper

为了不让 `test.each` 重新退化成一坨大对象字面量，这一版补了几层最小 helper：

```text
createStructuredEvaluationReply(payload)
runAutoFollowUpScenario(scenario)
```

同时，manual escalation 矩阵里的 case 统一约定了：

```text
createRuntime()
initializePlan(runtime)
buildExpectedPayload(messages)
assertExecution?(execution)
assertEscalation?(message, messages)
```

这样参数化块里看到的就不再是：

```text
一大段 runtime factory
一大段 initializePlan
一大段 message 路径断言
```

而是：

```text
来源是什么
要初始化哪种计划
应该长出什么 escalation payload
```

### 4. 这版补出来的关键经验

这轮有几个特别值钱的小点：

#### 经验 1：runtime 这层很适合做“轨道矩阵”

因为 `driveFollowUp` 本质不是故事，而是状态转移：

```text
输入 followUp
  ->
准备状态 preparedState
  ->
是否再执行 execution
  ->
最终停在哪
```

所以用参数化视角看它，比继续写 3 个独立故事测试更清楚。

#### 经验 2：manual escalation 不能只看 action

这一版专门把 `blocker-report` 和 `review-result` 拆出来，就是为了让测试表达清楚：

```text
同样是 manual，
触发来源不同，payload 语义也不同。
```

一个场景里应该带 blocker 上下文，另一个场景里应该带 latestReviews。

#### 经验 3：测试 helper 的边界不要写得过窄

这轮还修了一个很典型的小坑：

```text
initializePlan helper 原本写成 Promise<void>
但真实 initializePlan(...) 会返回 OrchestratorActionResult
```

虽然测试不使用这个返回值，但 helper 类型如果过窄，TS 还是会先告诉你：

```text
你的辅助抽象收得太死了
```

后来把它放宽成 `Promise<unknown>`，语义就顺了。

### 5. 这版的学习点

```text
1. runtime 这层最适合按“状态转移轨道”参数化，而不是只按故事参数化
2. driveFollowUp 既要看 action，也要看 preparedState / execution / stoppedReason
3. manual escalation 不是一个平面字段，而是一个带来源语义的 collaboration 结果
4. 参数化测试在 runtime 这层的价值，是把“执行主链规则”整理成一张表
5. helper 类型如果过窄，TS 往往会先暴露设计边界没有收干净
```

### 第二十七版验证结果

```text
npm.cmd run typecheck:test
  通过

npm.cmd run test:runtime
  4 个文件、60 个测试通过

npm.cmd test
  42 个文件、263 个测试通过

npm.cmd run test:ci
  42 个文件、263 个测试通过

当前 coverage:
  Statements: 95.04%
  Branches: 87.86%
  Functions: 95.96%
  Lines: 94.95%
```

## 第二十八版：参数化测试第四版（runtime batch / review 执行矩阵）

这一版继续沿着“把测试写成规则说明书”的方向推进，不过这次补的是 runtime 里另外两组还很像规则表的场景：

```text
1. batch 批执行决策
2. review 审查执行模式
```

这次主要改的是：

```text
tests/runtime/runtime-bundle.test.ts
```

### 1. 这版为什么选 batch / review

因为在 runtime 这层，`followUp` 之外，最容易继续成组出现的就是这两类：

```text
batch：
  parallel worker batch
  serial batch

review：
  单 reviewer 顺序审查
  多 reviewer 顺序审查
  多 reviewer 并行审查
  review blocked
```

如果继续把这些场景平铺成独立故事测试，当然也能看，但会越来越难回答：

```text
当前 runtime 的批执行模式到底有哪些？
当前 runtime 的 review 执行模式到底有哪些？
```

所以第二十八版做的事很直接：

```text
把 batch 和 review 也各自收成一张参数化矩阵。
```

### 2. 这版实际参数化了哪两组矩阵

#### batch 执行矩阵

这组收成了 2 条 case：

```text
1. parallel worker batch 会并行执行两项任务
2. teamCoordinator 可以把 batch 收成 serial
```

统一断言的内容是：

```text
batch summary
coordinationFrame.runnableBatch
executorOwners
execution record 写回
是否真的出现并发
```

这样这组测试现在回答的是：

```text
“当前这轮 batch 是怎么跑的”
```

而不是继续让测试读者自己从 `results.length`、`runningTaskIds`、`final statuses` 里拼语义。

#### review 执行矩阵

这组收成了 4 条 case：

```text
1. 单 reviewer 顺序审查通过
2. 高优先级任务触发多 reviewer 顺序审查
3. parallel review plan 并行执行多个 reviewer
4. review 未通过时回写 blocked 和 retry
```

统一断言的内容是：

```text
reviewPlan.executionMode / policyName
reviewer chain
review result
followUp
task.lastExecution.reviews
必要时补消息链和并发度
```

这样这组测试现在回答的是：

```text
“runtime 遇到不同 review 模式时，会把审查链怎么跑、怎么回写、怎么收束”
```

### 3. 这版抽出来的 helper

为了不让参数化块重新退化成大段 setup，这一版补了两层最小 helper：

```text
runBatchScenario(scenario)
runReviewScenario(scenario)
```

同时把场景统一约定成：

```text
createRuntime()
initializePlan(runtime)
assertBatch(batch, runtime)
assertExecution(execution, runtime)
```

这样参数化块里看到的就是：

```text
场景名字
初始化哪种计划
最后要验证哪种 batch / review 语义
```

而不是：

```text
每条测试都重复一遍 runtime create / initialize / execute / dispose
```

### 4. 这版补出来的关键经验

这轮也有几个很值钱的小点：

#### 经验 1：batch 矩阵适合统一看“结果形态”

因为 batch 场景里最重要的不是每一行代码怎么跑，而是：

```text
这一轮到底跑了几个任务
是不是并行
最终快照收敛成了什么
```

所以把它统一收成 `assertBatch(...)` 很自然。

#### 经验 2：review 矩阵适合统一看“执行模式 + 收口结果”

review 的真正差异不是只有 reviewer 数量，而是：

```text
顺序还是并行
通过还是 blocked
followUp 最终落到 continue 还是 retry
```

所以第二十八版把 review 测试统一成“执行模式矩阵”，比继续散写更清楚。

#### 经验 3：并发验证放在 runtime.model 这一层最顺

像：

```text
parallel worker batch
parallel reviewers
```

这种并发验证，本质上是在观察：

```text
模型执行有没有同时起多路
```

所以直接用 `ConcurrentTrackingModelClient.maxActive` 断言，比去猜内部实现细节更稳。

### 5. 这版的学习点

```text
1. runtime 这层除了 followUp，也很适合按 batch / review 两条主线继续参数化
2. batch 测试最适合统一看 summary，不适合反复手写散乱字段断言
3. review 测试最适合统一看 executionMode / reviewer chain / followUp 的组合语义
4. helper 的价值不是“少写几行”，而是让矩阵真正长得像矩阵
5. 并发类测试优先断可观察行为，不要过度绑定内部实现顺序
```

### 第二十八版验证结果

```text
npm.cmd run typecheck:test
  通过

npm.cmd run test:runtime
  4 个文件、60 个测试通过

npm.cmd test
  42 个文件、263 个测试通过

npm.cmd run test:ci
  42 个文件、263 个测试通过

当前 coverage:
  Statements: 95.04%
  Branches: 87.86%
  Functions: 95.96%
  Lines: 94.95%
```

## 第二十九版：时间夹具第二版（next timer / pending / tick and flush）

这一版继续补的是测试基础设施本身，不是业务模块。
目标很明确：

```text
把现有“能冻结时间”的 helper，
升级成“能稳定驱动 timer / microtask / 连续时间片”的 helper。
```

这次主要改的是：

```text
tests/helpers/time-fixtures.ts
tests/setup/time-fixtures.test.ts
```

### 1. 为什么时间夹具还要出第二版

因为第一版虽然已经够用来处理：

```text
Date.now()
new Date()
简单的 advance(ms)
```

但还不够顺手去处理这些更真实的场景：

```text
1. 只推进到下一项 timer
2. 只跑当前轮 pending timer，不把新挂进去的 timer 一起吞掉
3. 跑完 timer 后，再把本轮 microtask 一起冲刷干净
4. 看当前还有多少 timer 没跑
```

而这些正是后面更复杂测试最容易遇到的时间问题，比如：

```text
并发模型延迟
setTimeout 链式调度
重试/轮询
协作窗口里的时间片推进
```

所以第二十九版做的事很直接：

```text
把“时间可控”从能用，升级成好用。
```

### 2. 这版具体新增了哪些能力

这次在 `FakeTimeController` 里补了这些方法：

```text
advanceToNextTimer()
runPending()
tickAndFlush(milliseconds?)
timerCount()
```

现有能力则继续保留：

```text
now()
current()
set(...)
advance(ms)
runAll()
```

也就是说，第二版之后，时间夹具已经能覆盖三类时间推进方式：

#### 1. 绝对推进

```text
set(...)
advance(ms)
```

适合：

```text
状态机时间戳
createdAt / updatedAt / evaluatedAt
```

#### 2. 调度驱动推进

```text
advanceToNextTimer()
runPending()
runAll()
```

适合：

```text
setTimeout 队列
只跑当前轮 timer
分步观察链式调度
```

#### 3. 时间片 + 微任务一起冲刷

```text
tickAndFlush(...)
```

适合：

```text
timer 回调里又挂 Promise.then(...)
timer 回调里再挂下一轮 timer
需要按时间片分两步观察结果
```

### 3. 这版为什么 `tickAndFlush` 值得单独做

因为很多“看起来是 timer”的逻辑，真实执行顺序其实是：

```text
timer
  -> microtask
  -> 下一轮 timer
```

如果只有：

```text
advance(ms)
```

测试经常就会卡在一种很烦的状态：

```text
timer 已经跑了
但 Promise.then 里的结果还没冲刷出来
```

这时 `tickAndFlush(...)` 的价值就很明显：

```text
推进一个时间片
再把这轮 microtask 一起冲掉
```

这样写出来的测试会更贴近真实调度行为，也更少出现“明明逻辑对了，但断言时机不对”的假红灯。

### 4. 这版新增了哪些自测

第二十九版没有只改 helper，本轮还专门加了一组测试：

```text
tests/setup/time-fixtures.test.ts
```

覆盖了 5 类行为：

```text
1. createManualClock 的 now / set / advance
2. withFakeTime + advanceToNextTimer
3. runPending 只执行当前轮 timer
4. tickAndFlush 会同时冲刷 timer 和 microtask
5. withFakeTime 退出后会恢复真实时间
```

这组测试的意义很实际：

```text
以后我们再在 runtime / model / scheduler 层用时间夹具时，
不用靠猜它的语义，
直接看这组测试就知道每个方法到底承诺什么行为。
```

### 5. 这版补出来的关键经验

这轮有几个特别值得记住的小点：

#### 经验 1：时间夹具不是只为时间戳服务的

它不只是用来断：

```text
createdAt = 123
updatedAt = 456
```

它更大的价值是：

```text
控制异步调度节奏
```

#### 经验 2：`runPending` 和 `runAll` 不能混成一个意思

这轮专门把 `runPending()` 单独补出来，就是因为：

```text
只跑当前轮
```

和

```text
把后面新挂进去的也一口气全跑完
```

在测试语义上完全不是一回事。

#### 经验 3：fake timer 最怕污染后续测试

所以这轮在 `withFakeTime(...)` 的 `finally` 里补了：

```text
vi.clearAllTimers()
vi.useRealTimers()
```

这件事很小，但很重要。
因为时间夹具如果自己不把现场收干净，后面别的测试出怪问题时会特别难查。

### 6. 这版的学习点

```text
1. 时间夹具第二版的重点不是“更多 API”，而是“更明确的调度语义”
2. advanceToNextTimer 适合做单步时间推进
3. runPending 适合做“当前轮”验证，避免把后续 timer 一起跑掉
4. tickAndFlush 适合处理 timer + microtask 混合场景
5. 时间相关测试最重要的不是冻结时间，而是能按我们想要的节奏推进时间
```

### 第二十九版验证结果

```text
npm.cmd run typecheck:test
  通过

npx.cmd vitest run tests/setup/time-fixtures.test.ts
  1 个文件、5 个测试通过

npm.cmd test
  43 个文件、268 个测试通过

npm.cmd run test:ci
  43 个文件、268 个测试通过

当前 coverage:
  Statements: 95.04%
  Branches: 87.86%
  Functions: 95.96%
  Lines: 94.95%
```

## 第三十版：把时间夹具落到真实并发测试

这一版不再只是补 helper，也不只是补 helper 的自测。
目标很明确：

```text
把已经做好的 fake time 能力，
真正接到 runtime 里有真实延迟和并发语义的测试场景，
让测试更快、更稳，也更像真实调度说明书。
```

这次主要改的是：

```text
tests/runtime/runtime-bundle.test.ts
docs/integrations/vitest-testing-design.md
```

### 1. 这一版具体解决了什么问题

前面第二十九版虽然已经有了：

```text
advanceToNextTimer()
runPending()
tickAndFlush(...)
timerCount()
```

但它们主要还停留在：

```text
helper 自测层
```

也就是说，时间夹具本身已经“好用”，
但还没有真正证明：

```text
它能不能稳定驱动 runtime 里的真实并发延迟场景。
```

而我们在 runtime 这层已经有两类很典型的真实场景：

```text
1. parallel worker batch
2. parallel review plan
```

这两类场景里，本来就带有模型端延迟，
如果继续靠真实等待去跑测试，会有两个问题：

```text
1. 测试会慢
2. 测试对调度时机更敏感，后面越复杂越容易变脆
```

所以第三十版做的事就是：

```text
把“时间可控”真正落到真实并发测试里。
```

### 2. 这次接到了哪些真实场景

这次在 `tests/runtime/runtime-bundle.test.ts` 里，
把两组参数化场景接到了 fake time：

```text
parallel worker batch 会并行执行两项任务
parallel review plan 并行执行多个 reviewer
```

这两组场景本来就用了带延迟的：

```text
ConcurrentTrackingModelClient(..., 50)
```

现在它们不再依赖真实时间等待，
而是通过 fake time 驱动完成。

### 3. 这版具体怎么接进去

这次没有把 fake time 硬塞进每个测试细节里，
而是在 runtime 测试内部补了一层统一包装：

```text
resolveWithFakeTime(...)
```

同时把两类场景配置也向上提了一点：

```text
RuntimeBatchScenario.fakeTimeStart
RuntimeReviewScenario.fakeTimeStart
```

也就是说，测试现在可以表达成：

```text
这个场景需要假时间
从哪个时间点开始
其余执行逻辑保持原来的 batch/review 语义
```

这样做的好处是：

```text
1. fake time 只影响需要它的场景
2. 测试意图比“手动 everywhere 推时间”清晰很多
3. 后面要继续扩 fake time 场景时，接法是一致的
```

### 4. 这轮最关键的经验：不能只排空“当前已有 timer”

这一版中间其实踩到了一个很典型的坑。

一开始我做的是：

```text
启动异步执行
把当前已有 timer 排一轮
然后等 promise 结束
```

但这会在真实并发场景里失效。
原因不是 fake time 不行，而是异步链比想象中更长：

```text
第一轮 timer 跑完
  -> 进入后续 async/microtask
  -> 再挂下一轮 timer
```

如果只排空“当前已有 timer”，
后面新挂进去的 timer 根本不会被继续驱动，
测试就会表现成：

```text
明明用了 fake time
但 case 还是 timeout
```

所以这轮最后收敛下来的方式是：

```text
不是只跑一次 timer，
而是持续 tickAndFlush，
直到外层 promise settled 为止。
```

这点非常重要，因为它说明：

```text
fake time 驱动真实异步链时，
核心不是“把时间拨快”，
而是“持续把调度链推到真正完成”。
```

### 5. 这一版为什么值钱

第三十版的价值，不只是把两条测试改快了一点。

更重要的是，它把下面这件事正式验证了：

```text
我们现在这套时间夹具，
已经不只是“能测 helper”，
而是能稳定驱动 runtime 的真实并发执行测试。
```

这意味着后面如果我们再遇到：

```text
批执行延迟
review 并行延迟
重试冷却期
轮询/调度等待
```

就不需要第一反应还是：

```text
真等几十毫秒 / 几百毫秒
```

而是可以优先考虑：

```text
先接 fake time
```

### 6. 这版的学习点

```text
1. 时间夹具的真正价值，要看它能不能落到真实业务测试，而不只是 helper 自测
2. fake time 驱动真实异步链时，不能只排空“当前已有 timer”
3. 正确做法是持续推进 timer + microtask，直到 promise settled
4. 把 fake time 能力挂到场景配置层，比在测试里到处手动拨时间更稳
5. 并发/延迟测试一旦切到 fake time，后面继续扩展会越来越轻松
```

### 第三十版验证结果

```text
npm.cmd run typecheck:test
  通过

npm.cmd run test:runtime
  4 个文件、60 个测试通过

npm.cmd test
  43 个文件、268 个测试通过

npm.cmd run test:ci
  43 个文件、268 个测试通过

当前 coverage:
  Statements: 95.04%
  Branches: 87.86%
  Functions: 95.96%
  Lines: 94.95%
```

## 第三十一版：把 fake-time 异步驱动器沉淀成公共 helper

这一版继续接着第三十版往前走。
第三十版已经证明：

```text
fake time 可以稳定驱动 runtime 并发执行测试。
```

但第三十版里还有一个不够理想的地方：

```text
持续推进 timer + microtask 直到 promise settled 的逻辑，
还写在 runtime-bundle.test.ts 里。
```

这会带来一个隐患：

```text
后面如果 model / scheduler / retry / gateway 也需要测真实延迟，
每个测试文件都可能复制一份类似逻辑。
```

所以第三十一版做的是：

```text
把这个已经验证过的 fake-time 驱动器，
从具体 runtime 测试里抽到公共时间夹具。
```

### 1. 这次新增了什么

新增能力落在：

```text
tests/helpers/time-fixtures.ts
```

新增 helper：

```text
withFakeTimeUntilSettled(initial, action, options?)
```

它的职责很单一：

```text
在 fake time 环境中执行一个异步任务，
持续推进 timer + microtask，
直到这个异步任务真正 settled。
```

这里的 `settled` 包括：

```text
resolved
rejected
```

也就是说，它不是只服务成功路径。
如果异步任务失败，也会把失败原样抛给测试。

### 2. 为什么要抽成公共 helper

第三十版里我们已经踩过一次坑：

```text
只排空“当前已有 timer”是不够的。
```

真实异步链可能是：

```text
action()
  -> microtask
  -> setTimeout
  -> microtask
  -> 下一轮 setTimeout
```

如果每个测试自己临时写 fake timer 驱动，
很容易又写回下面这种不完整逻辑：

```text
runPending()
await promise
```

看起来合理，实际会在后续异步链里卡住。

所以这版把正确做法收成统一入口：

```text
withFakeTimeUntilSettled(...)
```

以后需要测“真实延迟 + 异步完成”的场景，优先复用它。

### 3. runtime 测试现在怎么用

原来 `tests/runtime/runtime-bundle.test.ts` 里有一个局部 helper：

```text
resolveWithFakeTime(...)
```

第三十一版之后，runtime 测试改成直接使用公共 helper：

```text
withFakeTimeUntilSettled(...)
```

继续覆盖两类真实并发延迟场景：

```text
parallel worker batch 会并行执行两项任务
parallel review plan 并行执行多个 reviewer
```

这意味着：

```text
runtime 测试只保留 runtime 语义，
fake-time 调度细节交给 tests/helpers/time-fixtures.ts。
```

### 4. 新增了哪些自测

这次同步扩展了：

```text
tests/setup/time-fixtures.test.ts
```

新增两类覆盖：

```text
1. withFakeTimeUntilSettled 会持续驱动后续异步链直到 promise 完成
2. withFakeTimeUntilSettled 会在异步链无法收敛时给出明确错误
```

第二条很重要，因为 fake time 相关测试最怕的就是：

```text
测试静默卡死
```

所以 helper 里保留了 `maxRounds` 保护边界。
如果异步任务一直不完成，它会明确失败，而不是让测试等到框架超时。

### 5. 这版的学习点

```text
1. 被真实业务测试验证过的测试技巧，应该及时沉淀成公共 helper
2. fake-time 驱动器要保护“无法收敛”的场景，不能只服务 happy path
3. runtime 测试应该表达 runtime 语义，不应该长期背着 timer 调度细节
4. 后面新增 scheduler / retry delay / polling 测试时，优先复用 withFakeTimeUntilSettled
```

### 第三十一版验证结果

```text
npm.cmd run typecheck:test
  通过

npx.cmd vitest run tests/setup/time-fixtures.test.ts
  1 个文件、7 个测试通过

npm.cmd run test:runtime
  4 个文件、60 个测试通过

npm.cmd test
  43 个文件、270 个测试通过

npm.cmd run test:ci
  43 个文件、270 个测试通过

当前 coverage:
  Statements: 95.04%
  Branches: 87.86%
  Functions: 95.96%
  Lines: 94.95%
```

## 第三十二版：CI Step Summary 报告

这一版继续补的是测试工程的可观察性。
前面我们已经有：

```text
junit.xml
cobertura-coverage.xml
coverage-summary.json
artifact 上传
```

但这些更多是“机器可读”或“下载后再看”。
人在 GitHub Actions 页面上真正想要的是：

```text
这一轮跑了多少测试？
失败几个？
覆盖率多少？
哪些文件分支覆盖最低？
报告产物在哪？
```

所以第三十二版做的是：

```text
把已有测试产物整理成 GitHub Step Summary。
```

### 1. 这次新增了什么

新增脚本：

```text
scripts/write-ci-summary.mjs
```

新增 package 脚本：

```text
npm.cmd run ci:summary
```

CI 里新增步骤：

```text
Write Vitest summary
```

这个步骤在 coverage job 里执行，
并且用了：

```text
if: always()
```

也就是说，只要 job 能走到这一步，就算前面的测试失败，summary 也会尽量把已有报告整理出来。

### 2. summary 里展示哪些内容

当前 summary 会展示四块：

```text
1. Test Result
2. Coverage
3. Lowest Branch Coverage
4. Artifacts
```

对应的信息来源是：

```text
reports/vitest/junit.xml
coverage/coverage-summary.json
```

其中：

```text
Test Result
```

来自 JUnit 报告：

```text
tests
failures
errors
skipped
runtime
```

```text
Coverage
```

来自 coverage summary：

```text
Statements
Branches
Functions
Lines
```

```text
Lowest Branch Coverage
```

会列出当前分支覆盖率最低的 5 个源码文件，方便后续判断要不要补分支测试。

### 3. 为什么不用新依赖

这次没有引入 XML/coverage 解析库。
原因是当前需求很小：

```text
JUnit 只读取 testsuites / testcase 的少量字段
coverage-summary.json 本身就是 JSON
```

所以直接用 Node.js 标准库就够：

```text
node:fs
node:path
```

这符合我们现在的依赖原则：

```text
通用能力可以用成熟库，
但小到没有必要引入依赖时，也不要为了“看起来完整”堆依赖。
```

如果后面 summary 要解析复杂失败堆栈、做趋势对比或 PR comment，
再考虑引入成熟库会更合适。

### 4. 本地和 CI 的行为不同

脚本会判断：

```text
process.env.GITHUB_STEP_SUMMARY
```

如果在 GitHub Actions 里：

```text
写入 GITHUB_STEP_SUMMARY
```

如果在本地：

```text
直接 console.log 出 Markdown
```

这样我们本地也能直接验证 summary 长什么样，
不用每次都推到 GitHub 才知道格式是否可读。

### 5. 这一版的学习点

```text
1. CI 不只是跑命令，也要让结果好读
2. artifact 是“可下载”，Step Summary 是“可快速判断”
3. JUnit / cobertura / json-summary 适合机器消费，Markdown Summary 适合人读
4. CI 脚本应支持本地 dry run，避免每次靠远端试错
5. 小范围报告整理可以先用 Node 标准库，不必马上引入解析依赖
```

### 第三十二版验证结果

```text
npm.cmd run typecheck:test
  通过

npm.cmd run test:ci
  43 个文件、270 个测试通过

npm.cmd run ci:summary
  成功输出 Vitest CI Summary Markdown

当前 coverage:
  Statements: 95.04%
  Branches: 87.86%
  Functions: 95.96%
  Lines: 94.95%
```

## 第三十三版：CI 失败用例详情摘要

第三十二版已经能把测试数、覆盖率和低覆盖文件写进 GitHub Step Summary。
但它还有一个明显缺口：

```text
如果 CI 红了，只知道 failures / errors 的数量，
还不够快定位问题。
```

所以第三十三版继续增强的是：

```text
失败用例详情。
```

### 1. 这次增强了什么

继续修改：

```text
scripts/write-ci-summary.mjs
```

失败时现在会在 summary 里展示：

```text
1. 失败类型：FAILURE / ERROR
2. 测试用例名
3. 测试文件
4. 错误类型
5. 错误消息
6. 一小段错误详情 / 栈片段
```

也就是说，CI 红灯时不用先下载 JUnit，
先看 Summary 就能大致判断：

```text
是断言失败？
是运行时异常？
是哪条 case？
错误消息是什么？
```

### 2. 为了本地验证，补了环境变量入口

脚本现在支持这些环境变量：

```text
VITEST_JUNIT_PATH
VITEST_COVERAGE_SUMMARY_PATH
CI_SUMMARY_MAX_FAILED_CASES
```

这样我们本地可以构造一份模拟失败的 JUnit 文件，
然后用：

```text
VITEST_JUNIT_PATH=<fake-junit> npm.cmd run ci:summary
```

验证失败摘要长什么样。

这比“故意把真实测试改红再看”安全很多。

### 3. 这轮抓到的真实小坑

本地模拟失败时发现了一个很典型的 XML 解析小坑：

```text
name="..."
```

一开始被误匹配到了：

```text
classname="..."
```

结果失败标题显示成了文件名，而不是测试名。

修正方式是把属性匹配收紧成：

```text
(^|空白) + 属性名 + ="..."
```

这说明：

```text
哪怕是很小的 CI summary 脚本，
也值得用一份模拟失败报告做 dry run。
```

否则真正等 CI 红的时候，summary 本身也可能给错信息。

### 4. 为什么仍然不用 XML 解析依赖

这次增强后，脚本解析的内容仍然很有限：

```text
testsuites 基础统计
testcase 的 classname / name
failure / error 的 type / message / body
```

所以当前继续使用 Node.js 标准库就够。
但这里要留一个边界：

```text
如果后面要解析更复杂的 XML 结构、CDATA 变体、嵌套失败信息，
或者要把报告发成 PR comment，
就应该重新评估成熟 XML/CI report 库。
```

### 5. 这版的学习点

```text
1. CI 红灯时，Summary 最有价值的信息是“哪条 case + 什么错误”
2. 失败报告能力要用模拟失败输入验证，不能只用全绿报告验证
3. 简单字符串解析也要小心属性名误匹配，例如 name / classname
4. 脚本支持环境变量覆盖路径，会让本地 dry run 和后续排查更顺手
5. 当前无依赖实现够用，但复杂报告需求出现后应重新评估成熟库
```

### 第三十三版验证结果

```text
模拟失败 JUnit dry run
  成功展示 FAILURE / ERROR、case 名、文件、错误类型、错误消息和错误片段

npm.cmd run test:ci
  43 个文件、270 个测试通过

npm.cmd run ci:summary
  成功输出 Vitest CI Summary Markdown

npm.cmd test
  43 个文件、270 个测试通过

当前 coverage:
  Statements: 95.04%
  Branches: 87.86%
  Functions: 95.96%
  Lines: 94.95%
```

## 第三十四版：coverage 阈值对比 / baseline diff / PR comment

这一版继续补的是 CI 报告的“决策能力”。
前面 Summary 已经能回答：

```text
跑了多少测试
失败了哪些 case
当前覆盖率是多少
```

但还缺两个更工程化的问题：

```text
当前覆盖率离阈值还有多远？
这次覆盖率相比基线是涨了还是跌了？
PR 页面能不能直接看到报告？
```

所以第三十四版补了三件事：

```text
1. coverage threshold 对比
2. 可选 baseline coverage diff
3. 同仓库 PR 自动评论报告
```

### 1. coverage threshold 对比

继续修改：

```text
scripts/write-ci-summary.mjs
```

Summary 现在新增一块：

```text
Coverage Thresholds
```

展示：

```text
Metric
Current
Threshold
Delta
Status
```

当前默认对比的是 CI 这条链路的全局阈值：

```text
statements: 85
branches: 50
functions: 87
lines: 85
```

注意这里不是替代 Vitest 自己的 threshold。
Vitest 仍然负责真正 fail 掉测试；Summary 只是把差距用更直观的表格展示出来。

如果后面要调整 summary 展示阈值，可以通过环境变量覆盖：

```text
CI_SUMMARY_COVERAGE_THRESHOLDS='{"statements":90,"branches":80,"functions":90,"lines":90}'
```

### 2. 可选 baseline coverage diff

Summary 现在也支持可选 baseline diff。

使用方式：

```text
VITEST_BASE_COVERAGE_SUMMARY_PATH=<path-to-baseline-coverage-summary.json>
```

如果配置了 baseline，会展示：

```text
Coverage Diff
```

包含：

```text
Current
Baseline
Delta
```

如果没有配置 baseline，则明确提示：

```text
没有配置 baseline coverage
```

这一版先做成“可选输入”，没有强行接主分支历史 artifact。
原因是主分支 baseline 的来源有几种方案：

```text
1. 下载上一次 main 的 artifact
2. 用 GitHub Pages / release asset 存 coverage summary
3. PR job 里额外 checkout base 分支跑一次 coverage
```

这些方案都有成本。
所以第一步先把脚本能力打通，后面再决定 baseline 从哪里来。

### 3. PR comment 报告

CI 里新增了：

```text
Comment PR with Vitest summary
```

它会读取：

```text
reports/vitest/summary.md
```

然后在 PR 下创建或更新一条固定评论。
固定评论通过 marker 识别：

```text
<!-- harness-agent-lab-vitest-summary -->
```

这样后续每次 CI 跑完，不会刷出一堆新评论，
而是更新同一条 summary。

### 4. 为什么只对同仓库 PR 自动评论

这一步有权限边界。
PR comment 需要写权限：

```text
issues: write
pull-requests: write
```

但 fork PR 的 token 权限经常是受限的。
所以当前 workflow 加了保护条件：

```text
github.event_name == 'pull_request'
github.event.pull_request.head.repo.full_name == github.repository
```

也就是说：

```text
同仓库 PR：自动评论
fork PR：跳过评论，但 Step Summary 和 artifact 仍然可用
```

这比盲目对所有 PR 评论更稳。

### 5. summary.md 作为可复用产物

脚本现在不仅写：

```text
GITHUB_STEP_SUMMARY
```

还会同步写：

```text
reports/vitest/summary.md
```

这份文件有三个用途：

```text
1. GitHub PR comment 直接复用
2. artifact 上传后可下载
3. 本地 npm.cmd run ci:summary 后可直接查看
```

所以 CI 报告现在不再是“只存在于 Step Summary 里的一段文本”，
而是变成了一个可复用的产物。

### 6. 这版为什么暂时不引入 XML/CI report 库

这一版虽然增强了不少，但复杂度仍然可控：

```text
coverage diff 基于 JSON
threshold 对比基于数字
PR comment 复用 Markdown
JUnit 仍只读取少量字段
```

所以暂时继续不引入 XML/CI report 库。
但边界已经很清楚：

```text
如果后续要做跨 job 聚合、趋势图、复杂 XML 兼容、PR 上多维度 diff，
就应该重新评估成熟报告库，而不是继续把脚本越写越重。
```

### 7. 这版的学习点

```text
1. threshold 负责“是否达标”，diff 负责“相比基线变化”
2. Step Summary 适合人快速看，summary.md 适合作为可复用产物
3. PR comment 要避免刷屏，应该用 marker 更新同一条评论
4. fork PR 的写权限不稳定，自动评论要先做权限保护
5. baseline diff 能力可以先做成可选输入，再决定 baseline 来源
```

### 第三十四版验证结果

```text
npm.cmd run ci:summary
  成功输出 Coverage Thresholds
  未配置 baseline 时会提示如何设置 VITEST_BASE_COVERAGE_SUMMARY_PATH

模拟 baseline coverage dry run
  成功输出 Coverage Diff
  能展示 Statements / Branches / Functions / Lines 的 delta

npm.cmd run test:ci
  43 个文件、270 个测试通过

npm.cmd test
  43 个文件、270 个测试通过

当前 coverage:
  Statements: 95.04%
  Branches: 87.86%
  Functions: 95.96%
  Lines: 94.95%
```

## 第三十五版：主分支 baseline artifact / PR comment 样式 / XML 解析库

这一版把前面剩下的三个 CI 报告增强一起收口：

```text
1. 自动从主分支 artifact 拉 baseline coverage
2. 更清晰的 PR comment 报告样式
3. 引入成熟 XML 解析库，替代手写 JUnit XML 正则解析
```

### 1. 自动从主分支 artifact 拉 baseline coverage

第三十四版里，summary 脚本已经支持：

```text
VITEST_BASE_COVERAGE_SUMMARY_PATH
```

但 baseline 文件还需要外部提供。
第三十五版把这件事接进 GitHub Actions：

```text
Find main baseline coverage run
Download main baseline coverage artifact
Write Vitest summary
```

流程是：

```text
PR 触发 coverage job
  ↓
查找 base 分支最近一次成功的 ci.yml workflow run
  ↓
下载该 run 上传的 vitest-reports-node20-ubuntu artifact
  ↓
从 artifact 里读取 coverage/coverage-summary.json
  ↓
设置 VITEST_BASE_COVERAGE_SUMMARY_PATH
  ↓
生成 Coverage Diff
```

当前 artifact 名称仍然是：

```text
vitest-reports-node20-ubuntu
```

baseline 文件预期位置是：

```text
reports/vitest-baseline/coverage/coverage-summary.json
```

如果主分支还没有成功 run，或者 artifact 已经过期 / 不存在，
summary 不会让 CI 失败，而是显示：

```text
configured but missing
```

并提示检查 artifact。

### 2. 为什么 baseline 下载只在 PR 上跑

baseline diff 的核心问题是：

```text
当前 PR 相比 base 分支涨了还是跌了？
```

所以这一步只在：

```text
pull_request
```

事件上有意义。
push 到 main 时，本身就是 baseline 生产者，不需要再下载自己对比自己。

### 3. PR comment 样式继续升级

第三十四版已经能把 `summary.md` 评论到 PR。
第三十五版把报告样式改成更适合 PR 页面第一眼阅读：

```text
Vitest CI Report
Status
Quick View
Test Result
Coverage
Coverage Thresholds
Coverage Diff
Lowest Branch Coverage
Failed Cases
Artifacts
```

其中新增的 `Quick View` 会集中展示：

```text
Tests
Coverage
Thresholds
Baseline diff
```

这样 PR 页面上不需要先读完整报告，
先看 Quick View 就能知道这一轮大体是否健康。

### 4. PR comment 的权限边界

自动评论仍然只对同仓库 PR 开启：

```text
github.event_name == 'pull_request'
github.event.pull_request.head.repo.full_name == github.repository
```

原因是 fork PR 的 token 写权限不稳定。
fork PR 仍然可以看：

```text
GitHub Step Summary
artifact
```

但不会强行发评论。

### 5. 引入成熟 XML 解析库

第三十三版之前，`scripts/write-ci-summary.mjs` 用少量正则解析 JUnit XML。
这个在小范围内可用，但已经出现过一次真实坑：

```text
name="..."
误匹配到
classname="..."
```

第三十五版引入：

```text
fast-xml-parser
```

用途是：

```text
解析 reports/vitest/junit.xml
读取 testsuites / testsuite / testcase / failure / error
```

这样失败 case 的：

```text
name
classname
type
message
details
```

都不再靠手写 XML 正则解析。

### 6. 为什么这次只引入 XML 解析库，而不是更大的 CI report 框架

这轮做了一个边界判断：

```text
XML 解析是通用能力，交给成熟库。
报告内容组织是项目口径，暂时保留在脚本里。
```

也就是说：

```text
JUnit XML 结构解析 -> fast-xml-parser
Markdown Summary / PR comment 内容 -> scripts/write-ci-summary.mjs
```

这样既减少了 XML 解析坑，
又不会为了当前还不算复杂的报告样式引入过重的 CI report 框架。

如果以后继续升级到：

```text
多 job 聚合
历史趋势图
HTML 报告
多格式测试报告合并
复杂 PR comment 模板
```

那时再评估专门的 CI report 库会更合适。

### 7. 这版的学习点

```text
1. baseline diff 能力要分两步做：脚本支持输入，再由 CI 自动提供输入
2. PR comment 要先做 Quick View，不要一上来就让人读完整报告
3. artifact 下载失败不能让 CI 直接失败，应该降级成“无 baseline diff”
4. XML 解析属于通用工程能力，出现复杂度后应交给成熟库
5. CI report 生成仍然可以保留项目口径，避免过早引入大框架
```

### 第三十五版验证结果

```text
npm.cmd run ci:summary
  通过，Quick View / Coverage Thresholds / summary.md 正常输出

模拟失败 JUnit dry run
  通过，fast-xml-parser 能正确读取 failure / error

模拟 baseline coverage dry run
  通过，能输出 Coverage Diff

模拟 baseline path 缺失
  通过，会提示 configured but missing

npm.cmd run test:ci
  43 个文件、270 个测试通过

npm.cmd test
  43 个文件、270 个测试通过

git diff --check
  通过

当前 coverage:
  Statements: 95.04%
  Branches: 87.86%
  Functions: 95.96%
  Lines: 94.95%
```

## 第二十三版：matcher 第五版（assignment / runnable batch / execution record）

这一版把前面明确挂着的 matcher 第五版一次性收口了：

```text
1. assignment 断言
2. runnable batch 断言
3. execution record 断言
```

### 1. 新增的领域 matcher

新增能力落在：

```text
tests/setup/custom-matchers.ts
tests/setup/vitest.d.ts
tests/setup/custom-matchers.test.ts
```

这次补上的 matcher 是：

```text
toHaveAssignment(taskId, expectedPartial)
toHaveRunnableBatch(expectedPartial)
toHaveExecutionRecord(expectedPartial)
```

它们分别回答：

```text
1. 某个任务最终被分配给了谁
2. 当前协调帧决定这一轮 batch 怎么跑
3. 某次任务执行最终留下了什么结构化记录
```

### 2. 为什么这三类值得单独抽 matcher

因为这一层已经不是“看一个字段对不对”，而是“看任务协作语义对不对”：

```text
assignment：分工语义
runnable batch：本轮调度语义
execution record：任务落盘结果语义
```

如果继续手写原始断言，测试很容易退回成：

```text
frame.assignments[0]?.assignedOwner
frame.runnableBatch?.taskIds
task.lastExecution?.actorOwner
```

路径又长又脆，而且一旦容器包了一层，测试就要整片改。

### 3. 这次迁移到新 matcher 的代表性测试

这一版同步把几组代表性测试迁过去了：

```text
tests/team/team-coordinator.test.ts
tests/runtime/runtime-bundle.test.ts
tests/orchestration/orchestration.test.ts
```

覆盖到的真实场景包括：

```text
1. team coordinator 生成 assignment + parallel batch
2. runtime buildCoordinationFrame 产出 assignment / batch
3. runtime parallel batch 执行后，把 actorOwner 写进 execution record
4. orchestrator retryTask 写回 synthetic lastExecution
```

### 4. 这版补出来的一个关键语义点

这轮有个很值钱的修正：

```text
assignment.mode 不等于 runnableBatch.mode
```

也就是说：

```text
assignment.mode：更像单个任务分配时的执行偏好
runnableBatch.mode：更像本轮批执行策略
```

所以测试里不能想当然地把两者绑成同一个断言。

### 5. 这版的学习点

```text
1. matcher 继续推进时，优先抽“领域语义对象”，不是抽“更长的字段路径”
2. assignment 和 runnable batch 看起来接近，但语义层级不同
3. execution record 适合做容器适配，因为它既可能直接出现，也可能挂在 lastExecution 下
4. 代表性测试迁移很重要，不然 matcher 很容易变成“有实现、没人用”
5. 真正稳定的 matcher，不是把所有字段绑死，而是只断关键语义字段
```

### 第二十三版验证结果

```text
npm.cmd run typecheck:test
  通过

npm.cmd run test:orchestration
  3 个文件、31 个测试通过

npm.cmd run test:team
  7 个文件、32 个测试通过

npm.cmd run test:runtime
  4 个文件、57 个测试通过

npm.cmd test
  40 个文件、243 个测试通过

npm.cmd run test:ci
  40 个文件、243 个测试通过

npm.cmd run test:coverage:per-file
  40 个文件、243 个测试通过

当前 coverage:
  Statements: 94.99%
  Branches: 87.78%
  Functions: 95.96%
  Lines: 94.90%
```
