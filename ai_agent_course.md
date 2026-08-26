# Vercel AI Agent Harness 中文精读

这份读物来自 Vercel Academy 的 `Build Your Own AI Coding Agent Harness` 课程。
目标不是逐字直译，而是保留原课程结构、代码、命令和设计逻辑，同时把正文整理成更适合中文阅读和复习的格式。

## 如何阅读

1. 先看前 4 节，建立 `chatbot -> agent`、`tool -> verification` 的基本心智模型。
2. 中段重点看安全执行、上下文构建、状态恢复、memory pruning、subagent delegation。
3. 后段重点看 CLI、Web surface、skills、custom tools 和 extension points，它们决定产品如何从 demo 走向可扩展系统。

## 课程主线

- 从没有工具的聊天模型，演进到会读代码、会调用 shell、会请求审批、会验证结果的 agent。
- 把一次性 prompt 技巧，升级成可恢复、可调试、可评估、可扩展的 agent harness。
- 用长期状态、memory、skills、custom tools 和多界面承载，让 coding agent 真正进入真实开发流程。


## 01. 从聊天到代理
原文标题：From Chat to Agent
原文链接：https://vercel.com/academy/build-ai-agent-harness/from-chat-to-agent
导读：使用零个工具构建一个 ToolLoopAgent，然后添加一个工具并观察聊天机器人成为代理。
您的经纪人是世界上最自信的实习生。 要求它查看您的 `tsconfig.json`，它会很高兴地描述其中可能有什么。 要求它找到第 42 行的错误，它会提供一个非常合理的修复。

它尚未打开该文件。 它不能。 聊天机器人没有工具，因此它会根据代码通常的样子进行模式匹配，并将其作为分析。

一个工具可以解决这个问题。 我们将添加 `read` 并将实习生从一个自信的解释者转变为实际打开文件的人。

### 结果

您有一个 `ToolLoopAgent`，在出现提示时，它会调用 `read` 工具来检查已知文件并报告其发现的内容。

### 快速通道

1. 使用 `ToolLoopAgent`、`instructions`、`model` 和 `stopWhen: stepCountIs(10)` 创建 `index.ts`
2. 无需工具即可运行它，并观看聊天机器人解释它会做什么
3. 添加带有 Zod `inputSchema` 和 500 行上限的 `read` 工具，然后再次运行它

### 实践练习 1.1

在 `index.ts` 中构建尽可能最小的代理，然后添加一个工具。

**要求：**

1. 从 `ai` 导入 `ToolLoopAgent`、`stepCountIs` 和 `tool`，并从 `zod` 导入 `z`
2. 使用 `model: "anthropic/claude-haiku-4-5"`、简要说明和 `stopWhen: stepCountIs(10)` 创建代理
3. 添加接受 `path`、可选 `offset` 和可选 `limit` 的 `read` 工具
4. 输出上限为 500 行，并在每行前面加上行号

**实施提示：**

- `ToolLoopAgent` 采用 `instructions`、`model`、`tools` 和 `stopWhen`。 使用 `instructions`，而不是 `system`
- 使用 `agent.generate({ prompt })` 呼叫代理，而不是 `agent.generate(prompt)`
- `tool()` 上的 `description` 字段是对模型的提示，而不是文档字符串。 模型读取它来决定何时调用该工具
- 解析工作目录的路径，以便代理不会意外读取项目外部的文件

#### 聊天机器人

从尽可能小的代理开始。 没有工具，只有说明：

```ts title="index.ts"
import { ToolLoopAgent, stepCountIs } from "ai";

const cwd = process.argv[2] || process.cwd();

const agent = new ToolLoopAgent({
  model: "anthropic/claude-haiku-4-5",
  instructions: `You are a coding agent.\nWorking directory: ${cwd}`,
  tools: {},
  stopWhen: stepCountIs(10),
});

const prompt = process.argv.slice(3).join(" ") || "Hello!";
const { text, steps } = await agent.generate({ prompt });
console.log(text);
console.log(`\n(${steps.length} steps)`);
```

运行它：

```bash title="Terminal"
bun run index.ts . "What files are in this project?"
```

您将得到礼貌、乐于助人且完全虚构的答复。 诸如“我很乐意帮助您探索项目文件！”*之类的内容，然后是有关它将查看的内容的建议（如果可以的话）。 这就是聊天机器人。

```
(1 steps)
```

一步。 没有工具调用。 模型会说话，这就是它能做的一切。

**注意：AI SDK v6 命名**

使用 `instructions`（不是 `system`）、`stopWhen`（不是 `stopCondition`）和 `agent.generate({ prompt })`（不是 `agent.generate(prompt)`）。 SDK 版本之间的名称发生了变化。 错误的名称会静默编译，但代理的行为与您期望的方式不同。

#### 一种工具改变一切

现在添加一个 `read` 工具。 这就是将聊天机器人转变为代理的原因：

```ts title="index.ts" {1-2,4-5,8-28,32}
import { ToolLoopAgent, stepCountIs, tool } from "ai";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const cwd = resolve(process.argv[2] || process.cwd());

const read = tool({
  description: `Read a file from the project. Returns numbered lines.
WHEN TO USE: viewing file contents, checking configs, reading source code.
WHEN NOT TO USE: searching across files (use grep instead).`,
  inputSchema: z.object({
    path: z.string().describe("File path relative to working directory"),
    offset: z.number().optional().describe("Start line (1-indexed)"),
    limit: z.number().optional().describe("Max lines to return"),
  }),
  execute: async ({ path: filePath, offset, limit }) => {
    const abs = resolve(cwd, filePath);
    const content = readFileSync(abs, "utf-8");
    let lines = content.split("\n");

    if (offset) lines = lines.slice(offset - 1);
    if (limit) lines = lines.slice(0, limit);

    const MAX_LINES = 500;
    const truncated = lines.length > MAX_LINES;
    if (truncated) lines = lines.slice(0, MAX_LINES);

    const numbered = lines.map((l, i) => `${(offset || 1) + i}: ${l}`);
    return truncated
      ? numbered.join("\n") + `\n... (truncated at ${MAX_LINES} lines)`
      : numbered.join("\n");
  },
});

const agent = new ToolLoopAgent({
  model: "anthropic/claude-haiku-4-5",
  instructions: `You are a coding agent.\nWorking directory: ${cwd}`,
  tools: { read },
  stopWhen: stepCountIs(10),
});
```

`description` 字段所做的工作比看起来要多。 该模型在决定下一步做什么之前会读取每个工具的描述。 何时使用和何时不使用并不适合您。 它们是模型用来选择这个工具而不是另一个工具的提示。

#### 为什么有 500 行上限

注意 `MAX_LINES = 500`。 如果没有它，10,000 行文件上的无界 `read` 会将每一行转储到上下文窗口中，并且代理会在会话的其余部分保留该结果。 一次粗心的阅读可能会占用 10% 的可用上下文。

您将看到这一规则应用于课程中的每个工具。 上下文管理后来有了自己的模块，但这个习惯是从工具本身开始的。

### 尝试一下

使用与 `read` 实际可以执行的操作一致的提示运行代理：

```bash title="Terminal"
bun run index.ts . "Read the tsconfig.json"
```

您应该看到模型调用 `read`，然后总结文件。 两步而不是一步：

```
Here's the tsconfig.json:
- target: ESNext
- moduleResolution: bundler
- strict: true

(2 steps)
```

这就是整个转变。 一种工具调用，一种响应。 该模型选择 `read` 因为描述告诉它何时选择。

**注意：选择与工具匹配的提示**

`read` 可以检查已知文件。 它无法枚举目录。 在接下来的两课中添加 `grep` 和 `bash` 之前，请坚持遵循 `Read the tsconfig.json` 或 `Read package.json` 等提示。

健全性检查类型：

```bash title="Terminal"
npx tsc --noEmit
```

### 犯罪

```bash
git add index.ts
git commit -m "feat(agent): add ToolLoopAgent with read tool"
```

### 完成时间

- [ ] `index.ts` 使用 `read` 工具导出 `ToolLoopAgent`
- [ ] 聊天机器人版本（无工具）一步后返回
- [ ] 代理版本（带有 `read`）调用该工具并报告文件内容
- [ ] `read` 返回带有可选偏移量和限制的编号行
- [ ] 输出在 500 行处截断并带有清晰的消息
- [ ] `npx tsc --noEmit` 通行证

**注意：尝试不加盖子**

使用 `seq 1 1000 > /tmp/big.txt` 创建一个 1000 行的文件，然后要求代理读取它。 删除 `MAX_LINES = 500` 防护并再次运行。 观察反应的增长。 现在考虑一下 30 个步骤的任务会是什么样子。 模型的推理还是代币限制首先被打破？

### 解决方案

```ts title="index.ts"
import { ToolLoopAgent, stepCountIs, tool } from "ai";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const cwd = resolve(process.argv[2] || process.cwd());

const read = tool({
  description: `Read a file from the project. Returns numbered lines.
WHEN TO USE: viewing file contents, checking configs, reading source code.
WHEN NOT TO USE: searching across files (use grep instead).`,
  inputSchema: z.object({
    path: z.string().describe("File path relative to working directory"),
    offset: z.number().optional().describe("Start line (1-indexed)"),
    limit: z.number().optional().describe("Max lines to return"),
  }),
  execute: async ({ path: filePath, offset, limit }) => {
    const abs = resolve(cwd, filePath);
    const content = readFileSync(abs, "utf-8");
    let lines = content.split("\n");

    if (offset) lines = lines.slice(offset - 1);
    if (limit) lines = lines.slice(0, limit);

    const MAX_LINES = 500;
    const truncated = lines.length > MAX_LINES;
    if (truncated) lines = lines.slice(0, MAX_LINES);

    const numbered = lines.map((l, i) => `${(offset || 1) + i}: ${l}`);
    return truncated
      ? numbered.join("\n") + `\n... (truncated at ${MAX_LINES} lines)`
      : numbered.join("\n");
  },
});

const agent = new ToolLoopAgent({
  model: "anthropic/claude-haiku-4-5",
  instructions: `You are a coding agent.\nWorking directory: ${cwd}`,
  tools: { read },
  stopWhen: stepCountIs(10),
});

const prompt = process.argv.slice(3).join(" ") || "Hello!";
const { text, steps } = await agent.generate({ prompt });
console.log(text);
console.log(`\n(${steps.length} steps)`);
```

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 02. 你的第一个工具
原文标题：Your First Tools
原文链接：https://vercel.com/academy/build-ai-agent-harness/your-first-tools
导读：添加 grep 并了解为什么工具描述是模型选择 API，而不是文档。
在上一课中，您将 `read` 交给了代理，并将聊天机器人变成了有用的东西。 有用，但有限。 您的代理只能打开它已经知道名称的文件。 要求它“查找所有 TODO 注释”，它就会开始猜测哪些文件可能有注释，然后一一读取它们。

那不是寻找。 这就是礼貌地挥舞。

添加 `grep` ，代理将获得真正的搜索工具。 但现在你有一个新问题。 每次接受任务时，模型都必须在 `read` 和 `grep` 之间进行选择。 除非你告诉它如何做，否则它会选择错误。

### 结果

您拥有一个具有丰富的行为塑造描述的 `grep` 工具。 该模型使用 `grep` 进行搜索，使用 `read` 进行文件检查，路由完全由描述决定。

### 快速通道

1. 添加具有正则表达式模式、可选全局过滤器和 50 匹配上限的 `grep` 工具
2. 使用何时使用、何时不使用、不要使用以及示例来编写描述
3. 更新 `read` 的描述以匹配相同的合约

### 实践练习 1.2

构建 `grep` 工具，然后重写这两个描述，直到模型正确路由。

**要求：**

1. 添加带有 `pattern`、可选 `path` 和可选 `glob` 的 Zod 架构的 `grep` 工具
2. 使用 `execSync` 和 `grep -rn` 实现 `execute`，不包括 `node_modules` 和 `.git`
3. 输出上限为 50 场比赛并报告总计数
4. 使用四部分合同编写 `read` 和 `grep` 的描述：何时使用、何时不使用、请勿使用、示例

**实施提示：**

- 从 `node:child_process` 导入 `execSync`
- 将输入引用到 shell 命令中以避免特殊字符中断
- 将 `grep` 的非零退出（未找到匹配项）视为成功，而不是错误
- 描述是模型用于选择工具的 API。 为模型而写，而不是为读者而写

#### 观看错误的工具获胜

从最简单的描述开始，看看情况有多糟糕：

```ts title="index.ts"
const grep = tool({
  description: "Search files.",
  inputSchema: z.object({
    pattern: z.string(),
    glob: z.string().optional(),
  }),
  // ... execute with execSync grep
});
```

现在询问代理：

```bash title="Terminal"
bun run index.ts . "Find all TODO comments in this project"
```

该模型忽略 `grep` 并获取 `read`，打开随机文件并希望其中有一个 TODO。 如果您已经添加了 `bash`，它会尝试添加。 两个词的描述并没有给模型提供任何可以使用的东西，所以它猜测。

这是工具选择第一次变得重要。 这也是第一次断裂。

#### 描述是提示

该修复并不是更好的实现。 这是一个更好的描述：

```ts title="index.ts"
const grep = tool({
  description: `Search file contents using regex. Returns matching lines with file paths.
WHEN TO USE: finding patterns across multiple files, locating function definitions,
  searching for imports, finding TODOs or error messages.
WHEN NOT TO USE: reading a known file (use read instead).
DO NOT USE FOR: running commands, listing directories.
EXAMPLES:
  - Find all TODO comments: pattern "TODO" glob "*.ts"
  - Find function definitions: pattern "function \\\\w+" glob "*.ts"`,
  inputSchema: z.object({
    pattern: z.string().describe("Regex pattern to search for"),
    path: z.string().optional().describe("Directory to search (default: working dir)"),
    glob: z.string().optional().describe("File glob filter, e.g. '*.ts'"),
  }),
  execute: async ({ pattern, path: searchPath, glob: globFilter }) => {
    const dir = resolve(cwd, searchPath || ".");
    const escapedPattern = pattern.replace(/'/g, `'\\''`);
    const escapedGlob = (globFilter || "*").replace(/'/g, `'\\''`);
    const cmd = `grep -rn --exclude-dir=node_modules --exclude-dir=.git --include='${escapedGlob}' -E '${escapedPattern}' '${dir}' 2>/dev/null`;

    try {
      const stdout = execSync(cmd, { encoding: "utf-8", timeout: 10_000 });
      const lines = stdout.trim().split("\\n").filter(Boolean);

      const MAX_MATCHES = 50;
      const truncated = lines.length > MAX_MATCHES;
      const result = truncated ? lines.slice(0, MAX_MATCHES) : lines;

      return truncated
        ? result.join("\\n") + `\\n... (${lines.length} total, showing first ${MAX_MATCHES})`
        : result.join("\\n") || "No matches found.";
    } catch (error: any) {
      const stdout = String(error?.stdout || "").trim();
      if (stdout) {
        const lines = stdout.split("\\n").filter(Boolean);
        const MAX_MATCHES = 50;
        const truncated = lines.length > MAX_MATCHES;
        const result = truncated ? lines.slice(0, MAX_MATCHES) : lines;
        return truncated
          ? result.join("\\n") + `\\n... (${lines.length} total, showing first ${MAX_MATCHES})`
          : result.join("\\n");
      }
      return "No matches found.";
    }
  },
});
```

该描述中发生了两件事。 何时使用使该工具的工作清晰可见。 何时不使用并且不使用用于引导模型远离默认使用它最喜欢的任何工具，（根据我们的经验）通常是 `bash`。

**注意：重击重力**

当工具描述较弱时，我们测试过的每个模型（Haiku、Sonnet、Opus）都默认为 `bash`。 生产线束使负转向加倍，每个工具上都有“何时不使用”和“不要使用”，因为说一次是不够的。 本课程中的模式来自于观察智能体不断选择错误后的真实安全带。

现在对 `read` 进行相同的处理。 对 `read` 的描述必须同样强烈地反驳 `grep` ：

```ts title="index.ts"
const read = tool({
  description: `Read a file from the project. Returns numbered lines.
WHEN TO USE: viewing file contents, checking configs, reading source code.
WHEN NOT TO USE: searching across files (use grep instead).
DO NOT USE FOR: running commands, listing directories.`,
  // ... rest unchanged
});
```

#### 为何限制 50 场比赛

`grep` 获得与 `read` 相同的上下文相关处理。 如果没有上限，在大型代码库中搜索 `import` 会导致上下文中充满代理不需要的数百行导入。 50场比赛足以回答这个问题。 500是污染。

### 尝试一下

运行带有重写描述的搜索提示：

```bash title="Terminal"
bun run index.ts . "Find all TODO comments in this project"
```

您应该看到模型直接调用 `grep`，使用 `TODO` 这样的模式和 `*.ts` 这样的全局变量。 在一个小文件中植入几个 `// TODO:` 注释，这样结果就很明显了。 排除 `node_modules` 可以使输出集中在您的代码上，而不是依赖项上。

现在运行文件检查提示：

```bash title="Terminal"
bun run index.ts . "Read the tsconfig.json"
```

这仍然使用 `read`，而不是 `grep`。 这些描述在两个方向上引导模型。 搜索提示指向 `grep`。 已知文件提示指向 `read`。

```bash title="Terminal"
npx tsc --noEmit
```

**注意：故意让验证变得无聊**

真正的代码库有太多的匹配项。 将两个 `// TODO:` 注释放入您控制的小文件中，然后运行搜索。 重点是验证路由，而不是发现错误。 让测试变得明显。

### 犯罪

```bash
git add index.ts
git commit -m "feat(tools): add grep with behavioral description contract"
```

### 完成时间

- [ ] `"Find all TODO comments"` 调用 `grep`，而不是 `read` 或 `bash`
- [ ] `"Read the tsconfig.json"` 调用 `read`，而不是 `grep`
- [ ] `grep` 上限为 50 场比赛，并在截断后报告总数
- [ ] `read` 和 `grep` 都使用 WHEN TO USE、WHEN NOT TO USE 和 DO NOT USE FOR
- [ ] `npx tsc --noEmit` 通行证

**注意：推动描述直到它们中断**

开始一次一节地削弱 `grep` 的描述。 首先删除示例。 那么请勿用于。 那么什么时候不使用。 模型在什么时候切换回 `bash` 或 `read`？ Haiku、Sonnet 和 Opus 之间的阈值是否有变化？

### 解决方案

```ts title="index.ts"
import { ToolLoopAgent, stepCountIs, tool } from "ai";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const cwd = resolve(process.argv[2] || process.cwd());

const read = tool({
  description: `Read a file from the project. Returns numbered lines.
WHEN TO USE: viewing file contents, checking configs, reading source code.
WHEN NOT TO USE: searching across files (use grep instead).
DO NOT USE FOR: running commands, listing directories.`,
  inputSchema: z.object({
    path: z.string().describe("File path relative to working directory"),
    offset: z.number().optional().describe("Start line (1-indexed)"),
    limit: z.number().optional().describe("Max lines to return"),
  }),
  execute: async ({ path: filePath, offset, limit }) => {
    const abs = resolve(cwd, filePath);
    const content = readFileSync(abs, "utf-8");
    let lines = content.split("\n");

    if (offset) lines = lines.slice(offset - 1);
    if (limit) lines = lines.slice(0, limit);

    const MAX_LINES = 500;
    const truncated = lines.length > MAX_LINES;
    if (truncated) lines = lines.slice(0, MAX_LINES);

    const numbered = lines.map((l, i) => `${(offset || 1) + i}: ${l}`);
    return truncated
      ? numbered.join("\n") + `\n... (truncated at ${MAX_LINES} lines)`
      : numbered.join("\n");
  },
});

const grep = tool({
  description: `Search file contents using regex. Returns matching lines with file paths.
WHEN TO USE: finding patterns across multiple files, locating function definitions,
  searching for imports, finding TODOs or error messages.
WHEN NOT TO USE: reading a known file (use read instead).
DO NOT USE FOR: running commands, listing directories.
EXAMPLES:
  - Find all TODO comments: pattern "TODO" glob "*.ts"
  - Find function definitions: pattern "function \\\\w+" glob "*.ts"`,
  inputSchema: z.object({
    pattern: z.string().describe("Regex pattern to search for"),
    path: z.string().optional().describe("Directory to search (default: working dir)"),
    glob: z.string().optional().describe("File glob filter, e.g. '*.ts'"),
  }),
  execute: async ({ pattern, path: searchPath, glob: globFilter }) => {
    const dir = resolve(cwd, searchPath || ".");
    const escapedPattern = pattern.replace(/'/g, `'\\''`);
    const escapedGlob = (globFilter || "*").replace(/'/g, `'\\''`);
    const cmd = `grep -rn --exclude-dir=node_modules --exclude-dir=.git --include='${escapedGlob}' -E '${escapedPattern}' '${dir}' 2>/dev/null`;

    try {
      const stdout = execSync(cmd, { encoding: "utf-8", timeout: 10_000 });
      const lines = stdout.trim().split("\\n").filter(Boolean);

      const MAX_MATCHES = 50;
      const truncated = lines.length > MAX_MATCHES;
      const result = truncated ? lines.slice(0, MAX_MATCHES) : lines;

      return truncated
        ? result.join("\\n") + `\\n... (${lines.length} total, showing first ${MAX_MATCHES})`
        : result.join("\\n") || "No matches found.";
    } catch (error: any) {
      const stdout = String(error?.stdout || "").trim();
      if (stdout) {
        const lines = stdout.split("\\n").filter(Boolean);
        const MAX_MATCHES = 50;
        const truncated = lines.length > MAX_MATCHES;
        const result = truncated ? lines.slice(0, MAX_MATCHES) : lines;
        return truncated
          ? result.join("\\n") + `\\n... (${lines.length} total, showing first ${MAX_MATCHES})`
          : result.join("\\n");
      }
      return "No matches found.";
    }
  },
});

const agent = new ToolLoopAgent({
  model: "anthropic/claude-haiku-4-5",
  instructions: `You are a coding agent.\nWorking directory: ${cwd}`,
  tools: { read, grep },
  stopWhen: stepCountIs(10),
});

const prompt = process.argv.slice(3).join(" ") || "Hello!";
const { text, steps } = await agent.generate({ prompt });
console.log(text);
console.log(`\n(${steps.length} steps)`);
```

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 03. 完成工具箱
原文标题：Completing the Toolbox
原文链接：https://vercel.com/academy/build-ai-agent-harness/completing-the-toolbox
导读：添加带有安全门的 bash，因为可以 rm -rf 的代理需要约束。
您的代理读取文件。 它搜索代码。 它要做的下一件事是运行命令。 也许`npm test`。 也许`git status`。 也许，在糟糕的一天，`rm -rf /`。

Bash 是您可以为代理提供的最有用的工具，也是最危险的工具。 在本课中，我们将添加它，然后对其施加约束。

### 结果

您有一个 `bash` 工具，可以在工作目录中运行命令，并由白名单控制。 安全命令自动运行。 诚实地说，任何其他操作都会返回一条块消息，模型将其传递回用户。

### 快速通道

1. 添加带有 `SAFE_PREFIXES` 允许列表的 `bash` 工具（`ls`、`cat`、`git status` 和朋友）
2. 使用明确的错误字符串阻止不在允许列表中的任何内容
3. 验证模型报告块而不是捏造成功

### 实践练习 1.3

将 `bash` 添加到代理并在 `execute` 层对其进行门控。

**要求：**

1. 从 `node:child_process` 导入 `execSync`
2. 使用只读命令定义 `SAFE_PREFIXES` 数组，例如 `ls`、`cat`、`pwd`、`git status`、`git log`、`git diff`
3. 编写 `isSafe(command)` 检查以与允许列表进行比较
4. 在 `execute` 中，如果命令不安全，则返回块消息，否则运行它
5. 用四部分合同编写工具描述

**实施提示：**

- 按前缀匹配，而不是精确命令。 `ls -la` 应匹配 `ls`
- 在 `execSync` 上设置 `timeout` ，以便挂起的进程不会冻结代理
- 阻止消息应该准确地告诉模型什么被阻止了。 该模型会将其传递给用户
- AI SDK 有一个 `needsApproval` 选项。 我们这里不使用它。 请参阅下文了解原因

#### 为什么不使用`needsApproval`？

AI SDK 在 `tool()` 上为您提供了一个 `needsApproval` 字段，看起来它完全符合我们的要求。 事实并非如此。

```ts
const bash = tool({
  needsApproval: () => true,
  execute: async ({ command }) => {
    // This never runs, but the model thinks it did
  },
});
```

当 `needsApproval` 返回 `true` 时，SDK 在响应中创建 `tool-approval-request` 并跳过执行。 如果您没有连接批准处理程序，工具调用就会消失。 该模型没有返回结果，因此它补了一个：*“完成！我删除了文件。”*

该模型认为该命令已运行。 用户看到一条成功消息。 命令没有运行。 这比运行命令更糟糕，因为用户不知道出了什么问题。

**警告：needApproval 是一个信号，而不是一个门**

`needsApproval` 告诉线束“这需要人类的批准。” 安全带的工作就是实际做一些事情。 没有周围的流动，受阻的工具会悄无声息地消失，模型会用虚构来填补空白。

我们将在 [Module 8](../08-human-in-the-loop/01-structured-questions) 中构建适当的审批流程。 现在，我们在 `execute` 内部进行门控，因此模型始终会返回一个真实的字符串。

#### 执行级门

添加带有白名单的工具：

```ts title="index.ts"
import { execSync } from "node:child_process";

const SAFE_PREFIXES = [
  "ls", "cat", "echo", "pwd", "which", "find",
  "head", "tail", "wc", "git log", "git status", "git diff",
];

function isSafe(command: string): boolean {
  return SAFE_PREFIXES.some((p) => command.trim().startsWith(p));
}

const bash = tool({
  description: `Execute a shell command in the working directory.
WHEN TO USE: running build commands, installing packages, running tests,
  git operations, directory listings.
WHEN NOT TO USE: reading file contents (use read instead).
  Searching for patterns (use grep instead).
DO NOT USE FOR: reading files (use read), searching code (use grep).`,
  inputSchema: z.object({
    command: z.string().describe("Shell command to execute"),
  }),
  execute: async ({ command }) => {
    if (!isSafe(command)) {
      return `Blocked: "${command}" requires approval. Only safe commands (${SAFE_PREFIXES.join(", ")}) run automatically.`;
    }
    try {
      const stdout = execSync(command, {
        cwd,
        encoding: "utf-8",
        timeout: 30_000,
      });
      return stdout || "(no output)";
    } catch (e: any) {
      return `Exit ${e.status ?? 1}: ${e.stdout || e.stderr || e.message || ""}`;
    }
  },
});
```

重要的模式：当命令被阻止时，该工具返回一个字符串。 该字符串最终作为工具结果出现在对话中。 该模型像读取任何其他结果一样读取它，并可以将块如实传回给用户。

### 尝试一下

运行映射到安全命令的提示：

```bash title="Terminal"
bun run index.ts . "List all files in this directory"
```

模型应该到达 `bash`，选择一个安全命令，如 `ls` 或 `find`，然后返回输出。

现在尝试一些危险的事情：

```bash title="Terminal"
bun run index.ts . "Run the command: rm -rf node_modules"
```

该模型使用 `rm -rf` 调用 `bash`。 门挡住了它。 块消息作为工具结果返回，模型将其传递给您：

```
The command "rm -rf node_modules" requires approval.
Only safe commands run automatically.
```

这就是重点。 没有无声的失败。 没有虚构的成功。

**警告：注意创意重写**

如果您说“删除 `node_modules`”，模型可能会尝试使用 `find . -name node_modules -exec rm -rf {} +` 而不是 `rm -rf`。 我们的前缀检查捕获了 `rm` 但 `find -exec` 却漏掉了。 生产线束使用正则表达式模式来执行危险命令。 我们保留前缀检查是因为它很清楚，而不是因为它完整。

```bash title="Terminal"
npx tsc --noEmit
```

### 三种工具，一种代理

您现在拥有所有三个工具：

| 工具   | 目的             | 安全                    |
| ------ | ------------------- | ------------------------- |
| `read` | 查看文件内容  | 500行上限              |
| `grep` | 跨文件搜索 | 50场比赛上限              |
| `bash` | 运行外壳命令  | `SAFE_PREFIXES` 允许名单 |

描述引导选择。 上限保护上下文。 门可以保护您的机器。 该代理是有用且受控的。

### 犯罪

```bash
git add index.ts
git commit -m "feat(tools): add bash with execute-level safety gate"
```

### 完成时间

- [ ] `ls`、`find` 和 `git status` 等安全命令通过 `bash` 运行
- [ ] 自然语言文件读取提示仍然路由到 `read`，而不是 `bash` 和 `cat`
- [ ] `rm -rf`、`sudo` 和其他未知命令返回块消息
- [ ] 模型向用户报告被阻止的命令，而不是假装它们成功了
- [ ] `npx tsc --noEmit` 通行证

**注意：草拟审批流程**

执行级门是诚实但生硬的。 真正的安全带会询问用户。 尝试添加一个 `needsApproval` 检查，为非安全命令返回 `true`，暂停循环，并向用户显示类似 *“代理想要运行 `npm install express`。允许吗？”的提示* 批准恢复工具结果。 拒绝以拒绝消息继续，以便模型可以适应。 您将在模块 8 中正确构建它，但现在值得绘制草图，以了解为什么一旦代理运行 50 个命令，交互式审批就会变得复杂。

### 解决方案

```ts title="index.ts"
import { ToolLoopAgent, stepCountIs, tool } from "ai";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const cwd = resolve(process.argv[2] || process.cwd());

const SAFE_PREFIXES = [
  "ls", "cat", "echo", "pwd", "which", "find",
  "head", "tail", "wc", "git log", "git status", "git diff",
];

function isSafe(command: string): boolean {
  return SAFE_PREFIXES.some((p) => command.trim().startsWith(p));
}

const read = tool({
  description: `Read a file from the project. Returns numbered lines.
WHEN TO USE: viewing file contents, checking configs, reading source code.
WHEN NOT TO USE: searching across files (use grep instead).
DO NOT USE FOR: running commands, listing directories.`,
  inputSchema: z.object({
    path: z.string().describe("File path relative to working directory"),
    offset: z.number().optional().describe("Start line (1-indexed)"),
    limit: z.number().optional().describe("Max lines to return"),
  }),
  execute: async ({ path: filePath, offset, limit }) => {
    const abs = resolve(cwd, filePath);
    const content = readFileSync(abs, "utf-8");
    let lines = content.split("\n");

    if (offset) lines = lines.slice(offset - 1);
    if (limit) lines = lines.slice(0, limit);

    const MAX_LINES = 500;
    const truncated = lines.length > MAX_LINES;
    if (truncated) lines = lines.slice(0, MAX_LINES);

    const numbered = lines.map((l, i) => `${(offset || 1) + i}: ${l}`);
    return truncated
      ? numbered.join("\n") + `\n... (truncated at ${MAX_LINES} lines)`
      : numbered.join("\n");
  },
});

const grep = tool({
  description: `Search file contents using regex. Returns matching lines with file paths.
WHEN TO USE: finding patterns across multiple files, locating function definitions,
  searching for imports, finding TODOs or error messages.
WHEN NOT TO USE: reading a known file (use read instead).
DO NOT USE FOR: running commands, listing directories.
EXAMPLES:
  - Find all TODO comments: pattern "TODO" glob "*.ts"
  - Find function definitions: pattern "function \\\\w+" glob "*.ts"`,
  inputSchema: z.object({
    pattern: z.string().describe("Regex pattern to search for"),
    path: z.string().optional().describe("Directory to search (default: working dir)"),
    glob: z.string().optional().describe("File glob filter, e.g. '*.ts'"),
  }),
  execute: async ({ pattern, path: searchPath, glob: globFilter }) => {
    const dir = resolve(cwd, searchPath || ".");
    const escapedPattern = pattern.replace(/'/g, `'\\''`);
    const escapedGlob = (globFilter || "*").replace(/'/g, `'\\''`);
    const cmd = `grep -rn --exclude-dir=node_modules --exclude-dir=.git --include='${escapedGlob}' -E '${escapedPattern}' '${dir}' 2>/dev/null`;

    try {
      const stdout = execSync(cmd, { encoding: "utf-8", timeout: 10_000 });
      const lines = stdout.trim().split("\\n").filter(Boolean);

      const MAX_MATCHES = 50;
      const truncated = lines.length > MAX_MATCHES;
      const result = truncated ? lines.slice(0, MAX_MATCHES) : lines;

      return truncated
        ? result.join("\\n") + `\\n... (${lines.length} total, showing first ${MAX_MATCHES})`
        : result.join("\\n") || "No matches found.";
    } catch (error: any) {
      const stdout = String(error?.stdout || "").trim();
      if (stdout) {
        const lines = stdout.split("\\n").filter(Boolean);
        const MAX_MATCHES = 50;
        const truncated = lines.length > MAX_MATCHES;
        const result = truncated ? lines.slice(0, MAX_MATCHES) : lines;
        return truncated
          ? result.join("\\n") + `\\n... (${lines.length} total, showing first ${MAX_MATCHES})`
          : result.join("\\n");
      }
      return "No matches found.";
    }
  },
});

const bash = tool({
  description: `Execute a shell command in the working directory.
WHEN TO USE: running build commands, installing packages, running tests,
  git operations, directory listings.
WHEN NOT TO USE: reading file contents (use read instead).
  Searching for patterns (use grep instead).
DO NOT USE FOR: reading files (use read), searching code (use grep).`,
  inputSchema: z.object({
    command: z.string().describe("Shell command to execute"),
  }),
  execute: async ({ command }) => {
    if (!isSafe(command)) {
      return `Blocked: "${command}" requires approval. Only safe commands (${SAFE_PREFIXES.join(", ")}) run automatically.`;
    }
    try {
      const stdout = execSync(command, {
        cwd,
        encoding: "utf-8",
        timeout: 30_000,
      });
      return stdout || "(no output)";
    } catch (e: any) {
      return `Exit ${e.status ?? 1}: ${e.stdout || e.stderr || e.message || ""}`;
    }
  },
});

const agent = new ToolLoopAgent({
  model: "anthropic/claude-haiku-4-5",
  instructions: `You are a coding agent.\nWorking directory: ${cwd}`,
  tools: { read, grep, bash },
  stopWhen: stepCountIs(10),
});

const prompt = process.argv.slice(3).join(" ") || "Hello!";
const { text, steps } = await agent.generate({ prompt });
console.log(text);
console.log(`\n(${steps.length} steps)`);
```

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 04. 有效的描述
原文标题：Descriptions That Work
原文链接：https://vercel.com/academy/build-ai-agent-harness/descriptions-that-work
导读：工具描述从单行文字到结构化合约的演变，以及为什么每个领域都很重要。
当您在 [The Agent Loop](../01-agent-loop/01-from-chat-to-agent) 中编写第一个工具描述时，您使用了两个部分：何时使用和何时不使用。 这足以让路由与三个工具一起工作。

添加第四个工具。 添加第五个。 添加子代理并编辑、编写和待办事项。 模型再次开始变得模糊。 它选择 `bash` 来处理 `read` 应该处理的事情，或者跳过 `grep` 来进行探索性 `read` 循环，打开二十个文件。

修复方法与之前相同。 我们只是需要更多。

### 结果

您的工具中的每个工具都有一个由 5 部分组成的描述合同（何时使用、何时不使用、不要使用、用法、示例），并且模型可以在不明确的提示中正确路由。

### 快速通道

1. 将每个工具的描述扩展为 5 个部分
2. 添加用于参数指导的 USAGE 和用于具体调用的示例
3. 保留加倍的负数（何时不使用和不使用），因为如果没有它，每个模型都会泄漏回 `bash`

### 实践练习 2.1

重构 `index.ts` 中每个工具的描述以使用完整的合约。

**要求：**

1. 每个描述都以该工具的功能及其输出格式的一行摘要开头
2. WHEN TO USE 使用模型将在提示中看到的关键字列出 2-4 个特定场景
3. 何时不使用按名称重定向到其他工具
4. 不要使用 FOR 重复负转向作为硬边界
5. USAGE 解释参数约束和默认值
6. 示例显示了 2-3 个带输入的具体调用

**实施提示：**

- 何时不使用是软的（“更喜欢 X”）。 DO NOT USE FOR 很难（“永远不要将此用于 Y”）。 你两者都想要
- 当描述较弱时，模型默认为 `bash` 。 反复的否定就是反作用力
- 当参数具有模型无法从模式（上限、默认值、编码）推断出的约束时，USAGE 就占据一席之地

#### 为什么要加倍负片

您可能会同时查看“WHEN NOT TO USE”和“DO NOT USE FOR”，并认为他们在说同一件事两次。 他们是。 这就是重点。

在我们的测试中：

- 俳句读到“WHEN NOT TO USE”，但在含糊不清的情况下忽略它
- Sonnet 尊重 WHEN NOT TO USE，但受益于 DO NOT USE FOR 作为强化
- Opus 处理得很好，重复也没有坏处

当描述很薄弱时，我们测试过的每个模型都倾向于 `bash`。 我们称之为 bash 重力，即对最通用工具的普遍拉力。 仅仅说“不要用它来搜索”一次并不总是足够的。 几乎总是说两遍。

#### 完整合同

以下是每个部分的作用，应用于 `grep`：

```ts title="index.ts"
const grep = tool({
  description: `Search file contents using regex. Returns matching lines with file paths.

WHEN TO USE: finding patterns across multiple files, locating function definitions,
  searching for imports, finding TODOs or error messages.

WHEN NOT TO USE: reading a known file (use read instead).
  Running commands (use bash instead).

DO NOT USE FOR: reading files (use read), listing directories (use bash),
  modifying files (use edit).

USAGE: pattern is a regex string. glob filters by file extension.
  Results are capped at 50 matches.

EXAMPLES:
  - Find all TODO comments: pattern "TODO" glob "*.ts"
  - Find function definitions: pattern "function \\w+" glob "*.ts"
  - Find imports of a package: pattern "from 'express'" glob "*.ts"`,
  // ... inputSchema and execute unchanged
});
```

这是对 `read` 的相同处理：

```ts title="index.ts"
const read = tool({
  description: `Read a file from the project. Returns numbered lines.

WHEN TO USE: viewing file contents, checking configurations, reading source code,
  examining specific lines with offset/limit.

WHEN NOT TO USE: searching for patterns across files (use grep instead).
  Running commands (use bash instead).

DO NOT USE FOR: searching code (use grep), executing commands (use bash),
  modifying files (use edit or write).

USAGE: path is relative to working directory. offset and limit are optional.
  Output is capped at 500 lines.`,
  // ... rest unchanged
});
```

和 `bash`：

```ts title="index.ts"
const bash = tool({
  description: `Execute a shell command in the working directory.

WHEN TO USE: running build commands, installing packages, running tests,
  git operations, directory listings.

WHEN NOT TO USE: reading file contents (use read instead).
  Searching for patterns (use grep instead).

DO NOT USE FOR: reading files (use read), searching code (use grep).

USAGE: command is a single shell string. Commands not in the safe-prefix
  allowlist are blocked and return a clear error message.

EXAMPLES:
  - List files: command "ls -la"
  - Check git status: command "git status"
  - Run a test suite: command "npm test"`,
  // ... rest unchanged
});
```

#### 为什么每个部分都值得保留

| 部分         | 目的                                                         |
| --------------- | --------------------------------------------------------------- |
| 第一行      | 该工具做什么，返回什么                             |
| 何时使用     | 提示将使用关键字的特定场景            |
| 何时不使用 | 软重定向到正确的工具                                 |
| 请勿用于  | 硬边界，重述                                         |
| 用法           | 模式无法捕获的约束（上限、默认值、编码） |
| 例子        | 模型的具体调用以进行模式匹配             |

描述变得更长。 没关系。 工具描述位于系统提示符中，SDK 在轮流之间缓存该提示符。 您只需为代币支付一次费用。

### 尝试一下

每个工具形状运行一个提示并验证布线：

```bash title="Terminal"
bun run index.ts . "Find all TODO comments in this project"
bun run index.ts . "Read the package.json"
bun run index.ts . "List all files in this directory"
```

你应该看到：

- TODO 提示调用 `grep`
- package.json 提示调用 `read`
- 列表文件提示使用 `ls` 调用 `bash`

```bash title="Terminal"
npx tsc --noEmit
```

**注意：对每个形状使用一个提示进行验证**

选择一个仅指向一个工具的提示。 `grep` 为搜索形，`read` 为文件形，`bash` 为贝壳形。 混合提示（例如“显示 package.json 内容”）有时会使用 `cat` 路由到 `read` 或 `bash`，这不是路由错误，而是一个不明确的提示。

### 犯罪

```bash
git add index.ts
git commit -m "feat(tools): expand descriptions to full 5-section contract"
```

### 完成时间

- [ ] 所有三个工具都有所有 5 个部分的说明
- [ ] TODO 搜索提示路由至 `grep`
- [ ] 文件读取提示符路由至 `read`
- [ ] shell 列表提示符路由到 `bash`
- [ ] `npx tsc --noEmit` 通行证

**注意：找到最薄弱的环节**

选择您写的描述并开始剥离。 放弃例子。 请勿用于以下用途。 放弃使用。 每次测试后，运行所有三个测试提示。 路由在什么时候中断？ 它首先在哪里破裂？ 第一个翻转的模型是您找到其地板的模型。

### 解决方案

```ts title="index.ts"
const read = tool({
  description: `Read a file from the project. Returns numbered lines.

WHEN TO USE: viewing file contents, checking configurations, reading source code,
  examining specific lines with offset/limit.

WHEN NOT TO USE: searching for patterns across files (use grep instead).
  Running commands (use bash instead).

DO NOT USE FOR: searching code (use grep), executing commands (use bash),
  modifying files (use edit or write).

USAGE: path is relative to working directory. offset and limit are optional.
  Output is capped at 500 lines.`,
  // ... inputSchema and execute from Module 1
});

const grep = tool({
  description: `Search file contents using regex. Returns matching lines with file paths.

WHEN TO USE: finding patterns across multiple files, locating function definitions,
  searching for imports, finding TODOs or error messages.

WHEN NOT TO USE: reading a known file (use read instead).
  Running commands (use bash instead).

DO NOT USE FOR: reading files (use read), listing directories (use bash),
  modifying files (use edit).

USAGE: pattern is a regex string. glob filters by file extension.
  Results are capped at 50 matches.

EXAMPLES:
  - Find all TODO comments: pattern "TODO" glob "*.ts"
  - Find function definitions: pattern "function \\w+" glob "*.ts"
  - Find imports of a package: pattern "from 'express'" glob "*.ts"`,
  // ... inputSchema and execute from Module 1
});

const bash = tool({
  description: `Execute a shell command in the working directory.

WHEN TO USE: running build commands, installing packages, running tests,
  git operations, directory listings.

WHEN NOT TO USE: reading file contents (use read instead).
  Searching for patterns (use grep instead).

DO NOT USE FOR: reading files (use read), searching code (use grep).

USAGE: command is a single shell string. Commands not in the safe-prefix
  allowlist are blocked and return a clear error message.

EXAMPLES:
  - List files: command "ls -la"
  - Check git status: command "git status"
  - Run a test suite: command "npm test"`,
  // ... inputSchema and execute from Module 1
});
```

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 05. Shell 安全执行
原文标题：Shell Execution with Safety
原文链接：https://vercel.com/academy/build-ai-agent-harness/shell-execution-with-safety
导读：提取工具工厂模式，将模型所看到的内容与命令的执行方式分开。
你的 bash 工具可以工作，但是描述、安全检查和对 `execSync` 的调用在一个大闭包中相互重叠。 如果有一个 bash 工具就很好了。 当您想要在本机以外的其他地方运行命令时，它就不再正常了。

从现在开始的几个模块，我们将把本地执行替换为沙箱。 当这种情况发生时，您不想重写 bash 工具。 你想给它一个不同的后端，让其余的保持不变。

这就是工厂模式的用途。

### 结果

您有一个 `createBashTool(operations, safePrefixes)` 工厂，它返回完全配置的 `bash` 工具。 面向模型的契约（描述、模式、安全检查）存在于工厂中。 执行后端通过 `operations` 对象注入。

### 快速通道

1. 使用一种方法 `exec(command)` 定义 `BashOperations` 接口
2. 将现有的 bash 工具包装在 `createBashTool(operations, safePrefixes)` 中
3. 构造一个包装 `execSync` 的 `localOps` 对象，然后用它构建工具

### 动手练习 2.2

将 bash 拉出到具有可交换执行后端的工厂函数中。

**要求：**

1. 使用 `exec(command: string): Promise<{ stdout: string; exitCode: number }>` 定义 `BashOperations`
2. 写入返回 `tool()` 的 `createBashTool(operations: BashOperations, safePrefixes: string[])`
3. 使用注入的 `safePrefixes` 在工厂内部进行安全检查
4. 构建一个包装 `execSync` 的 `localOps` 实现
5. 将现有的 `bash` 常量替换为 `const bash = createBashTool(localOps, SAFE_PREFIXES)`

**实施提示：**

- 工厂在 `operations` 和 `safePrefixes` 期间关闭。 工具内部的`execute`函数直接调用`operations.exec(command)`而不是`execSync`
- Localops 统一处理标准输出和错误。 无论命令成功与否，都返回 `{ stdout, exitCode }`
- 暂时不要重构 `read` 。 工厂模式在后端实际发生变化的地方赢得了它的地位，目前只是 `bash`

#### 接缝去哪里

现在你的 bash 工具直接调用 `execSync` ：

```ts title="index.ts"
execute: async ({ command }) => {
  if (!isSafe(command)) return "Blocked...";
  const stdout = execSync(command, { cwd, encoding: "utf-8", timeout: 30_000 });
  return stdout;
}
```

当您稍后添加沙箱时，它将变为 `sandbox.exec(command)`。 相同的想法，不同的后端。 工厂在两者之间引入了一条接缝：

```ts title="index.ts"
interface BashOperations {
  exec(command: string): Promise<{ stdout: string; exitCode: number }>;
}
```

模型看到的所有东西都存在于接缝之上。 实际运行命令的所有内容都位于下面。

#### 建厂

```ts title="index.ts"
function createBashTool(operations: BashOperations, safePrefixes: string[]) {
  function isSafe(command: string): boolean {
    return safePrefixes.some((p) => command.trim().startsWith(p));
  }

  return tool({
    description: `Execute a shell command in the working directory.

WHEN TO USE: running build commands, installing packages, running tests,
  git operations, directory listings.

WHEN NOT TO USE: reading file contents (use read instead).
  Searching for patterns (use grep instead).

DO NOT USE FOR: reading files (use read), searching code (use grep).

USAGE: command is a single shell string. Commands not in the safe-prefix
  allowlist are blocked and return a clear error message.`,
    inputSchema: z.object({
      command: z.string().describe("Shell command to execute"),
    }),
    execute: async ({ command }) => {
      if (!isSafe(command)) {
        return `Blocked: "${command}" requires approval.`;
      }
      const { stdout } = await operations.exec(command);
      return stdout || "(no output)";
    },
  });
}
```

请注意发生了什么：没有 `execSync`，没有 `cwd` 引用，没有了解 Node 的 `child_process` 的错误处理。 工厂只知道有一个叫做 `operations.exec` 的东西，并且它返回标准输出。

#### 构建本地后端

`localOps` 对象是实际 `execSync` 调用现在所在的位置：

```ts title="index.ts"
const localOps: BashOperations = {
  exec: async (command) => {
    try {
      const stdout = execSync(command, {
        cwd,
        encoding: "utf-8",
        timeout: 30_000,
      });
      return { stdout, exitCode: 0 };
    } catch (e: any) {
      return {
        stdout: e.stdout || e.stderr || e.message || "",
        exitCode: e.status ?? 1,
      };
    }
  },
};

const bash = createBashTool(localOps, SAFE_PREFIXES);
```

当您在模块 4 中构建沙箱抽象时，交换是一行：

```ts title="index.ts (preview, Module 4)"
const sandboxOps: BashOperations = {
  exec: (command) => sandbox.exec(command),
};

const bash = createBashTool(sandboxOps, SAFE_PREFIXES);
```

相同的工具。 后端不同。 描述、架构和安全检查不变。

**注意：为什么只有bash，而不是read**

您可以将相同的工厂模式应用于 `read`。 我们还没有这样做。 当后端真正发生变化时，工厂就会获得收入。 对于 `read`，这要到模块 4 才会发生。对于 `bash`，执行后端和安全策略已经在向相反的方向发展。 在有压力的时候重构，而不是之前。

### 尝试一下

运行安全命令以确保工厂接线正确：

```bash title="Terminal"
bun run index.ts . "List all files in this directory"
```

输出与之前相同。 相同的阻止命令行为。 模型无法看出任何变化，这就是重点。

尝试阻止命令以确保安全检查仍然有效：

```bash title="Terminal"
bun run index.ts . "Run: rm -rf node_modules"
```

您仍然应该收到阻止消息。

```bash title="Terminal"
npx tsc --noEmit
```

### 犯罪

```bash
git add index.ts
git commit -m "refactor(bash): extract createBashTool with operations interface"
```

### 完成时间

- [ ] 使用 `exec(command)` 定义的 `BashOperations` 接口
- [ ] `createBashTool(operations, safePrefixes)` 返回一个工作工具
- [ ] `localOps` 包装 `execSync` 并返回 `{ stdout, exitCode }`
- [ ] 安全命令仍然运行，被阻止的命令仍然返回阻止消息
- [ ] `npx tsc --noEmit` 通行证

**注意：绘制沙箱交换草图**

在尚未构建它的情况下，编写一个实际上不运行任何东西的 `mockOps: BashOperations` 。 对于任何命令只需返回 `{ stdout: "(pretend output)", exitCode: 0 }` 即可。 将 `localOps` 替换为 `mockOps` 并观察代理获得所有看似合理但虚假的输出。 这是让模块 4 中的沙箱抽象能够工作而无需重写工具的接缝。

### 解决方案

```ts title="index.ts"
interface BashOperations {
  exec(command: string): Promise<{ stdout: string; exitCode: number }>;
}

function createBashTool(operations: BashOperations, safePrefixes: string[]) {
  function isSafe(command: string): boolean {
    return safePrefixes.some((p) => command.trim().startsWith(p));
  }

  return tool({
    description: `Execute a shell command in the working directory.

WHEN TO USE: running build commands, installing packages, running tests,
  git operations, directory listings.

WHEN NOT TO USE: reading file contents (use read instead).
  Searching for patterns (use grep instead).

DO NOT USE FOR: reading files (use read), searching code (use grep).

USAGE: command is a single shell string. Commands not in the safe-prefix
  allowlist are blocked and return a clear error message.`,
    inputSchema: z.object({
      command: z.string().describe("Shell command to execute"),
    }),
    execute: async ({ command }) => {
      if (!isSafe(command)) {
        return `Blocked: "${command}" requires approval.`;
      }
      const { stdout } = await operations.exec(command);
      return stdout || "(no output)";
    },
  });
}

const localOps: BashOperations = {
  exec: async (command) => {
    try {
      const stdout = execSync(command, {
        cwd,
        encoding: "utf-8",
        timeout: 30_000,
      });
      return { stdout, exitCode: 0 };
    } catch (e: any) {
      return {
        stdout: e.stdout || e.stderr || e.message || "",
        exitCode: e.status ?? 1,
      };
    }
  },
};

const bash = createBashTool(localOps, SAFE_PREFIXES);
```

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 06. 审批门
原文标题：Approval Gates
原文链接：https://vercel.com/academy/build-ai-agent-harness/approval-gates
导读：将批准从布尔值演变为函数，再到可配置的可区分联合。
您在模块 1 中构建的白名单只有一种模式：阻止列表中未列出的任何内容。 对于演示来说这很好。 对于真正的安全带来说这并不好。

CI 没有人可以询问。 子代理需要继承其父代理的一部分信任，而不是完整的许可名单。 本地运行代理的人可能希望批准 `npm install express` 一次，并且在三步后不再被询问。

同一个门。 三种不同的操作模式。 我们将通过改进配置本身的形状来实现这一目标，从布尔值到函数，再到可区分的联合。

### 结果

`createBashTool` 接受具有三种模式的 `ApprovalConfig` 可区分联合：`interactive`、`background` 和 `delegated`。 当 `needsApproval` 返回 true 时，每种模式都会形成。

### 快速通道

1. 将 `ApprovalConfig` 定义为具有三种模式的可区分联合
2. 编写返回 `needsApproval` 函数的 `createApproval(config)`
3. 将结果传递到 `createBashTool` 并验证每种模式的行为不同

### 实践练习 2.3

用可配置的批准系统替换静态安全前缀检查。

**要求：**

1. 使用三个变体定义 `ApprovalConfig`：`{ mode: "interactive" }`、`{ mode: "background" }`、`{ mode: "delegated"; trust: string[] }`
2. 写入返回 `(input) => boolean` 的 `createApproval(config: ApprovalConfig)`
3. 更新 `createBashTool` 以接受批准函数作为参数
4. 使用相同的命令测试每种模式并验证门行为变化

**实施提示：**

- `background` 为所有内容返回 `false` （已批准）。 这适用于 CI 和自动化运行
- `delegated` 根据 `config.trust` 检查输入并仅批准匹配项
- `interactive` 根据安全前缀列表检查输入并批准安全前缀。 其他任何事情都需要人类的批准
- 当需要批准时，该函数返回 `true`，当命令可以运行时，该函数返回 `false`

#### 第一阶段：布尔运算

最简单的批准门是一个布尔值：

```ts title="index.ts"
needsApproval: true
```

这会阻止每个呼叫。 `ls`、`pwd`、`rm -rf`，全部。 它没什么用，但它确定了形状。 `needsApproval` 是“我们应该在运行之前暂停以等待人类批准吗？”的问题。

#### 第二阶段：功能

函数可以让您根据输入回答该问题：

```ts title="index.ts"
needsApproval: ({ command }) => {
  if (SAFE_PREFIXES.some(p => command.startsWith(p))) return false;
  return true;
}
```

更好的。 `ls` 运行。 `rm -rf` 块。 但该函数只知道一条内置规则。CI 与本地终端具有相同的门。 子代理与其父代理拥有相同的门。 如果不重写函数就无法重新配置。

#### 第三阶段：受歧视的工会

配置携带模式。 工厂从模式构建函数：

```ts title="index.ts"
type ApprovalConfig =
  | { mode: "interactive" }
  | { mode: "background" }
  | { mode: "delegated"; trust: string[] };

function createApproval(config: ApprovalConfig) {
  return ({ command }: { command: string }) => {
    if (config.mode === "background") return false;

    if (config.mode === "delegated") {
      return !config.trust.some((p) => command.trim().startsWith(p));
    }

    return !SAFE_PREFIXES.some((p) => command.trim().startsWith(p));
  };
}
```

三种模式，一种功能。 受歧视的联合使模式具有类型化和排他性。 TypeScript 仅在 `delegated` 分支内将 `config.trust` 缩小为 `string[]`，这是布尔值和函数无法捕获的错误。

现在 `createBashTool` 采用批准函数而不是安全前缀列表：

```ts title="index.ts"
function createBashTool(
  operations: BashOperations,
  needsApproval: (input: { command: string }) => boolean,
) {
  return tool({
    // ... same description and schema
    execute: async ({ command }) => {
      if (needsApproval({ command })) {
        return `Blocked: "${command}" requires approval.`;
      }
      const { stdout } = await operations.exec(command);
      return stdout || "(no output)";
    },
  });
}
```

这三种模式在调用站点看起来像这样：

```ts title="index.ts"
// Interactive: human approves anything not on the safe list
const bash = createBashTool(localOps, createApproval({ mode: "interactive" }));

// Background: auto-approve everything (CI, automation)
const bash = createBashTool(localOps, createApproval({ mode: "background" }));

// Delegated: subagent inherits a trust slice from its parent
const bash = createBashTool(
  localOps,
  createApproval({ mode: "delegated", trust: ["pwd", "find .", "git status"] }),
);
```

**注意：为什么是有区别的联合而不是三个函数**

您可以只编写三个单独的函数：`interactiveApproval`、`backgroundApproval`、`delegatedApproval`。 歧视联合获胜，因为配置是数据，而不是代码。 您可以从 `AGENTS.md` 加载它，使用 Zod (`z.discriminatedUnion("mode", [...])`) 对其进行验证，跨子代理边界对其进行序列化，并让用户无需接触线束代码即可更改模式。

#### 这解锁了什么

`background` 是显而易见的。 代理在 CI 中运行，无需人工询问，您足够信任提示即可放手。

`delegated` 是有趣的。 当子代理启动时，您不会向其提供完整的安全前缀列表。 您将其工作所需的特定命令交给它。 只读浏览器获取 `pwd`、`find`、`git status`。 运行测试的执行器获取 `npm test`、`npm run build`。 父代理根据命令决定委托什么信任。

`interactive` 是您已经在做的事情，现在只是表示为配置。

### 尝试一下

使用应该阻止的命令和应该通过的命令尝试每种模式：

```bash title="Terminal"
bun run index.ts . "Run: git status"
```

在 `interactive` 模式下，这会通过（它在安全列表上）。 在 `background` 模式下，任何事情都会过去。 在带有 `trust: ["git status"]` 的 `delegated` 模式下，它会通过。

```bash title="Terminal"
bun run index.ts . "Run: npm install express"
```

在 `interactive` 模式下，这会阻塞。 在 `background` 模式下，它会运行（并且可能会失败，因为我们没有连接 npm，但这是一个不同的问题）。 在 `delegated` 模式下，除非 `npm install` 位于信任列表中，否则它会阻塞。

```bash title="Terminal"
npx tsc --noEmit
```

**注意：批准结果与命令结果**

命令可能会被批准，但仍然会因普通原因而失败。 `npm test` 通过门，然后由于测试失败而以非零值退出。 这是命令的问题，而不是批准的问题。 调试时将它们分开。

### 犯罪

```bash
git add index.ts
git commit -m "feat(approval): add discriminated union config with three modes"
```

### 完成时间

- [ ] `ApprovalConfig` 是与 `interactive`、`background`、`delegated` 的可区分联合
- [ ] `createApproval(config)` 返回 `needsApproval` 函数
- [ ] `createBashTool` 接受批准函数作为参数
- [ ] 每种模式至少对于一个安全命令和一个不安全命令表现正确
- [ ] `npx tsc --noEmit` 通行证

**注意：会话级信任升级**

交互模式每次都会自动拒绝每个未知命令。 那很快就会变老。 尝试添加 `Set<string>` 来跟踪用户在会话期间批准的模式。 当用户批准 `npm test` 时，添加模式。 下一个 `npm test` 调用将跳过提示。 添加 `trust --list` 命令以显示可信内容。 现在考虑一下粒度：`npm install` 应该信任一切，还是只信任 `npm install express`？

### 解决方案

```ts title="index.ts"
type ApprovalConfig =
  | { mode: "interactive" }
  | { mode: "background" }
  | { mode: "delegated"; trust: string[] };

function createApproval(config: ApprovalConfig) {
  return ({ command }: { command: string }) => {
    if (config.mode === "background") return false;

    if (config.mode === "delegated") {
      return !config.trust.some((p) => command.trim().startsWith(p));
    }

    return !SAFE_PREFIXES.some((p) => command.trim().startsWith(p));
  };
}

function createBashTool(
  operations: BashOperations,
  needsApproval: (input: { command: string }) => boolean,
) {
  return tool({
    description: `Execute a shell command in the working directory.

WHEN TO USE: running build commands, installing packages, running tests,
  git operations, directory listings.

WHEN NOT TO USE: reading file contents (use read instead).
  Searching for patterns (use grep instead).

DO NOT USE FOR: reading files (use read), searching code (use grep).

USAGE: command is a single shell string. Commands not approved by the
  approval policy are blocked and return a clear error message.`,
    inputSchema: z.object({
      command: z.string().describe("Shell command to execute"),
    }),
    execute: async ({ command }) => {
      if (needsApproval({ command })) {
        return `Blocked: "${command}" requires approval.`;
      }
      const { stdout } = await operations.exec(command);
      return stdout || "(no output)";
    },
  });
}

const bash = createBashTool(localOps, createApproval({ mode: "interactive" }));
```

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 07. 结构代理说明
原文标题：Structuring Agent Instructions
原文链接：https://vercel.com/academy/build-ai-agent-harness/structuring-agent-instructions
导读：将 Agency 和 Guardrails 部分添加到系统提示中，使工具优先的行为明确且可重复。
现在你的系统提示只有一行： `You are a coding agent.` 这不是提示。 那是一个名字标签。

您的工具已经完成了大部分转向工作。 模块 2 中的描述足够强大，代理可能会选择 `read` 进行读取任务，选择 `grep` 进行搜索，而无需太多帮助。 那么系统提示是什么意思呢？

这是您写下政策的地方。 不是代理*可以*做什么（这就是工具）。 代理人“应该”做什么，以什么顺序，以什么样的限制。 名牌上不会有这个。 将出现分段提示。

### 结果

`instructions` 是带有显式 Agency 和 Guardrails 块的分段提示。 代理执行任务（使用工具、报告结果），而不是解释它假设会做什么。

### 快速通道

1. 将 `You are a coding agent.` 替换为分段提示
2. 添加代理部分：使用工具，不解释，更喜欢专用工具而不是 `bash`
3. 添加 Guardrails 部分：最小的更改，创建前搜索，不询问就没有新的部门

### 实践练习 3.1

重写 `index.ts` 中的 `instructions` 字段以使用结构化的多部分提示。

**要求：**

1. 使用一行角色声明和工作目录打开
2. 添加 `# Agency` 部分告诉代理采取行动，而不是解释
3. 添加带有约束的 `# Guardrails` 部分（最小更改、重用、无新的 deps）
4. 继续使用模板文字，以便工作目录插入

**实施提示：**

- 节标题（`# Agency`、`# Guardrails`）使您和模型都可以扫描提示
- 明确地给出负面指示（“不要解释你会做什么”）。 模型默认解释
- 按名称引用您的工具。 该模型已经有描述，但在提示中指向它们可以加强路由

#### 之前的

```ts title="index.ts"
instructions: `You are a coding agent.\nWorking directory: ${cwd}`,
```

这有效。 代理在询问时读取文件，在询问时进行搜索，在询问时运行命令。 但没有政策。 要求它“找到所有 TODO 评论并修复它们”，响应完全取决于模型那一刻的心情。 也许它起作用了。 也许它会制定一个计划并等待您批准。

这种歧义就是提示的目的。

#### 之后的

```ts title="index.ts"
instructions: `You are a coding agent working in: ${cwd}


- USE your tools. Read files, search code, run commands, then answer.
- Do NOT explain what you WOULD do. Actually do it.
- Prefer grep for searching, read for viewing files.
- Use bash only for commands that aren't covered by other tools.


- Prefer simple, minimal changes
- Search before creating, and reuse existing patterns
- No new dependencies without asking`,
```

现在政策已经写下来了。 代理部分向代理提供行动许可和指示。 护栏部分设置了限制。

有几点需要注意：

- “完成任务”的指示是明确的。 如果没有它，特工们就会倾向于解释。 大声说“实际去做”是非常必要的
- 工具首选项位于提示和描述中。 重复是故意的。 我们在两个地方说了这一点，因为模型在一处漏掉了它
- “无需询问就不会产生新的依赖关系”在模块 8 中设置了人机交互工作

#### 实际发生了什么变化

代理人已经有了工具。 它已经有描述了。 新鲜的是操作策略现在是可移植的。 您可以使用不同的工具将此提示复制到其他代理，并且该策略仍然适用。 您可以对其进行 A/B 测试。 您可以为子代理提出一个部分。

单行提示无法做到这一点。 分段提示即可。

**注意：剖面解剖**

| 部分               | 目的                                                     |
| --------------------- | ----------------------------------------------------------- |
| 角色线             | 代理人是谁以及在哪里工作                     |
| 机构                | 执行任务的许可和指示                  |
| 护栏            | 如何行动：最小化、重用优先、部门保守      |
| 工具使用（稍后）    | 哪种工具适合哪种工作，尤其是在混合工具会话中 |
| 沟通（稍后） | 如何报告结果                                  |

从代理和护栏开始。 当提示超过 20 行左右时，另外两行就获得了自己的位置。

### 尝试一下

在更改之前和之后运行相同的提示来查看代理的姿势如何变化：

```bash title="Terminal"
bun run index.ts . "Find all TODO comments and tell me where they are"
```

使用单行语句，代理可能会首先列出其计划（“我将使用 grep 来搜索...”）。 通过结构化提示，它可以直接进行工具调用并报告结果。

```bash title="Terminal"
npx tsc --noEmit
```

**注意：不要期望每次都会发生戏剧性的转变**

如果您的代理已经按照单行提示进行操作（模块 2 的描述足够强大，通常如此），则可见的变化可能是微妙的。 持久的收益是策略：您已经明确了操作风格，这意味着您可以更改它而无需重写整个代理。

### 犯罪

```bash
git add index.ts
git commit -m "feat(prompt): add Agency and Guardrails sections"
```

### 完成时间

- [ ] `instructions` 包括 `# Agency` 和 `# Guardrails` 部分
- [ ] 代理告诉代理使用工具而不解释
- [ ] Guardrails 限制范围（最小的更改、重用、没有新的部门）
- [ ] 工作目录仍然插入到提示符中
- [ ] `npx tsc --noEmit` 通行证

**注意：测试提示的边缘**

尝试完全删除代理部分。 运行相同的任务。 代理是否会重新进入解释模式？ 尝试拆除护栏。 它会开始添加随机 npm 包吗？ 每个部门都在做工作。 弄清楚哪个部分捕获哪种行为就是整个游戏的关键。

### 解决方案

```ts title="index.ts"
const agent = new ToolLoopAgent({
  model: "anthropic/claude-haiku-4-5",
  instructions: `You are a coding agent working in: ${cwd}


- USE your tools. Read files, search code, run commands, then answer.
- Do NOT explain what you WOULD do. Actually do it.
- Prefer grep for searching, read for viewing files.
- Use bash only for commands that aren't covered by other tools.


- Prefer simple, minimal changes
- Search before creating, and reuse existing patterns
- No new dependencies without asking`,
  tools: { read, grep, bash },
  stopWhen: stepCountIs(10),
});
```

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 08. 动态提示构建
原文标题：Dynamic Prompt Construction
原文链接：https://vercel.com/academy/build-ai-agent-harness/dynamic-prompt-construction
导读：构建一个适应运行时上下文的提示编辑器，使提示策略更容易安全地发展。
上一课的分段提示是硬编码的。 当只有一个项目、一个沙箱和一套固定工具集时，这就很好了。 一旦其中任何一个移动，提示就必须随之移动。

不同的工作目录。 不同的沙箱后端。 仅获取 `read` 和 `grep` 的子代理。 硬编码字符串不能携带任何内容。 一个函数就可以。

### 结果

`src/system.ts` 中的 `buildSystemPrompt(context)` 函数从键入的 `PromptContext` 返回系统提示字符串。 代理的 `instructions` 现在是从运行时状态派生的，而不是粘贴进去的。

### 快速通道

1. 使用 `PromptContext` 接口和 `buildSystemPrompt(ctx)` 函数创建 `src/system.ts`
2. 从各个部分编写提示，包括 `gitBranch` 和 `projectContext` 等可选部分
3. 在 `index.ts` 中调用 `buildSystemPrompt(...)` 并将结果传递给 `instructions`

### 实践练习 3.2

将提示提取到类型化构建器中。

**要求：**

1. 使用 `workingDirectory`、`sandboxType`、`toolNames`、可选 `gitBranch`、可选 `projectContext` 定义 `PromptContext`
2. 写入返回分段提示的 `buildSystemPrompt(ctx: PromptContext): string`
3. 使 `gitBranch` 和 `projectContext` 有条件，仅在设置时包括它们的部分
4. 在 `index.ts` 中，构建上下文对象并为 `instructions` 字段调用 `buildSystemPrompt(ctx)`

**实施提示：**

- 将节推入数组并在末尾推入 `join("\n")` 。 纯字符串连接，无模板引擎
- 条件部分使用简单的 `if (ctx.foo) sections.push(...)`。 不要追求更奇特的模式
- 保持 `buildSystemPrompt` 纯净。 相同的上下文，相同的提示，没有副作用。 这使得它可以进行单元测试

#### 语境的形状

提示取决于运行时状态。 将该状态装入一个对象中：

```ts title="src/system.ts"
export interface PromptContext {
  workingDirectory: string;
  sandboxType: string;
  toolNames: string[];
  gitBranch?: string;
  projectContext?: string;
}
```

`workingDirectory` 和 `sandboxType` 始终适用。 `toolNames` 让提示列出实际连接的工具（当您为子代理提供子集时，这很重要）。 `gitBranch` 和 `projectContext` 是可选的，因为它们并不总是可知的。

#### 建设者

```ts title="src/system.ts"
export function buildSystemPrompt(ctx: PromptContext): string {
  const sections: string[] = [];

  sections.push(`You are a coding agent working in: ${ctx.workingDirectory}`);
  sections.push(`Sandbox: ${ctx.sandboxType}`);

  sections.push(`

- USE your tools. Read files, search code, run commands, then answer.
- Do NOT explain what you WOULD do. Actually do it.
- Available tools: ${ctx.toolNames.join(", ")}`);

  if (ctx.gitBranch) {
    sections.push(`- Current branch: ${ctx.gitBranch}`);
  }

  sections.push(`

- Prefer simple, minimal changes
- Search before creating, and reuse existing patterns
- No new dependencies without asking`);

  if (ctx.projectContext) {
    sections.push(`

${ctx.projectContext}`);
  }

  return sections.join("\n");
}
```

这里没有模板引擎。 没有DSL。 有一个数组、一些 `push` 调用和一个 `join`。 这是故意的。 提示符是一个字符串。 构建它应该看起来像构建一根绳子。

#### 将其连接起来

在 `index.ts` 中，将内联 `instructions` 文字替换为对构建器的调用：

```ts title="index.ts"
import { buildSystemPrompt } from "./src/system";

const instructions = buildSystemPrompt({
  workingDirectory: cwd,
  sandboxType: "local",
  toolNames: Object.keys({ read, grep, bash }),
});

const agent = new ToolLoopAgent({
  model: "anthropic/claude-haiku-4-5",
  instructions,
  tools: { read, grep, bash },
  stopWhen: stepCountIs(10),
});
```

代理在单个任务上的行为可能看起来与以前相同。 胜利是结构性的。 添加 git 上下文行、交换沙箱类型或剥离子代理的部分现在需要编辑一个焦点函数，而不是在多行字符串中查找和替换。

**注意：为什么是函数，而不是字符串**

提示是线束最重要的配置。 使其成为一个函数意味着它是可测试的（断言给定上下文的输出是什么样的）、可组合的（添加部分而不接触其他部分）、可替换的（用户可以提供自己的构建器）和确定性的（每次都相同的上下文、相同的提示）。 成本是一个文件。 第三次添加部分时会显示该好处。

### 尝试一下

运行您之前使用过的任何提示：

```bash title="Terminal"
bun run index.ts . "Find all TODO comments in this project"
```

输出应该和上一课一样，因为提示内容是一样的。 这种变化是内部的。 通过记录一次提示本身来确认代理仍然拥有它期望的工具：

```ts title="index.ts (temporary)"
console.log(instructions);
```

您应该看到完整的 Agency 和 Guardrails 部分，其中插入了工作目录和工具名称。

```bash title="Terminal"
npx tsc --noEmit
```

### 犯罪

```bash
git add src/system.ts index.ts
git commit -m "refactor(prompt): extract buildSystemPrompt with runtime context"
```

### 完成时间

- [ ] `src/system.ts` 导出 `PromptContext` 和 `buildSystemPrompt`
- [ ] `buildSystemPrompt` 在给定相同上下文时返回与上一课相同的提示内容
- [ ] `gitBranch` 和 `projectContext` 是可选的，仅在提供时包含
- [ ] `index.ts` 调用 `buildSystemPrompt(...)` 而不是使用内联字符串
- [ ] `npx tsc --noEmit` 通行证

**注意：为提示编写测试**

添加快速断言：使用 `gitBranch: "main"` 构建提示并确认输出包含“当前分支：主”。 在没有 `gitBranch` 的情况下构建它并确认该行不存在。 这是提示的最小可能单元测试，它捕获了通过读取模型输出几乎不可能发现的错误。

### 解决方案

```ts title="src/system.ts"
export interface PromptContext {
  workingDirectory: string;
  sandboxType: string;
  toolNames: string[];
  gitBranch?: string;
  projectContext?: string;
}

export function buildSystemPrompt(ctx: PromptContext): string {
  const sections: string[] = [];

  sections.push(`You are a coding agent working in: ${ctx.workingDirectory}`);
  sections.push(`Sandbox: ${ctx.sandboxType}`);

  sections.push(`

- USE your tools. Read files, search code, run commands, then answer.
- Do NOT explain what you WOULD do. Actually do it.
- Available tools: ${ctx.toolNames.join(", ")}`);

  if (ctx.gitBranch) {
    sections.push(`- Current branch: ${ctx.gitBranch}`);
  }

  sections.push(`

- Prefer simple, minimal changes
- Search before creating, and reuse existing patterns
- No new dependencies without asking`);

  if (ctx.projectContext) {
    sections.push(`

${ctx.projectContext}`);
  }

  return sections.join("\n");
}
```

```ts title="index.ts"
import { buildSystemPrompt } from "./src/system";

const tools = { read, grep, bash };

const agent = new ToolLoopAgent({
  model: "anthropic/claude-haiku-4-5",
  instructions: buildSystemPrompt({
    workingDirectory: cwd,
    sandboxType: "local",
    toolNames: Object.keys(tools),
  }),
  tools,
  stopWhen: stepCountIs(10),
});
```

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 09. 验证门
原文标题：Verification Gates
原文链接：https://vercel.com/academy/build-ai-agent-harness/verification-gates
导读：添加验证合同，以便代理诚实地声明并证明其实际检查的内容。
“我修复了错误”是代理无论是否修复错误都会非常自信地说的一句话。 它还会告诉您“所有测试都通过”，而无需运行测试。 这不是恶意。 模型是模式匹配器，他们看到的模式经常以“所有测试都通过”结束。

解决办法是让验证成为一种契约，而不是一种氛围。 我们将在系统提示中添加一个部分，告诉代理要运行什么、无法运行某些内容时要做什么，以及之后如何确定其声明的范围。

### 结果

`buildSystemPrompt` 包含一个验证部分，告诉代理在存在时运行真实检查（`tsc`、lint、测试、构建），并在不存在时诚实地确定其报告的范围。

### 快速通道

1. 将 `# Verification` 部分添加到 `buildSystemPrompt`
2. 告诉代理运行此项目中存在的检查，而不是假设它们
3. 告诉代理报告它运行的内容、被阻止的内容以及不可用的内容

### 实践练习 3.3

将“验证”部分添加到您的提示构建器中并清楚地编写合同。

**要求：**

1. 将 `# Verification` 部分推入 `buildSystemPrompt` 中的部分数组中
2. 该部分指示代理运行类型检查（当存在 TypeScript 时）、lint、测试、构建，但仅运行存在的那些
3. 包含明确的指示，不要在不运行检查的情况下声称成功
4. 需要范围报告：什么运行、什么被阻止、什么不可用

**实施提示：**

- “不跑不认”是一句承重的话。 没有它，模型就会填补空白
- 合同是关于诚实，而不是承保范围。 一个代理说“我运行了 tsc，测试被批准阻止”比一个未经检查就声称“所有测试都通过”的代理更有用
- 不要将特定于项目的命令烘焙到提示中。 第 3.4 课涵盖让项目告诉代理要运行什么

#### 合同

将此块添加到 `buildSystemPrompt`：

```ts title="src/system.ts"
sections.push(`

After making changes, verify your work:
1. Run \`npx tsc --noEmit\` when TypeScript is present
2. Run lint, test, or build commands only if they exist in this project and are allowed by the current approval mode
3. Report exactly what you ran, what was blocked, and what was unavailable
4. Do NOT inflate partial verification into a blanket success claim

Do NOT claim "tests pass" without running them.
Scope your claims honestly. "Verification was limited because writes were blocked" is honest.
"All tests pass" when you didn't run them is not.`);
```

合同明确指出了不良行为。 模特很擅长避免你提到的东西。 他们不擅长回避你暗示的事情。

#### 并列的范围内的权利要求

以下是合约试图生成的报告的形式：

| 代理人可能会说的话 | 你想要它说什么                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| “所有测试均通过”         | “运行 `npm test`：47 个通过，3 个失败（预先存在，与我的更改无关）”                            |
| “我修复了这个错误”        | “修复了 `auth.ts:42` 中的空检查。`npx tsc --noEmit` 通过。测试被批准模式阻止。” |
| “建设工程”        | “运行`npm run build`：4.2秒成功，没有警告。”                                                  |

右栏是具体的。 它说明了检查了什么、发现了什么以及限制在哪里。 左边一栏是提示不推回时模型的默认语音。

#### 这是做什么和不做什么

验证部分不会使检查通过。 它使代理人的检查报告变得诚实。 如果 `tsc` 失败，代理会报告失败。 如果测试从未运行过，因为它们不存在于该项目中，代理会这么说。 如果批准模式阻止了 lint 命令，代理也会这么说。

听起来很谦虚。 实际上，这就是信任代理的输出和自己重新运行每项检查之间的区别。

**注意：验证是关于范围，而不是覆盖范围**

你并不是要求代理人检查一切。 你要求它准确地告诉你它检查了什么。 一个诚实的小范围比听起来自信的全面扫描更有用。 这与模块 2 中的描述契约是相同的规则：大声说出限制，然后代理留在其中。

### 尝试一下

进行小的编辑（删除评论、重命名变量、任何可以恢复的内容）并要求代理进行验证：

```bash title="Terminal"
bun run index.ts . "Rename the cwd variable to workingDir, then verify your work"
```

代理人应该：

1. 使用 `edit` 或 `bash` 进行更改
2. 运行 `npx tsc --noEmit`
3. 具体报告 `tsc` 的结果，而不是一揽子“看起来不错”

如果您的批准模式阻止了测试命令，代理应该大声说出来，而不是假装测试已通过。

```bash title="Terminal"
npx tsc --noEmit
```

**警告：语言中存在虚构**

注意柔和的短语：“应该没问题”、“对我来说看起来不错”、“我希望这能起作用”。 这些都是讲述。 运行检查的模型使用过去时和特定结果。 不使用对冲将来时的模型。 阅读此类措辞是对代理输出进行评分的工作的一半。

### 犯罪

```bash
git add src/system.ts
git commit -m "feat(prompt): add Verification section to system prompt"
```

### 完成时间

- [ ] `buildSystemPrompt` 包含 `# Verification` 部分
- [ ] 该部分明确告诉代理不要在没有运行的情况下声明成功
- [ ] 该部分需要范围报告（已运行/已阻止/不可用）
- [ ] 在测试编辑中，代理具体报告 `tsc` 的结果
- [ ] `npx tsc --noEmit` 通行证

**注意：从 package.json** 中发现验证步骤

现在验证部分是硬编码的。 尝试读取 `package.json` 的 `scripts` 块并仅包含实际存在的步骤。 如果定义了 `scripts.typecheck`，请列出它。 如果缺少 `scripts.lint`，请不要告诉代理运行 lint。 这与下一课 (`AGENTS.md`) 的想法相同，只是更窄、更早。

### 解决方案

```ts title="src/system.ts (additions)"
export function buildSystemPrompt(ctx: PromptContext): string {
  const sections: string[] = [];

  // ... role, sandbox, Agency, Guardrails sections from previous lesson

  sections.push(`

After making changes, verify your work:
1. Run \`npx tsc --noEmit\` when TypeScript is present
2. Run lint, test, or build commands only if they exist in this project and are allowed by the current approval mode
3. Report exactly what you ran, what was blocked, and what was unavailable
4. Do NOT inflate partial verification into a blanket success claim

Do NOT claim "tests pass" without running them.
Scope your claims honestly. "Verification was limited because writes were blocked" is honest.
"All tests pass" when you didn't run them is not.`);

  // ... projectContext section

  return sections.join("\n");
}
```

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 10. 项目背景
原文标题：Project Context
原文链接：https://vercel.com/academy/build-ai-agent-harness/project-context
导读：从 AGENTS.md 加载项目指令，以便相同的工具可以获取特定于项目的命令和约束。
你的安全带是通用的。 它所涉及的每个项目都不是。

一个项目使用 `bun test`。 接下来使用 `vitest`。 第三个使用 `npm run check` 进行类型检查和 lint 组合，该组合与您在提示中融入的任何约定都不匹配。 代理不应该猜测，你也不应该一个一个项目地教它。

大多数生产线束使用的技巧与团队对其人类贡献者使用的技巧相同：在存储库中放置一个 markdown 文件来解释项目的工作原理。 代理会读取并进​​行调整。

### 结果

如果工作目录中存在 `AGENTS.md` 文件，则工具会读取该文件并将其内容作为“项目说明”部分注入到系统提示符中。 如果没有文件，提示将仅返回到基本说明。

### 快速通道

1. 检查工作目录中是否有 `AGENTS.md`
2. 如果存在，将其读入字符串
3. 将其作为 `projectContext` 传递给 `buildSystemPrompt`

### 动手练习 3.4

从工作目录中发现并注入 `AGENTS.md`。

**要求：**

1. 在`index.ts`中，检查`cwd/AGENTS.md`是否存在
2. 如果是，则将其读取为 UTF-8
3. 将内容（或 `undefined`）作为 `projectContext` 传递给 `buildSystemPrompt`
4. 确认提示构建器的现有 `projectContext` 处理在存在时添加该部分，在不存在时忽略它

**实施提示：**

- 来自 `node:fs` 的 `existsSync` 在这里没问题。 检查在启动时进行一次，而不是在热循环中进行
- 使用 `path.join(cwd, "AGENTS.md")` 而不是模板文字，以保持路径处理一致
- 暂时不要添加 monorepo 目录行走。 下面的挑战涵盖了这一点，模块 4 的沙箱抽象将改变文件发现的工作方式

#### 发现

整个功能就是几行：

```ts title="index.ts"
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const agentsPath = join(cwd, "AGENTS.md");
const projectContext = existsSync(agentsPath)
  ? readFileSync(agentsPath, "utf-8")
  : undefined;
```

将其传递给构建器：

```ts title="index.ts"
const instructions = buildSystemPrompt({
  workingDirectory: cwd,
  sandboxType: "local",
  toolNames: Object.keys(tools),
  projectContext,
});
```

这就是全部。 约定优于配置。 没有插件系统，没有注册，没有事件总线。 位于已知位置的文件。

#### AGENTS.md 中有什么内容

该文件用于特定于项目的事实，工具无法从代码本身推断出：

```markdown title="AGENTS.md"


### Commands
- `bun test` runs the test suite
- `bun run build` builds for production
- `bun run lint` checks code style

### Architecture
- Monorepo, packages live in `packages/`
- Each package has its own `tsconfig.json`
- Shared types in `packages/shared/`

### Style
- Functional components, no classes
- Named exports, not default
- Error messages must be user-facing

### Lessons learned
- Auth middleware must run before rate limiting
- Don't modify migration files directly, generate new ones
```

代理会读取此内容并进行调整。 它知道命令。 它了解架构。 它知道项目反复出现的错误。 现在，相同的工具的行为就像 React 项目中的 React 项目代理和 CLI 项目中的 CLI 项目代理，因为项目本身告诉代理它是什么类型的项目。

**注意：具有不同文件名的熟悉模式**

这与 Cursor 使用 `.cursorrules`、Codex 使用 `AGENTS.md`、Claude Code 使用 `CLAUDE.md` 以及 pi 使用自己的约定相同。 文件名各不相同。 图案没有。 找到一个 markdown 文件，按照说明注入。

#### 为什么现在一个文件就足够了

真正的工具会遍历父目录，在 monorepo 中查找 `AGENTS.md` 文件。 它合并了它们。 它还可能支持 `.cursorrules`、`.github/copilot-instructions.md` 或 `~/.agents/default.md`。

我们还没有建造任何东西。 工作目录中的一个文件涵盖了教学点：项目上下文来自文件，线束在启动时发现它，提示吸收它。 行走和合并叠加在其之上，而不改变形状。

### 尝试一下

将 `AGENTS.md` 放入工作目录中，其中包含代理无法从代码中推断出的一条特定指令：

```markdown title="AGENTS.md"

- All commits must use the format `feat(scope): message`
- The verification step is `bun test`, not `npm test`
```

运行代理：

```bash title="Terminal"
bun run index.ts . "What command do I use to run the tests in this project?"
```

代理应该回答 `bun test` 因为文件告诉了它。 删除 `AGENTS.md` 并运行相同的提示。 代理会猜测（可能是 `npm test`）。

```bash title="Terminal"
npx tsc --noEmit
```

### 犯罪

```bash
git add index.ts
git commit -m "feat(prompt): inject AGENTS.md as project context"
```

### 完成时间

- [ ] `index.ts` 检查工作目录中的 `AGENTS.md`
- [ ] 如果存在，其内容将作为 `projectContext` 传递到 `buildSystemPrompt`
- [ ] 在存在 `AGENTS.md` 的情况下，代理回答文件中特定于项目的问题
- [ ] 如果没有 `AGENTS.md`，线束仅使用基本指令即可正常运行
- [ ] `npx tsc --noEmit` 通行证

**注意：monorepos 的目录遍历**

真正的 monorepo 在根目录下有一个 `AGENTS.md` ，每个包内都有一个 `AGENTS.md` 。 从 `cwd` 开始，走到存储库根（查找 `.git`）并收集沿途的每个 `AGENTS.md`。 合并它们，最深的文件覆盖或扩展根。 现在考虑一下冲突：当根说 `use npm` 而包说 `use pnpm` 时会发生什么？ 不同的线束以不同的方式解决这个问题。 pi 合并找到的所有内容。 光标仅使用最深的。 Codex 连接 root 和 cwd。 尝试一种策略并注意它在哪里失败。

### 解决方案

```ts title="index.ts"
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSystemPrompt } from "./src/system";

const cwd = resolve(process.argv[2] || process.cwd());

const agentsPath = join(cwd, "AGENTS.md");
const projectContext = existsSync(agentsPath)
  ? readFileSync(agentsPath, "utf-8")
  : undefined;

const tools = { read, grep, bash };

const agent = new ToolLoopAgent({
  model: "anthropic/claude-haiku-4-5",
  instructions: buildSystemPrompt({
    workingDirectory: cwd,
    sandboxType: "local",
    toolNames: Object.keys(tools),
    projectContext,
  }),
  tools,
  stopWhen: stepCountIs(10),
});
```

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 11. 设计界面
原文标题：Designing the Interface
原文链接：https://vercel.com/academy/build-ai-agent-harness/designing-the-interface
导读：定义工具调用的沙箱接口，以便执行可以移动而无需重写工具逻辑。
你的工具很好用。 他们也知道太多了。

`read` 了解 `readFileSync`。 `bash` 了解 `execSync`。 两者都知道它们正在 Node 上运行。 当您希望它们在其他地方（沙箱、远程虚拟机、内存文件系统）运行时，每个工具都必须重写。

在构建任何后端之前，我们将写下接口。 从抽象的角度来看，沙箱需要做什么才能让任何工具调用它？ 一旦该合约存在，工具就会针对它进行重构，后端则位于后面。

### 结果

使用 `readFile`、`exec`、`stop` 以及身份字段定义的 `Sandbox` 接口。 所有三个工具（`read`、`grep`、`bash`）均调用接口而不是直接调用 Node API。

### 快速通道

1. 使用 `type`、`workingDirectory`、`readFile`、`exec`、`stop` 以及可选的 `expiresAt` 和 `snapshot` 定义 `Sandbox` 接口
2. 重构 `read` 以调用 `sandbox.readFile(path)` 而不是 `readFileSync`
3. 重构 `grep` 和 `bash` （或您的 `localOps.exec`）以通过 `sandbox.exec(command)` 进行路由

### 实践练习 4.1

编写接口并重构三个工具来使用它。

**要求：**

1. 使用 `type`、`workingDirectory`、`readFile`、`exec`、`stop` 以及可选的 `expiresAt` 和 `snapshot` 定义 `src/sandbox.ts` 中的 `Sandbox`
2. 每个方法都是 `async`，即使实现在幕后是同步的
3. 将 `Sandbox` 传递到工具工厂。 更新 `read`、`grep` 和 `bash` 以调用 `sandbox.readFile` 和 `sandbox.exec`
4. 构建尚未运行（您尚未编写实现）。 没关系。 我们将在下一课中这样做

**实施提示：**

- 所有方法都是 `async` 因为云后端需要它，并且跨实现的签名不一致会造成混乱
- 对不适用于每个后端的功能使用可选方法（`expiresAt?`、`snapshot?(): Promise<...>`）
- `type: string` 用于记录和调试。 还不让它成为一个联盟。 如果您愿意，它可以稍后变成 `"local" | "just-bash" | "cloud"`

#### 界面

```ts title="src/sandbox.ts"
export interface Sandbox {
  type: string;
  workingDirectory: string;
  readFile(path: string): Promise<string>;
  exec(command: string): Promise<{ stdout: string; exitCode: number }>;
  stop(): Promise<void>;
  expiresAt?: number;
  snapshot?(): Promise<{ snapshotId: string }>;
}
```

一些值得指出的选择：

- 每个方法都会返回一个 `Promise`。 本地后端包装同步调用。 云后端确实是异步的。 两者的相同签名使工具变得简单
- `type` 和 `workingDirectory` 是身份字段。 工具有时需要知道它们在哪里以及它们正在与什么对象通信
- `expiresAt` 和 `snapshot` 是可选的。 本地沙箱不会过期。 `just-bash` 沙箱不会创建快照。 该接口可以容纳两者，而无需强制存根

#### 每种方法的收益

| 方法             | 目的                      | 必需的？           |
| ------------------ | ---------------------------- | ------------------- |
| `readFile`         | 按路径读取文件          | 是的                 |
| `exec`             | 运行命令                | 是的                 |
| `stop`             | 优雅地关闭         | 是（无操作即可） |
| `type`             | 识别日志中的后端 | 是的                 |
| `workingDirectory` | 工具的基本路径          | 是的                 |
| `expiresAt`        | 超时时间戳            | 否（仅限云）     |
| `snapshot`         | 保存状态                   | 否（仅限云）     |

使界面尽可能小。 您现在添加的任何内容都将是每个实现都必须永远支持的内容。

#### 重构工具

`read` 的重构是一行：

```ts title="src/tools.ts"
// Before
execute: async ({ path: filePath }) => {
  const content = readFileSync(resolve(cwd, filePath), "utf-8");
  // ...
}

// After
execute: async ({ path: filePath }) => {
  const content = await sandbox.readFile(filePath);
  // ...
}
```

`grep` 和 `bash` 得到相同的处理，通过 `sandbox.exec(command)` 而不是 `execSync` 或我们在模块 2 中构建的 `localOps` 对象进行路由。工厂函数现在接受 `sandbox` 参数并关闭它。

该工具的输入架构、描述、线路上限和匹配上限均保持不变。 该模型仍然看到相同的合同。 引擎盖下的管道正在移动。

**注意：胜利在于可移植性，而不是行为**

重构后，代理在相同提示下的行为方式相同。 相同的工具，相同的结果。 这是对重构是结构性而非行为性的测试。 当您在第 4.3 课中添加第二个后端并且无需接触工具即可实现这一目标时，胜利就会显现出来。

### 尝试一下

您还没有编写实现，因此代码不会端到端运行。 您可以做的是检查类型是否对齐：

```bash title="Terminal"
npx tsc --noEmit
```

如果你持续重构，这一切都会过去。 工具内对 `readFileSync` 和 `execSync` 的所有引用都应该消失。 这些工具现在需要 `Sandbox` 参数。

### 犯罪

```bash
git add src/sandbox.ts src/tools.ts
git commit -m "refactor(tools): route through Sandbox interface"
```

### 完成时间

- [ ] `src/sandbox.ts` 导出 `Sandbox` 接口
- [ ] `read`、`grep` 和 `bash` 接受 `Sandbox` 并调用 `sandbox.readFile` 和 `sandbox.exec`
- [ ] 不再有工具直接导入 `readFileSync` 或 `execSync`
- [ ] `expiresAt` 和 `snapshot` 为可选类型
- [ ] `npx tsc --noEmit` 通行证

**注意：在不破坏世界的情况下再添加一种方法**

假设您也需要工具来写入文件。 将 `writeFile(path: string, content: string): Promise<void>` 添加到接口。 现在，每个实现都必须支持它，包括那些没有写入意义的实现（例如只读审查沙箱）。 什么是正确的举动？ 一种新的可选方法？ 用于可写沙箱的单独接口？ 无法执行此操作的实现引发的错误？ 每一种都有不同的成本。 选择一个并注意它对其他地方的影响。

### 解决方案

```ts title="src/sandbox.ts"
export interface Sandbox {
  type: string;
  workingDirectory: string;
  readFile(path: string): Promise<string>;
  exec(command: string): Promise<{ stdout: string; exitCode: number }>;
  stop(): Promise<void>;
  expiresAt?: number;
  snapshot?(): Promise<{ snapshotId: string }>;
}
```

```ts title="src/tools.ts (shape)"
import type { Sandbox } from "./sandbox";

export function createReadTool(sandbox: Sandbox) {
  return tool({
    description: `Read a file from the project. Returns numbered lines.
WHEN TO USE: viewing file contents, checking configs, reading source code.
WHEN NOT TO USE: searching across files (use grep instead).`,
    inputSchema: z.object({
      path: z.string(),
      offset: z.number().optional(),
      limit: z.number().optional(),
    }),
    execute: async ({ path: filePath, offset, limit }) => {
      const content = await sandbox.readFile(filePath);
      // ... same line numbering and truncation logic
    },
  });
}

export function createBashTool(
  sandbox: Sandbox,
  needsApproval: (input: { command: string }) => boolean,
) {
  return tool({
    // ... same description and schema
    execute: async ({ command }) => {
      if (needsApproval({ command })) {
        return `Blocked: "${command}" requires approval.`;
      }
      const { stdout } = await sandbox.exec(command);
      return stdout || "(no output)";
    },
  });
}
```

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 12. 本地实施
原文标题：Local Implementation
原文链接：https://vercel.com/academy/build-ai-agent-harness/local-implementation
导读：将 Node.js fs 和 child_process 包装在本地 Sandbox 实现中，以便该接口具有具体的基线后端。
上一课的界面本身不执行任何操作。 我们需要一个后端。

本地沙箱是最无聊的。 它包装了您一直使用的相同 `readFileSync` 和 `execSync` 调用。 不同之处在于它们现在隐藏在界面后面，每个工具都以相同的方式调用它们。

无聊才是重点。 本地沙箱证明该界面可以正常工作，而不会引入新的复杂性。 这是与其他所有后端进行比较的基线。

### 结果

`src/sandbox-local.ts` 导出 `createLocalSandbox(dir)`，一个返回 `Sandbox` 的工厂，其方法包装 Node 的 `readFileSync` 和 `execSync`。 代理的运行方式与以前相同，但通过界面进行。

### 快速通道

1. 创建 `src/sandbox-local.ts` 并导出 `createLocalSandbox(dir): Sandbox`
2. 将 `readFileSync` 包裹在 `async readFile` 中
3. 将 `execSync` 包装在 `async exec` 中，try/catch 返回 `{ stdout, exitCode }`
4. 使 `stop()` 成为异步无操作

### 实践练习 4.2

实施本地沙箱。

**要求：**

1. `createLocalSandbox(dir: string): Sandbox` 返回满足接口的对象
2. `readFile` 根据 `dir` 解析路径并读取 UTF-8
3. `exec` 使用 `cwd: dir` 和 30 秒超时运行命令
4. 出现 `exec` 错误时，返回 `{ stdout: <whatever output there was>, exitCode: <non-zero> }` 而不是抛出
5. `stop` 是 `async () => {}`

**实施提示：**

- 整个文件大约有 15 行。 如果你的更长，你可能正在处理云后端会关心而本地后端不关心的情况
- `exec` 永远不应该抛出异常，即使在非零退出时也是如此。 工具需要一个结果对象。 捕获错误并返回它是正确的形状
- `type: "local"` 是 `sandboxType` 插入到模块 3 的系统提示符中的内容

#### 实施情况

```ts title="src/sandbox-local.ts"
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import type { Sandbox } from "./sandbox";

export function createLocalSandbox(dir: string): Sandbox {
  return {
    type: "local",
    workingDirectory: dir,
    readFile: async (p) => readFileSync(resolve(dir, p), "utf-8"),
    exec: async (command) => {
      try {
        const stdout = execSync(command, {
          cwd: dir,
          encoding: "utf-8",
          timeout: 30_000,
        });
        return { stdout, exitCode: 0 };
      } catch (e: any) {
        return {
          stdout: e.stdout || e.stderr || e.message || "",
          exitCode: e.status ?? 1,
        };
      }
    },
    stop: async () => {},
  };
}
```

这就是整个后端。 `stop` 是一个空操作，因为没有什么需要清理的。 本地文件系统和 `child_process` 将比代理更长寿。

#### 连接起来

```ts title="index.ts"
import { createLocalSandbox } from "./src/sandbox-local";
import { createReadTool, createGrepTool, createBashTool } from "./src/tools";

const sandbox = createLocalSandbox(cwd);
console.error(`Sandbox: ${sandbox.type}`);

const tools = {
  read: createReadTool(sandbox),
  grep: createGrepTool(sandbox),
  bash: createBashTool(sandbox, createApproval({ mode: "interactive" })),
};
```

工厂现在采用沙箱。 他们关闭它并从 `execute` 内部调用它的方法。 相同的工具，相同的代理，相同的提示。

### 尝试一下

运行您一直在使用的提示。 输出应该保持不变：

```bash title="Terminal"
bun run index.ts . "Read the tsconfig.json"
bun run index.ts . "Find all TODO comments"
bun run index.ts . "List all files in this directory"
```

代理的行为方式应该完全相同。 引擎盖下的管道是不同的。 确认沙箱身份一次：

```ts title="index.ts (temporary)"
console.error(`Sandbox: ${sandbox.type}`);
```

您应该看到 `Sandbox: local`。

```bash title="Terminal"
npx tsc --noEmit
```

**注意：如果行为改变，重构就会泄露**

完成本课程后，客服人员在相同提示下的行为应与模块 3 完全匹配。 如果发生变化（不同的路由、不同的输出、新的错误），请查找工具仍然直接访问 Node API 而不是通过 `sandbox` 的地方。

### 犯罪

```bash
git add src/sandbox-local.ts index.ts
git commit -m "feat(sandbox): add local backend wrapping Node APIs"
```

### 完成时间

- [ ] `src/sandbox-local.ts` 导出 `createLocalSandbox(dir)`
- [ ] 返回的对象满足 `Sandbox` 接口
- [ ] `readFile` 和 `exec` 像以前一样通过 Node API 进行路由
- [ ] `stop` 是一个不会崩溃的无操作
- [ ] 所有三个工具仍然有效，与模块 3 相同
- [ ] `npx tsc --noEmit` 通行证

**注意：制作exec流而不是buffer**

`execSync` 等待命令完成，然后立即转储所有标准输出。 对于长期构建来说，这是痛苦的。 尝试交换到 `spawn` 并将每个块流回来。 挑战：`Sandbox.exec` 签名返回一个最终的 `{ stdout, exitCode }`。 要进行流式传输，您需要不同的形状，也许是异步迭代器。 请注意这如何影响到每个调用 `exec` 的工具。 界面决策是粘性的。

### 解决方案

```ts title="src/sandbox-local.ts"
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import type { Sandbox } from "./sandbox";

export function createLocalSandbox(dir: string): Sandbox {
  return {
    type: "local",
    workingDirectory: dir,
    readFile: async (p) => readFileSync(resolve(dir, p), "utf-8"),
    exec: async (command) => {
      try {
        const stdout = execSync(command, {
          cwd: dir,
          encoding: "utf-8",
          timeout: 30_000,
        });
        return { stdout, exitCode: 0 };
      } catch (e: any) {
        return {
          stdout: e.stdout || e.stderr || e.message || "",
          exitCode: e.status ?? 1,
        };
      }
    },
    stop: async () => {},
  };
}
```

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 13. 内存中实现
原文标题：In-Memory Implementation
原文链接：https://vercel.com/academy/build-ai-agent-harness/in-memory-implementation
导读：添加 just-bash 后端，以便相同的 Sandbox 接口可以针对内存中的写时复制文件系统运行。
本地沙箱对真实文件运行真实命令。 这很好，直到您想让代理探索代码而不相信它不会破坏任何东西。

`just-bash` 就是答案。 它是一个具有写时复制语义的虚拟文件系统：代理从真实磁盘读取，但它写入的任何内容都存在于内存中，并在沙箱停止时消失。 快速、便宜、安全。 非常适合探索、测试以及任何您不想让代理泄露您的实际文件的时候。

### 结果

`createJustBashSandbox(dir)` 返回由 `just-bash` 支持的 `Sandbox`。 该工具可以使用环境变量在本地后端和内存后端之间切换，并且代理针对任一后端运行相同的提示。

### 快速通道

1. 使用 `bun add just-bash` 安装 `just-bash`
2. 在 `src/sandbox-just-bash.ts` 中实现 `createJustBashSandbox(dir)`
3. 将 `readFile` 和 `exec` 映射到 `just-bash` API，注意虚拟挂载点
4. 根据 `process.env.SANDBOX` 选择启动时的后端

### 实践练习 4.3

添加 `just-bash` 后端并连接 env-var 开关。

**要求：**

1. `createJustBashSandbox(dir: string): Promise<Sandbox>` （注意 `Promise`，因为创建是异步的）
2. 使用 `JustBashSandbox.create({ overlayRoot: dir })` 启动虚拟 FS
3. 在 `readFile` 和 `exec` 内部，通过虚拟挂载点 `/home/user/project` 转换路径
4. 在`index.ts`中，根据`process.env.SANDBOX`选择`local`或`just-bash`

**实施提示：**

- `JustBashSandbox.create` 返回一个承诺。 你的工厂也必须是异步的
- 挂载点就是陷阱。 `overlayRoot: "/Users/you/project"` 不会安装在 `/` 处，而是安装在 `/home/user/project` 处。 沙箱内的每个路径都必须以该常量作为前缀
- `runCommand` 返回命令句柄，而不是结果。 调用 `wait()` 获取退出代码，调用 `output()` 获取组合的 stdout/stderr

#### just-bash API

快速浏览一下您要包装的部件：

```ts
import { Sandbox as JustBashSandbox } from "just-bash";

const jb = await JustBashSandbox.create({ overlayRoot: "/path/to/project" });

const content = await jb.readFile("/home/user/project/package.json");

const cmd = await jb.runCommand("ls", { cwd: "/home/user/project" });
const finished = await cmd.wait();
console.log(await cmd.output());
console.log(finished.exitCode);
```

**警告：安装点陷阱**

当您传递 `overlayRoot: "/path/to/project"` 时，`just-bash` 会将该目录挂载到虚拟文件系统内的 `/home/user/project` 处。 不在 `/`。 不在原来的路。 每个 `readFile` 和 `runCommand` 调用都必须使用虚拟安装点。 这会让你绊倒。 它让每个人都绊倒。

#### 实施情况

```ts title="src/sandbox-just-bash.ts"
import { Sandbox as JustBashSandbox } from "just-bash";
import type { Sandbox } from "./sandbox";

const MOUNT = "/home/user/project";

export async function createJustBashSandbox(dir: string): Promise<Sandbox> {
  const jb = await JustBashSandbox.create({ overlayRoot: dir });

  return {
    type: "just-bash",
    workingDirectory: dir,
    readFile: async (p) => {
      const virtualPath = `${MOUNT}/${p}`;
      return jb.readFile(virtualPath);
    },
    exec: async (command) => {
      const cmd = await jb.runCommand(command, { cwd: MOUNT });
      const finished = await cmd.wait();
      return {
        stdout: await cmd.output(),
        exitCode: finished.exitCode,
      };
    },
    stop: async () => {},
  };
}
```

`MOUNT` 常量是 just-bash 后端唯一关心而本地后端不关心的事情。 每条进出的路径都通过它进行翻译。

#### 连接 env-var 开关

```ts title="index.ts"
import { createLocalSandbox } from "./src/sandbox-local";
import { createJustBashSandbox } from "./src/sandbox-just-bash";

const sandboxType = process.env.SANDBOX || "local";
const sandbox =
  sandboxType === "just-bash"
    ? await createJustBashSandbox(cwd)
    : createLocalSandbox(cwd);

console.error(`Sandbox: ${sandbox.type}`);
```

`local` 的工厂是同步的，`just-bash` 的工厂是异步的。 条件为我们处理这个问题。 下游的一切（工具、代理、提示生成器）都是相同的。

#### 写时复制，一句话

读取来自真实磁盘。 写入到内存中。 真正的文件系统永远不会被修改。 当沙箱停止时，虚拟文件​​系统将被垃圾收集。 代理可以读取您的 `package.json`，然后创建和删除 `test.txt` 一百次，并且您在磁盘上的项目不会受到影响。

### 尝试一下

相同的提示，两个后端：

```bash title="Terminal"
bun run index.ts . "Read the package.json"
```

```bash title="Terminal"
SANDBOX=just-bash bun run index.ts . "Read the package.json"
```

您应该两次得到相同的答案，并在各自的运行中打印 `Sandbox: local` 和 `Sandbox: just-bash` 。 这就是界面的工作原理。

在内存后端尝试写入型任务：

```bash title="Terminal"
SANDBOX=just-bash bun run index.ts . "Create a file called scratch.txt with the text 'hello'"
```

代理写入文件。 现在检查真实磁盘：`scratch.txt` 不存在。 写入发生在内存中的覆盖层中。

```bash title="Terminal"
npx tsc --noEmit
```

**注意：并非每个工具都可以在第一次尝试时移植**

有些工具在两个后端上的工作方式相同。 有些人会悄悄地失败，因为他们对主机做了一些假设。 `grep` 是一个常见的错误，因为 `just-bash` 下的 shell 行为是模拟的，并不总是与系统的 `grep` 字节相同。 可移植性测试是真实的，而不是理论上的。 计划在这次交换后修复一两个工具。

### 犯罪

```bash
git add src/sandbox-just-bash.ts index.ts package.json
git commit -m "feat(sandbox): add just-bash backend with in-memory FS"
```

### 完成时间

- [ ] `just-bash` 已安装
- [ ] `src/sandbox-just-bash.ts` 导出 `createJustBashSandbox(dir)` 返回 `Promise<Sandbox>`
- [ ] 路径通过 `MOUNT` 常量
- [ ] `SANDBOX=just-bash bun run ...` 针对内存后端运行代理
- [ ] `just-bash` 上的写入任务不会触及真实的文件系统
- [ ] `npx tsc --noEmit` 通行证

**注意：找到泄漏工具**

选择一个适用于 `local` 后端但在 `just-bash` 下失败或表现不同的提示。 追踪哪个工具正在做出特定于主机的假设。 然后决定：修复该工具，还是让界面吸收差异（例如，让 `just-bash` 为该命令提供垫片）？ 两者都是真正的设计选择。 请注意哪一个使工具更简单。

### 解决方案

```ts title="src/sandbox-just-bash.ts"
import { Sandbox as JustBashSandbox } from "just-bash";
import type { Sandbox } from "./sandbox";

const MOUNT = "/home/user/project";

export async function createJustBashSandbox(dir: string): Promise<Sandbox> {
  const jb = await JustBashSandbox.create({ overlayRoot: dir });

  return {
    type: "just-bash",
    workingDirectory: dir,
    readFile: async (p) => {
      const virtualPath = `${MOUNT}/${p}`;
      return jb.readFile(virtualPath);
    },
    exec: async (command) => {
      const cmd = await jb.runCommand(command, { cwd: MOUNT });
      const finished = await cmd.wait();
      return {
        stdout: await cmd.output(),
        exitCode: finished.exitCode,
      };
    },
    stop: async () => {},
  };
}
```

```ts title="index.ts"
const sandboxType = process.env.SANDBOX || "local";
const sandbox =
  sandboxType === "just-bash"
    ? await createJustBashSandbox(cwd)
    : createLocalSandbox(cwd);
```

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 14. 云实施
原文标题：Cloud Implementation
原文链接：https://vercel.com/academy/build-ai-agent-harness/cloud-implementation
导读：云沙箱是什么样子的，包括远程虚拟机、真实文件系统、延迟和成本。
本地后端免费且快速。 `just-bash` 后端是免费且安全的。 云后端两者都不是。

云沙箱是在其他地方运行的真实虚拟机。 它有一个真实的文件系统、真实的 `git`、真实的 `npm` 和真实的网络。 它还每分钟收费，增加每次调用的延迟，并且无论您是否完成，都会在三十分钟后到期。

本课是概念和分析，而不是构建。 围绕云沙箱的工具（配置、快照、计费）是特定于提供商的，并且变化速度比课程跟得上。 保持稳定的是形状：界面相同，权衡不同，工具并不关心。

### 结果

您可以阅读并推理云沙箱实现，并且可以描述为什么 `expiresAt` 和 `snapshot` 作为可选字段存在于界面上。

### 云沙箱是什么样的

```ts title="src/sandbox-cloud.ts (illustrative)"
import type { Sandbox } from "./sandbox";

export async function createCloudSandbox(config: {
  template?: string;
  snapshotId?: string;
}): Promise<Sandbox> {
  const vm = await VercelSandbox.create(config);

  return {
    type: "cloud",
    workingDirectory: "/workspace",
    expiresAt: Date.now() + 30 * 60 * 1000,

    readFile: async (p) => {
      return vm.files.read(resolve("/workspace", p));
    },

    exec: async (command) => {
      const result = await vm.commands.run(command, { cwd: "/workspace" });
      return {
        stdout: result.stdout + result.stderr,
        exitCode: result.exitCode,
      };
    },

    stop: async () => {
      await vm.close();
    },

    snapshot: async () => {
      const snap = await vm.snapshot();
      return { snapshotId: snap.id };
    },
  };
}
```

与 `local` 和 `just-bash` 形状相同。 这些方法只是碰巧进行网络调用。 从工具的角度来看，这是不可见的。 从挂钟的角度来看，这是唯一重要的事情。

### 权衡

|              | 当地的              | 刚刚猛击                            | 云                                     |
| ------------ | ------------------ | ------------------------------------ | ----------------------------------------- |
| 成本         | 自由的               | 自由的                                 | 每分钟                                |
| 延迟      | 微秒       | 微秒                         | 每次调用数十到数百毫秒 |
| 隔离    | 没有任何               | 部分（读实数，写虚拟） | 完整、独立的虚拟机                         |
| 坚持  | 永恒的          | 停车时收集的垃圾            | 快照或恢复                       |
| `git`、`npm` | 您的本地安装 | 模拟                            | 真实、单独安装                |
| 暂停      | 没有任何               | 没有任何                                 | 硬限制（通常为 30 至 60 分钟）       |

该界面可容纳所有三个，因为形状保持不变。 可选字段（`expiresAt`、`snapshot`）获得 `?`，因为它们不适用于更简单的后端。

### 何时选择每个

| 后端     | 最适合                                              |
| ----------- | ----------------------------------------------------- |
| `local`     | 本地开发、调试、可信环境    |
| `just-bash` | 探索、测试、不受信任的代码审查           |
| `cloud`     | 生产、CI、多用户、完全沙盒执行 |

真正的安全带可以让用户在启动时进行选择。 代理人不知道也不关心。

**注意：为什么云后端在这里只是概念**

我们不会针对实时提供商构建 `createCloudSandbox` ，因为供应端的 API、网络详细信息、快照语义，所有这些都因供应商而异，并且经常发生变化。 仍然存在的教学要点是界面是相同的。 如果您想将其与 [Vercel Sandbox](https://vercel.com/docs/functions/sandbox) 连接起来，这些方法会直接转换。

### `expiresAt` 和 `snapshot` 能为您带来什么

`expiresAt` 让线束知道时钟正在运行。 长时间运行的任务可以检查 `expiresAt` 并决定是否开始新操作或结束。 如果没有它，代理就会运行直到出现网络错误，然后必须弄清楚发生了什么。

`snapshot` 让线束在运行中保存状态。 云沙盒三十分钟后就会消亡。 如果您在第 28 分钟拍摄快照，则可以从新沙箱中的快照重新启动，并从上次中断的位置继续。 模块 7 对此进行了深入介绍。

两者都是可选的。 本地沙箱不应该假装拥有它们。 `just-bash` 沙箱没有有意义的方式来公开它们。 该界面允许每个后端选择它实际可以提供的功能。

### 尝试一下

本课程中没有可运行的代码，但有一个概念检查：

1. 不回头看表，写下云后端`readFile`比本地后端`readFile`慢的两个原因
2. 用一句话解释一下为什么接口上`expiresAt`是可选的
3. 画出 `createCloudSandbox` 与您之前使用过的提供者 API 的对比情况。 `exec` 需要做什么而 `local.exec` 不需要？

你的答案的形状告诉你抽象是否已经被点击。

### 犯罪

本课程中没有代码更改，因此没有提交。 如果您将云实施草拟为思考练习，请将其保存在临时文件中。

### 完成时间

- [ ] 您可以解释为什么云沙箱中的 `readFile` 会增加延迟
- [ ] 你可以解释一下为什么接口上存在`expiresAt`
- [ ] 您可以描述何时选择 `cloud` 而不是 `local` 或 `just-bash`
- [ ] 如果需要，您可以针对真实的提供商 API 实施 `createCloudSandbox`

**注意：绘制成本感知线束**

云沙盒每分钟都要花钱。 在线束中设计一个护栏，当运行成本超过阈值时，它会向您发出警告。 代理本身看不到成本，但包裹它的线束可以看到。 支票在循环中去哪里？ 当任务中超过阈值时会发生什么？ 您是否会停下来、拍快照或询问用户？ 每个答案都指向不同的运营模式。

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 15. 生命周期挂钩
原文标题：Lifecycle Hooks
原文链接：https://vercel.com/academy/build-ai-agent-harness/lifecycle-hooks
导读：沙箱需要设置和拆卸。 添加 afterStart、beforeStop 和 onTimeout 挂钩点。
创建沙箱只是工作的一半。 另一半是围绕它发生的一切。

新的云虚拟机没有您的 git 配置。 它没有节点\_模块。 它没有您的 `.env`。 在代理执行任何有用的操作之前，必须配置 git、安装依赖项、复制环境文件。 在沙箱关闭之前，必须检查是否有未提交的工作并决定如何处理它。

这些东西是生命周期挂钩。 本地沙箱几乎不需要它们。 如果没有它们，云沙箱将无法使用。

### 结果

`index.ts` 中的沙箱设置调用 `afterStart` 和 `beforeStop` 挂钩，类型定义在 `src/sandbox.ts` 中。 本地沙箱以空钩子运行。 模块 7 中的云和生命周期工作管道已就位。

### 快速通道

1. 将 `SandboxLifecycle` 接口添加到 `src/sandbox.ts` ，并带有可选的 `afterStart`、`beforeStop`、`onTimeout`
2. 在`index.ts`中创建沙箱后，调用`await lifecycle.afterStart?.(sandbox)`
3. 在 `sandbox.stop()` 之前，调用 `await lifecycle.beforeStop?.(sandbox)`
4. 将本地生命周期保留为空。 钩点存在，主体不必存在

### 实践练习 4.5

在沙箱周围连接可选的生命周期挂钩。

**要求：**

1. 使用三个可选方法定义 `SandboxLifecycle`，每个方法采用 `Sandbox` 并返回 `Promise<void>`
2. 在 `index.ts` 中，在沙箱创建旁边传递一个 `lifecycle` 对象
3. 创建沙箱后立即调用 `await lifecycle.afterStart?.(sandbox)`
4. 在 `sandbox.stop()` 之前调用 `await lifecycle.beforeStop?.(sandbox)`
5. 默认为空 `lifecycle = {}` 因此本地沙箱运行不变

**实施提示：**

- 可选链接 (`?.()`) 为您执行条件调用。 不需要 `if (lifecycle.afterStart)` 块
- 即使一个空的生命周期仍然是一个生命周期。 不要在外部级别将其设为可选
- `onTimeout` 是安全带调用的一个钩子，而不是您。 当到达 `expiresAt` 时，云后端会触发它。 现在存根，在模块 7 中使用它

#### 界面

```ts title="src/sandbox.ts (additions)"
export interface SandboxLifecycle {
  afterStart?(sandbox: Sandbox): Promise<void>;
  beforeStop?(sandbox: Sandbox): Promise<void>;
  onTimeout?(sandbox: Sandbox): Promise<void>;
}
```

这三个都是可选的。 本地沙箱可能永远不需要它们中的任何一个。 生产线束中的云沙箱可能会使用所有这三个。

#### 每个钩子的用途

`afterStart` 在创建沙箱并准备好接受命令后运行。 这是设置发生的地方：

```ts title="src/lifecycle.ts (illustrative cloud lifecycle)"
const cloudLifecycle: SandboxLifecycle = {
  afterStart: async (sandbox) => {
    await sandbox.exec('git config user.name "Agent"');
    await sandbox.exec('git config user.email "agent@example.com"');
    await sandbox.exec("npm install");
    await sandbox.exec("cp .env.example .env");
  },
};
```

`beforeStop` 在沙箱关闭之前运行，因此任何重要的东西都有机会逃脱：

```ts
beforeStop: async (sandbox) => {
  const { stdout } = await sandbox.exec("git status --porcelain");
  if (stdout.trim()) {
    await sandbox.exec('git add -A && git commit -m "WIP: auto-save"');
  }
  if (sandbox.snapshot) {
    await sandbox.snapshot();
  }
},
```

`onTimeout` 当沙箱达到其时间限制时运行。 云后端调用此函数，而不是您。 主体通常重用 `beforeStop` 加上一些日志记录：

```ts
onTimeout: async (sandbox) => {
  console.error("Sandbox timed out, saving state");
  await cloudLifecycle.beforeStop?.(sandbox);
},
```

#### 将其连接到代理循环中

```ts title="index.ts"
const sandbox = await createSandboxByEnv(cwd);
const lifecycle: SandboxLifecycle = {};

await lifecycle.afterStart?.(sandbox);

try {
  const { text, steps } = await agent.generate({ prompt });
  console.log(text);
  console.log(`\n(${steps.length} steps)`);
} finally {
  await lifecycle.beforeStop?.(sandbox);
  await sandbox.stop();
}
```

`try/finally` 很重要。 即使代理在运行中抛出，`beforeStop` 也应该触发。 这就是未提交工作检查所属的地方。

对于具有空 `lifecycle = {}` 的本地沙箱，不会运行任何钩子。 代理的行为与以前完全相同。 当我们在模块 7 中添加真正的钩子时，该结构就在那里。

**注意：Hooks 在云上获得生存，而不是在本地**

对于本地后端，生命周期钩子主要是仪式。 对于云后端，跳过 `beforeStop` 意味着当虚拟机终止时会丢失未提交的工作。 事实上，界面迫使你同时考虑这两个问题，这才是重点。 本地案例是云案例的更简单的形状，而不是不同的形状。

### 尝试一下

由于本地生命周期为空，代理的行为应与上一课完全相同。

```bash title="Terminal"
bun run index.ts . "Read the package.json"
```

通过添加临时日志来确认管道工作类型：

```ts title="index.ts (temporary)"
const lifecycle: SandboxLifecycle = {
  afterStart: async (sb) => console.error(`[lifecycle] after start: ${sb.type}`),
  beforeStop: async (sb) => console.error(`[lifecycle] before stop: ${sb.type}`),
};
```

运行任何提示。 您应该看到包含代理工作的两条日志行。

```bash title="Terminal"
npx tsc --noEmit
```

### 犯罪

```bash
git add src/sandbox.ts index.ts
git commit -m "feat(sandbox): add lifecycle hook points"
```

### 完成时间

- [ ] `SandboxLifecycle` 接口定义了三个可选方法
- [ ] `afterStart` 在沙箱创建后调用一次
- [ ] `beforeStop` 在 `finally` 内的 `sandbox.stop()` 之前调用一次
- [ ] 如果 `lifecycle` 为空，代理运行不变
- [ ] 使用日志记录钩子，生命周期按顺序调用 fire
- [ ] `npx tsc --noEmit` 通行证

**注意：快照和恢复作为生命周期对**

生命周期挂钩不仅仅用于设置和拆卸。 尝试此配对：`afterStart` 检查已知位置中是否已保存快照，如果找到则从中恢复。 `beforeStop` 关闭前自动快照。 现在，您的线束具有崩溃恢复行为，调用站点无需额外代码。 快照位于哪里？ 如何区分真正的新运行和恢复运行？ 当快照来自不同的代码版本时会发生什么？ 模块 7 深入介绍了这一点，但形状来自您刚刚定义的生命周期接口。

### 解决方案

```ts title="src/sandbox.ts (additions)"
export interface SandboxLifecycle {
  afterStart?(sandbox: Sandbox): Promise<void>;
  beforeStop?(sandbox: Sandbox): Promise<void>;
  onTimeout?(sandbox: Sandbox): Promise<void>;
}
```

```ts title="index.ts"
import type { SandboxLifecycle } from "./src/sandbox";

const sandbox = await createSandboxByEnv(cwd);
const lifecycle: SandboxLifecycle = {};

await lifecycle.afterStart?.(sandbox);

try {
  const { text, steps } = await agent.generate({ prompt });
  console.log(text);
  console.log(`\n(${steps.length} steps)`);
} finally {
  await lifecycle.beforeStop?.(sandbox);
  await sandbox.stop();
}
```

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 16. 问题
原文标题：The Problem
原文链接：https://vercel.com/academy/build-ai-agent-harness/the-problem
导读：添加令牌日志记录并观察上下文随着每次工具调用而线性增长。
你的经纪人有事逃脱惩罚。

通过模块 1 到模块 4，您已经运行了一些短任务。 读取文件，查找 TODO，列出目录。 五步，最多十步。 上下文窗口保持舒适，代理保持敏锐，一切都很好。

这是我们回头看看实际任务中发生的情况的部分。 二十步。 三十。 在这种任务中，代理读取三个文件，搜索代码库两次，运行测试，修复问题，再次运行测试，然后编写摘要。

在解决问题之前，我们需要先看看它。 修复效果很小。 看见是困难的部分。

### 结果

`onStepFinish` 记录每一步的输入和输出标记。 运行多步骤任务使上下文增长可见：输入标记线性攀升，而输出大致持平。

### 快速通道

1. 将 `onStepFinish` 回调添加到 `ToolLoopAgent`
2. 每步记录 `usage.inputTokens` 和 `usage.outputTokens`
3. 运行多步骤任务并观察输入数字的攀升

### 实践练习 5.1

连线令牌日志记录并运行一个任务，该任务做了足够的工作来显示曲线。

**要求：**

1. 将 `onStepFinish: ({ usage, stepNumber }) => { ... }` 传递给 `ToolLoopAgent`
2. 记录到 `console.error` （因此它显示在代理的正常输出旁边，但不在标准输出中）
3. 运行强制调用 4 个以上工具的提示，以便曲线可见
4. 读出数字。 暂时不要尝试修复任何东西

**实施提示：**

- `onStepFinish` 在每一步之后运行，而不仅仅是成功的步骤。 `usage` 字段是相关字段
- 使用 `console.error` 进行遥测。 `console.log` 与代理的响应混合并变得丑陋
- 提示需要做实际工作。 “读取 package.json”是第一步。 “读取package.json，然后tsconfig，然后入口点，然后总结”是四

#### 添加日志记录

```ts title="index.ts"
const agent = new ToolLoopAgent({
  // ... existing config
  onStepFinish: ({ usage, stepNumber }) => {
    console.error(
      `Step ${stepNumber}: ${usage.inputTokens} input, ${usage.outputTokens} output`,
    );
  },
});
```

这就是所有的仪器。 SDK 在每一步之后都会为您调用此函数。

#### 执行一项令人痛苦的任务

```bash title="Terminal"
bun run index.ts . "Read package.json, then tsconfig.json, then index.ts, then summarize everything"
```

您应该看到类似以下内容：

```
Step 0: 1,200 input, 450 output
Step 1: 2,800 input, 200 output
Step 2: 4,100 input, 180 output
Step 3: 8,900 input, 350 output
Step 4: 9,200 input, 600 output
```

确切的数字在您的项目中会有所不同。 形状就不会了 输入令牌每一步都会上升。 输出代币大致持平。

#### 为什么输入代币会增长

每一步都会将整个消息历史记录发送到模型。 用户提示。 系统提示。 代理进行的每个工具调用。 代理收到的每个工具结果。

步骤 1 中的 package.json 仍然在步骤 4 的上下文中，即使代理已完成使用它。 步骤 2 中的 tsconfig 仍然存在。 没有什么会自行离开。

| 成分           | 代币          | 行为                 |
| ------------------- | --------------- | ------------------------ |
| 系统提示       | \~500           | 已修复，已发送每个呼叫   |
| 每个工具结果    | 200 至 2,000    | 永远留在历史中 |
| 20 次工具调用后 | 4,000 至 40,000 | 线性累加    |

上下文窗口有 200,000 个令牌。 读取大文件的繁忙代理只需 30 到 50 步即可完成。 当它发生时：

- 顶部的说明被忽视了
- 模型开始忽略自己的系统提示
- 工具选择退化
- 特工循环或产生幻觉

#### 什么不起作用

三个诱人的非修复：

- **希望它不会发生。**它总是发生在实际任务中
- **减少步数。** 对于实际工作来说，十步太少了。 五十很正常
- **使用更大的模型。** 更大的上下文窗口会延迟问题，并不能解决问题。 每个代币的成本更高

解决方法是在旧工具结果溢出注意力之前将其从消息历史记录中删除。 第 5.2 课正是这样做的。

**注意：首先遥测，其次修复**

这个教训并不能解决任何问题。 这是故意的。 除非您首先测量问题，否则您无法判断修复是否有效。 令牌日志记录保留在模块的其余部分中，以便您可以在每个步骤之前和之后进行比较。

### 尝试一下

运行多步骤任务。 看看数字。 确认：

1. 输入令牌随着每一步而增长
2. 输出代币保持相对较小
3. 到最后一步，您发送的令牌是步骤 0 的三倍多

```bash title="Terminal"
bun run index.ts . "Read package.json, then tsconfig.json, then index.ts, then summarize everything"
```

尝试更长的任务并观察曲线变得更陡：

```bash title="Terminal"
bun run index.ts . "Read every .ts file in src/, then tell me what each one does"
```

```bash title="Terminal"
npx tsc --noEmit
```

### 犯罪

```bash
git add index.ts
git commit -m "feat(telemetry): log token usage per step"
```

### 完成时间

- [ ] `onStepFinish` 连接到日志 `usage.inputTokens` 和 `usage.outputTokens`
- [ ] 4+ 步骤任务显示输入标记不断攀升
- [ ] 输出标记在各个步骤中保持相对平坦
- [ ] 日志记录转到 `console.error`，而不是 `console.log`
- [ ] `npx tsc --noEmit` 通行证

**注意：绘制曲线**

将数字记录到 stderr 就可以了。 将它们记录到 CSV 中会更好。 将 `step,inputTokens,outputTokens` 附加到 `onStepFinish` 中的文件，然后将其加载到您选择的电子表格中。 曲线的形状告诉您您的任务是读取密集型（陡峭攀爬）还是计算密集型（平缓攀爬）。 相同的代理，不同的曲线，取决于它在做什么。

### 解决方案

```ts title="index.ts"
const agent = new ToolLoopAgent({
  model: "anthropic/claude-haiku-4-5",
  instructions: buildSystemPrompt({
    workingDirectory: cwd,
    sandboxType: sandbox.type,
    toolNames: Object.keys(tools),
    projectContext,
  }),
  tools,
  stopWhen: stepCountIs(15),
  onStepFinish: ({ usage, stepNumber }) => {
    console.error(
      `Step ${stepNumber}: ${usage.inputTokens} input, ${usage.outputTokens} output`,
    );
  },
});
```

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 17. 修剪旧结果
原文标题：Pruning Old Results
原文链接：https://vercel.com/academy/build-ai-agent-harness/pruning-old-results
导读：使用 pruneMessages 删除旧的工具调用/结果对，同时保留最近的上下文。
修复是四行。

这就是让人感觉虎头蛇尾的部分。 您在上一课中测量了问题，观察了输入标记的攀升，在第 30 步勾画出了灾难场景。 现在我们添加四条线，曲线就变平了。

线条本身很简单。 他们去哪里以及为什么去，这就是教训。

### 结果

`prepareCall` 在每次模型调用之前运行 `pruneMessages`，删除早于最后三个消息的工具调用/结果对。 上一课的代币增长曲线趋于稳定，而不是永远攀升。

### 快速通道

1. 从 `ai` 导入 `pruneMessages`
2. 将 `prepareCall` 添加到您的 `ToolLoopAgent` 配置中
3. 在其中调用 `pruneMessages({ messages, toolCalls: "before-last-3-messages" })`
4. 首先传播 `...options`，并防止 `messages` 在第一次调用时未定义

### 实践练习 5.2

将修剪连接到代理中并重新运行第 5.1 课中的相同多步骤任务。

**要求：**

1. 将 `prepareCall: async (options) => ({...})` 添加到代理配置中
2. 传播 `...options` 以便 `model` 和 `tools` 等必填字段通过
3. 定义时有条件地修剪 `options.messages`
4. 现在使用`toolCalls: "before-last-3-messages"`（最简单合理的策略）
5. 确认输入令牌跨台阶而不是攀爬

**实施提示：**

- `prepareCall` 在每次模型调用之前运行，并带有完整请求 `options`。 您正在修改消息
- 首先传播 `...options`，否则您将失去 `model`、`tools` 和 `system`。 修剪后的消息覆盖传播
- 在第一次调用时，还没有消息（`prompt` 已设置，`messages` 是 `undefined`）。 在这种情况下跳过修剪

#### 修复

```ts title="index.ts" {1,6-13}
import { ToolLoopAgent, stepCountIs, tool, pruneMessages } from "ai";

const agent = new ToolLoopAgent({
  // ... existing config
  prepareCall: async (options) => ({
    ...options,
    messages: options.messages
      ? pruneMessages({
          messages: options.messages,
          toolCalls: "before-last-3-messages",
        })
      : undefined,
  }),
});
```

四条线路，一条进口。 大部分代码是第一次调用情况的守卫。

#### 实际发生了什么

在每次模型调用之前，都会运行 `prepareCall` 。 它接收 SDK 将要发送的完整请求。 我们将其 `messages` 替换为修剪后的版本，删除早于最后三个消息的每个工具调用和结果。

```
Before pruning at step 15:
  [user prompt]
  [assistant + tool_call] -> [tool_result]    (old, will be pruned)
  [assistant + tool_call] -> [tool_result]    (old, will be pruned)
  ... 12 more pairs ...
  [assistant + tool_call] -> [tool_result]    (recent, kept)
  [assistant + tool_call] -> [tool_result]    (recent, kept)
  [assistant] -> [user]                       (recent, kept)

After pruning:
  [user prompt]                               (kept, original prompt)
  [assistant + tool_call] -> [tool_result]    (recent)
  [assistant + tool_call] -> [tool_result]    (recent)
  [assistant] -> [user]                       (recent)
```

原始用户提示始终保留。 最近的工具交互仍然存在。 在对话的中间，工具结果堆积起来，每次通话都会被丢弃。

**警告：两个值得大声说出来的陷阱**

**首先传播 `...options`。** `prepareCall` 接收完整的请求选项，包括 `model`、`tools` 和 `system`。 忘记传播会默默地丢弃它们，并且代理会以令人困惑的方式中断。

**保护 `messages`。** 在第一次调用时，SDK 会为您提供 `prompt` 字段，但没有 `messages` 数组。 调用 `pruneMessages({ messages: undefined })` 会抛出异常。 三元可以处理它。

#### 为什么三则消息

`toolCalls: "before-last-3-messages"` 设置保留最后三个对话消息，而不仅仅是最后三个工具对。 这足以让模型知道它在多步骤任务中的位置，而无需保留整个历史记录。

你可以调整这个。 `before-last-1` 更具攻击性，可以节省更多代币。 `before-last-5` 更温和并保留更多上下文。 三是一个合理的默认值，可以很好地适应不同的任务形状。 从那里开始。 如果您有需要它的特定任务，请稍后进行调整。

### 尝试一下

运行第 5.1 课中相同的多步骤任务并比较令牌曲线：

```bash title="Terminal"
bun run index.ts . "Read package.json, tsconfig, index.ts, then summarize"
```

您应该看到类似以下内容：

```
Step 0: 1,200 input, 450 output
Step 1: 2,800 input, 200 output
Step 2: 3,100 input, 180 output    (old results pruned)
Step 3: 3,400 input, 350 output    (growth plateaus)
Step 4: 3,200 input, 600 output    (stays flat)
```

确切的数字取决于您的项目。 形状才是最重要的。 通过第 2 步或第 3 步输入代币达到稳定状态，而不是永远攀爬。

```bash title="Terminal"
npx tsc --noEmit
```

**注意：证明是形状，而不是数字**

不要期望与示例中的数字相同。 令牌计数取决于文件大小、模型选择和提示的确切措辞。 要验证的是曲线形状：之前是线性的，之后是稳定的。

### 犯罪

```bash
git add index.ts
git commit -m "feat(context): prune old tool results in prepareCall"
```

### 完成时间

- [ ] `pruneMessages` 是从 `ai` 导入的
- [ ] `prepareCall` 连接到代理配置中
- [ ] `...options` 在消息覆盖之前首先传播
- [ ] 处理未定义消息的情况
- [ ] 在 4+ 步骤任务中，输入标记趋于稳定而不是线性增长
- [ ] `npx tsc --noEmit` 通行证

**注意：找到任务的修剪阈值**

默认的 `before-last-3-messages` 是一个猜测。 选择一个需要代理记住之前几个步骤读取的内容（配置值、函数名称、找到的 TODO）的任务。 使用 `before-last-1`、`before-last-3` 和 `before-last-5` 运行并查看代理何时丢失线程。 安全带的正确数量取决于它的工作类型。

### 解决方案

```ts title="index.ts"
import { ToolLoopAgent, stepCountIs, tool, pruneMessages } from "ai";

const agent = new ToolLoopAgent({
  model: "anthropic/claude-haiku-4-5",
  instructions: buildSystemPrompt({ /* ... */ }),
  tools,
  stopWhen: stepCountIs(15),
  onStepFinish: ({ usage, stepNumber }) => {
    console.error(
      `Step ${stepNumber}: ${usage.inputTokens} input, ${usage.outputTokens} output`,
    );
  },
  prepareCall: async (options) => ({
    ...options,
    messages: options.messages
      ? pruneMessages({
          messages: options.messages,
          toolCalls: "before-last-3-messages",
        })
      : undefined,
  }),
});
```

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 18. 工具输出设计
原文标题：Tool Output Design
原文链接：https://vercel.com/academy/build-ai-agent-harness/tool-output-design
导读：预防胜于清理。 设计工具从一开始就产生有限的输出。
修剪会使旧结果断章取义。 那是必要的。 这还不够。

如果单个工具的结果是 5,000 个标记，则修剪下一个工具并不能拯救您。 损害已经造成了。 该模型已经看到了 5,000 个 grep 输出标记，现在必须将它们保留至少三轮。

更好的修复是在上游。 默认情况下，工具应该产生小型、结构化、有界的输出。 修剪是清理人员。 工具设计就是预防。

### 结果

您的工具中的每个工具都有明确的输出上限（行、匹配、字符），并且截断行为会传达回模型，以便在需要更多时可以分页。

### 快速通道

1. `read` 上限为 500 行，带有偏移/限制分页
2. `grep` 上限为 50 场比赛，返回总计数
3. 将 `bash` 限制在输出的 5,000 个字符处，保留尾部
4. 每个上限都会显示模型可以看到并采取行动的截断消息

### 实践练习 5.3

将有界输出契约应用于所有三个工具。

**要求：**

1. `read` 保留模块 1 中的 500 行上限，并使用 `offset` 和 `limit` 参数进行分页
2. `grep` 保留模块 1 中的 50 场比赛上限，截断时带有“(N 总计，显示前 50)”后缀
3. `bash` 在标准输出上添加了 5,000 个字符的上限。 保留尾部（最后 5,000 个字符），而不是头部，因为错误通常出现在末尾
4. 每次截断都会附加一条明确的消息，例如 `"... (truncated, showing last 5000 chars)"`

**实施提示：**

- 截断消息是模型存在更多数据的唯一信号。 它需要可见
- 对于 `bash`，切尾通常是正确的。 构建输出、测试失败和堆栈跟踪往往位于最后。 如果您的工具在重要的地方运行命令，请选择不同的方式
- “有限”并不意味着“微小”。 500 行、50 个匹配、5,000 个字符。 足以回答问题，足够小以保持上下文

#### 上限表

| 工具   | 帽         | 为什么这个数字                                                                              |
| ------ | ----------- | -------------------------------------------------------------------------------------------- |
| `read` | 500行   | 足以读取大多数文件。 大到足以掌握结构，小到足以不埋没模型 |
| `grep` | 50场比赛  | 返回 50 个结果的搜索回答了这个问题。 五百将是一个数据转储       |
| `bash` | 5,000 个字符 | 大多数命令输出都适合。 `npm install` 和朋友产生模型不需要的噪音     |

这些数字并不神圣。 他们通过运行实际任务并注意哪些问题来进行调整。 如果您的线束始终运行具有重要输出的较长输出的命令，请提高上限。 如果您主要进行快速搜索，请降低它。

#### Bash 输出，带上限

bash 工具到目前为止还没有输出上限。 添加一项：

```ts title="src/tools.ts (excerpt)"
const MAX_BASH_CHARS = 5000;

const stdout = result.stdout || "(no output)";
const cappedStdout =
  stdout.length > MAX_BASH_CHARS
    ? stdout.slice(-MAX_BASH_CHARS) +
      `\n... (truncated, showing last ${MAX_BASH_CHARS} chars)`
    : stdout;

return cappedStdout;
```

从末端开始切片是有意的。 代理运行的大多数命令最终都会失败。 失败的测试最后打印失败信息。 失败的构建最后会打印错误。 保留尾部保留了代理需要采取行动的部分。

#### 结构性回报，而非原始转储

grep 工具已在模块 1 中执行此操作，但值得重申该模式：

```ts title="src/tools.ts (grep, excerpt)"
const lines = stdout.trim().split("\n").filter(Boolean);
const MAX_MATCHES = 50;
const truncated = lines.length > MAX_MATCHES;
const result = truncated ? lines.slice(0, MAX_MATCHES) : lines;

return truncated
  ? result.join("\n") + `\n... (${lines.length} total, showing first ${MAX_MATCHES})`
  : result.join("\n") || "No matches found.";
```

截断消息为模型提供了两条可以采取行动的信息：结果比显示的多，以及到底有多少。 这样，代理可以决定缩小搜索范围或分页。

#### 截断合同

每个可以产生无限输出的工具都应该遵循相同的形状：

1. 将输出限制在合理的限度内
2. 告诉模型输出被截断以及截断了多少
3. 在工具支持的情况下提供分页参数（`read` 上的偏移/限制，`grep` 上较窄的 `glob` 模式）

合同让代理人做出反应。 默默截断的工具比根本不截断更糟糕，因为模型认为它拥有完整的图片并对不完整的数据起作用。

**注意：上限是代理在分页中支付的税**

有限的输出会使某些任务变慢一些。 要读取 2,000 行文件，代理现在需要四次 `read` 调用，而不是一次。 这是正确的权衡。 与污染会话其余部分上下文的一次大量读取相比，四次有界读取在令牌和成本方面更便宜。

### 尝试一下

运行您知道会返回大量匹配项的搜索：

```bash title="Terminal"
bun run index.ts . "Find all import statements in this project"
```

您应该看到 grep 返回 50 个匹配项，并在尾部显示总匹配项计数。 如果您要求代理继续前进，它应该缩小搜索范围或使用更具体的全局变量，而不是要求无限制的转储。

尝试一个产生大量输出的命令：

```bash title="Terminal"
bun run index.ts . "Run: ls -laR"
```

如果递归列表超过 5,000 个字符，您应该会看到截断消息。 代理应通过缩小列表范围或请求特定子目录来做出反应。

```bash title="Terminal"
npx tsc --noEmit
```

### 犯罪

```bash
git add src/tools.ts
git commit -m "feat(tools): cap bash output at 5000 chars with tail-keep"
```

### 完成时间

- [ ] `read` 上限为 500 行，带有偏移/限制分页
- [ ] `grep` 上限为 50 个匹配，截断时带有 `(N total)` 后缀
- [ ] `bash` 将标准输出限制为 5,000 个字符，保留尾部
- [ ] 每个上限都会显示模型可以看到的清晰截断消息
- [ ] 没有工具可以将无限数据转储到上下文中
- [ ] `npx tsc --noEmit` 通行证

**注意：使上限可配置**

硬编码上限是一个起点。 进行快速检查的子代理可能需要 100 行，而不是 500 行。深入分析可能需要 2,000 行。 重构您的工具工厂以接受 `caps` 配置对象。 现在，呼叫者可以根据座席进行调整。 注意权衡：可配置的上限意味着更多的旋钮可供用户设置错误。 正确的默认值在哪里？

### 解决方案

```ts title="src/tools.ts (bash excerpt)"
export function createBashTool(
  sandbox: Sandbox,
  needsApproval: (input: { command: string }) => boolean,
) {
  const MAX_BASH_CHARS = 5000;

  return tool({
    description: `Execute a shell command in the working directory.
WHEN TO USE: build commands, package install, tests, git, directory listings.
WHEN NOT TO USE: reading file contents (use read).
DO NOT USE FOR: reading files (use read), searching code (use grep).`,
    inputSchema: z.object({
      command: z.string().describe("Shell command to execute"),
    }),
    execute: async ({ command }) => {
      if (needsApproval({ command })) {
        return `Blocked: "${command}" requires approval.`;
      }
      const result = await sandbox.exec(command);
      const stdout = result.stdout || "(no output)";
      return stdout.length > MAX_BASH_CHARS
        ? stdout.slice(-MAX_BASH_CHARS) +
            `\n... (truncated, showing last ${MAX_BASH_CHARS} chars)`
        : stdout;
    },
  });
}
```

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 19. 缓存控制
原文标题：Cache Control
原文链接：https://vercel.com/academy/build-ai-agent-harness/cache-control
导读：当您的堆栈支持时，使用提供者感知的缓存控制可以减少重复输入成本。
修剪可以解决一半的问题。 另一半是每次调用仍然发送上下文中未更改的部分。

您的系统提示在呼叫 10 时与在呼叫 1 时相同。 早期的用户提示是一样的。 工具定义是相同的。 提供商之前已经见过这些令牌，并且您需要付费才能再次发送它们。

缓存控制是提供者表达“我记住了这个，不要再处理它”的方式。 只要得到支持，成本就会真正下降。 如果不是这样，该模式仍然教导一个有用的习惯：将稳定的上下文与新鲜的上下文分开。

### 结果

一个 `prepareCall` 管道，用于修剪旧工具结果，然后将剩余上下文的稳定部分标记为可缓存。 在支持缓存控制的提供商上，重复输入成本大幅下降。

### 快速通道

1. 添加一个 `addCacheControl(messages)` 帮助器，将稳定消息标记为可缓存
2. 在 `prepareCall` 中的 `pruneMessages` 之后编写
3. 将系统消息和早期对话标记为可缓存； 保持最新消息新鲜

### 实践练习 5.4

修剪步骤后面的线缓存控制。

**要求：**

1. 编写 `addCacheControl(messages)` 返回一个新的消息数组，并在适当的情况下设置 `providerOptions.cacheControl`
2. 第一条消息（系统或初始用户提示）应始终可缓存
3. 早于最后两条消息的消息应该是可缓存的
4. 最近的一两条消息不应被缓存
5. 更新 `prepareCall` 以调用 `addCacheControl(pruneMessages(...))`

**实施提示：**

- `cacheControl: { type: "ephemeral" }` 是人类风格的形状。 其他提供商使用不同的密钥。 如果您遇到不支持缓存控制的调用，该调用仍然有效，只是标头会被忽略
- 缓存断点按前缀工作。 将消息 5 标记为可缓存会缓存消息 5 之前的所有内容（包括消息 5）。提供程序在下一次调用时检查前缀
- 不要将最近的消息标记为可缓存。 他们即将被取代

#### 帮手

```ts title="src/cache.ts"
import type { ModelMessage } from "ai";

export function addCacheControl(messages: ModelMessage[]): ModelMessage[] {
  return messages.map((msg, i) => {
    if (i === 0) {
      return {
        ...msg,
        providerOptions: { cacheControl: { type: "ephemeral" } },
      };
    }
    if (i < messages.length - 2) {
      return {
        ...msg,
        providerOptions: { cacheControl: { type: "ephemeral" } },
      };
    }
    return msg;
  });
}
```

第一条消息和除最后两条消息外的所有消息都获得缓存标记。 最近的内容会保留下来，这样它们就不会在下一次调用替换它们之前被缓存。

#### 与修剪组合

在 `index.ts` 中，`prepareCall` 成为管道：

```ts title="index.ts"
import { addCacheControl } from "./src/cache";

prepareCall: async (options) => {
  const pruned = options.messages
    ? pruneMessages({
        messages: options.messages,
        toolCalls: "before-last-3-messages",
      })
    : undefined;

  return {
    ...options,
    messages: pruned ? addCacheControl(pruned) : undefined,
  };
},
```

修剪首先发生，因为它改变了消息的数量。 无论消息存活下来，缓存都是其次发生的。

#### 节省的费用是什么样的

这些数字取决于提供商、缓存命中率以及上下文的稳定程度。 对于运行长时间会话的典型 Anthropic 支持的代理：

| 成分                 | 没有缓存的成本    | 缓存成本      |
| ------------------------- | --------------------- | -------------------- |
| 50 次调用，每次 200K 输入 | 每次通话都输入完整信息 | 稳定的前缀缓存 |
| 全价 1000 万个代币  | \~每节课 30 美元     | \~每节课 6 美元     |

这是长时间训练中的一个数量级的波动。 在短会话中，差异较小，因为缓存没有时间进行摊销。 该纪律仍然适用。

**注意：缓存控制是特定于提供者的**

Anthropic 在消息部分使用 `cacheControl` 。 OpenAI 使用不同的标头和不同的模型。 有些提供程序根本不在提示级别公开缓存。 这种模式（稳定的和新鲜的分开）在这些差异中得以保留。 确切的 `providerOptions` 形状则不然。

#### 为什么即使在不支持缓存的情况下该模式也很重要

你强迫自己思考提示的哪些部分是稳定的。 这是一个有用的习惯。 它告诉您系统提示是否在每次调用时执行过多工作（每次重新构建）或恰到好处（构建一次，重复使用）。

如果明天缓存就消失了，识别稳定上下文的规则仍然值得保留。 与每次调用都会改变的上下文相比，稳定的上下文也更容易测试、更容易版本化、更容易推理。

### 尝试一下

运行多步骤任务并观察令牌计数：

```bash title="Terminal"
bun run index.ts . "Read package.json, tsconfig, index.ts, then summarize"
```

如果您的提供商在使用对象中返回缓存命中信息，请记录它：

```ts title="index.ts (temporary)"
onStepFinish: ({ usage, stepNumber }) => {
  console.error(
    `Step ${stepNumber}: ${usage.inputTokens} input, ${usage.outputTokens} output, ${usage.cachedInputTokens ?? 0} cached`,
  );
},
```

您应该看到 `cachedInputTokens` 从第 1 步开始不断增长，而 `inputTokens` （您支付全价的部分）保持较小。

```bash title="Terminal"
npx tsc --noEmit
```

### 犯罪

```bash
git add src/cache.ts index.ts
git commit -m "feat(context): add cache control to stable messages"
```

### 完成时间

- [ ] `addCacheControl(messages)` 标记稳定消息可缓存
- [ ] `prepareCall` 按顺序运行修剪然后缓存
- [ ] 最近的消息保持未缓存状态
- [ ] 在支持缓存的提供程序上，`cachedInputTokens` 显示在使用中
- [ ] `npx tsc --noEmit` 通行证

**注意：构建代币预算仪表板**

您已经从第 5.1 课中获得了遥测，从 5.2 中获得了修剪，从 5.3 中获得了上限，并从本课程中获得了缓存。 将它们连接在一起。 每个步骤之后，记录：输入令牌（未缓存）、缓存令牌、输出令牌和运行成本。 在会话结束时，打印总成本以及在不进行修剪和缓存的情况下会话的成本。 数字使该学科值得去做。

### 解决方案

```ts title="src/cache.ts"
import type { ModelMessage } from "ai";

export function addCacheControl(messages: ModelMessage[]): ModelMessage[] {
  return messages.map((msg, i) => {
    if (i === 0) {
      return {
        ...msg,
        providerOptions: { cacheControl: { type: "ephemeral" } },
      };
    }
    if (i < messages.length - 2) {
      return {
        ...msg,
        providerOptions: { cacheControl: { type: "ephemeral" } },
      };
    }
    return msg;
  });
}
```

```ts title="index.ts (prepareCall)"
prepareCall: async (options) => {
  const pruned = options.messages
    ? pruneMessages({
        messages: options.messages,
        toolCalls: "before-last-3-messages",
      })
    : undefined;

  return {
    ...options,
    messages: pruned ? addCacheControl(pruned) : undefined,
  };
},
```

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 20. 为什么要委托
原文标题：Why Delegate
原文链接：https://vercel.com/academy/build-ai-agent-harness/why-delegate
导读：单代理失败模式（环境污染、失去焦点、过于广泛的能力）以及委托成功的情况。
您刚刚花费了整个模块的时间来进行上下文管理。 修剪、上限、缓存。 代理的表现比以前好多了。 问题还没有完全解决。

在五十步任务中，代理会以修剪无法捕获的方式失败。 并不是因为上下文太长，而是因为这项工作本身不适合一个代理完成。 探索、计划、执行和验证都是相互渗透的。 正在探索的代理成为正在进行更改的代理，探索中的所有上下文仍然保留。

授权将这些分开。 家长决定做什么。 子代理去做吧。 每个都独立运行。 父母得到的是答案，而不是旅程。

### 结果

您可以描述委派修复的三种单代理故障模式，并且您可以判断任务何时适合委派，何时最好在父级中完成。

### 失效模式

这些都是修剪无法捕捉到的故障。

#### 上下文污染

代理读取二十个文件来理解代码库。 现在有二十个文件内容在上下文中。 当代理开始进行更改时，与更改相关的文件被隐藏在 15 个文件下，这些文件在 5 个步骤前有用，但现在没用了。

修剪最终会消除它们，但前提是它们将实际任务从人们的注意力中推开。

#### 失去焦点

到了第 30 步，特工已经漂移了。 系统提示“重构auth模块”。 在此过程中，代理注意到了 CSS 拼写错误，修复了它，然后注意到了次优导入，重构了它，最后编写了一条注释来解释它认为有趣的函数。 原来的任务都忘记了。

当一名代理人有太多顾虑和太多绳索时就会发生这种情况。

#### 能力过于广泛

代理拥有 `write` 和 `bash`。 在探索过程中，它“帮助”修复了它在正在读取的文件中注意到的拼写错误。 该修复破坏了其他东西。 不应该允许探索修改任何东西，但是拥有完整工具集的单个代理不知道如何为自己划定界限。

### 模式

委派将代理分为具有不同工具和不同模型的角色。

```
Parent
  Plans the work
  Delegates research to an Explorer
  Delegates implementation to an Executor
  Synthesizes results
  Makes architectural decisions

Explorer subagent
  Read and grep only (cannot modify anything)
  Cheap, fast model (Haiku)
  Reports findings, does not act

Executor subagent
  Full tools, including write and bash
  Stronger model (Sonnet or Opus)
  Follows precise instructions from the parent
  Cannot ask user questions (no askUser)
```

家长是唯一提出问题、做出决定或制定长期计划的代理人。 其他一切都被委托并确定范围。

### 何时委派

| 代表                   | 保留在父级中                     |
| -------------------------- | -------------------------------------- |
| 研究多个文件 | 单个文件的更改                    |
| 并行独立任务 | 顺序相关变化           |
| 机械散装作业       | 架构决策                |
| 行动前的探索  | 不明确的要求（使用 `askUser`） |

分歧在于作品是否具有干净的交接形状。 读取三十个文件并返回一段摘要是一种干净的交接。 决定采用三种架构方法中的哪一种并不重要，因为决定就是工作。

**注意：委派不是免费的**

子代理调用是一个新模型，使用自己的启动令牌、自己的系统提示符和自己的延迟运行。 不要将一切都委托给别人。 将工作委派给家长，因为看不到完整的跟踪记录。 如果家长可以通过三个步骤完成任务，那么授权就不会物有所值。

### 尝试一下

这是概念课。 没有可运行的代码。 检查一下自己：

1. 不回头，说出三种单代理故障模式
2. 从上周选择一个你自己的编码任务。 其中哪些部分适合探险家工作？ 哪些是好的执行工作？ 哪些必须留在规划者那里？
3. 如果您将整个任务交给一位拥有所有工具、五十个步骤且没有授权的代理，会发生什么？

### 犯罪

本课中没有代码。 下一课将构建资源管理器。

### 完成时间

- [ ] 您可以命名三种单代理故障模式
- [ ] 您可以描述授权何时有帮助、何时无帮助
- [ ] 您可以勾勒出实际任务的哪些部分将在父任务、探索者和执行者之间分配

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 21. 资源管理器子代理
原文标题：Explorer Subagent
原文链接：https://vercel.com/academy/build-ai-agent-harness/explorer-subagent
导读：具有廉价模型的只读子代理。 非常适合研究和探索。
资源管理器是构建最简单的子代理，也是最有用的开始。

它可以读取文件。 它可以搜索。 它无能为力。 没有 `write`，没有 `bash`，不询问用户。 它调查一个问题，总结发现的内容，然后消失。

这听起来像是一个限制。 这就是特点。 浏览器不能随波逐流，不能进行意外更改，也不能用创意 `find -exec` 毁掉您的项目。 它做了一件事，当它完成时，父级会返回一个干净的答案，而不是四十步的中间文件读取。

### 结果

面向家长的 `task` 工具会生成一个新的 `ToolLoopAgent`，仅包含 `read` 和 `grep`、一个廉价的模型和一个 5 步预算。 家长可以委托研究并获取文本摘要。

### 快速通道

1. 定义一个 `task` 工具，其架构接受子代理的 `description`
2. 在 `execute` 内部，仅使用 `read` 和 `grep` 实例化一个新的 `ToolLoopAgent`
3. 使用 `claude-haiku-4-5` 和 `stopWhen: stepCountIs(5)`
4. 将子代理的文本响应返回给父代理，包装在 try/catch 中

### 实践练习 6.2

将来自父代理的委托接缝添加到资源管理器子代理中。

**要求：**

1. 将 `task` 工具添加到您的工具注册表中
2. 该架构采用 `description: string` ，父级使用该 `description: string` 告诉子代理要调查什么
3. 在 `execute` 内部，使用 `read` 和 `grep` 创建一个新的 `ToolLoopAgent` （没有 `bash`，没有 `askUser`）
4. 选择一个快速模型 (`claude-haiku-4-5`) 并将步骤上限设置为 5
5. 返回浏览器的文本响应，捕获错误并以字符串形式返回

**实施提示：**

- 每次调用都会实例化资源管理器。 不要重复使用一个。 每个代表团都会获得一个新的上下文窗口
- 重用您已有的 `read` 和 `grep` 工具。 它们关闭在父级使用的沙箱上，这就是您想要的
- 将 `explorer.generate(...)` 包装在 try/catch 中并返回 `"Subagent error: ${e.message}"` 而不是让异常传播。 父级期望从任何工具返回字符串

#### 任务工具

```ts title="src/tools.ts (additions)"
import { ToolLoopAgent, stepCountIs, tool } from "ai";
import { z } from "zod";
import type { Sandbox } from "./sandbox";

export function createTaskTool(sandbox: Sandbox, parentTools: {
  read: ReturnType<typeof createReadTool>;
  grep: ReturnType<typeof createGrepTool>;
}) {
  return tool({
    description: `Delegate research to a read-only subagent.
WHEN TO USE: investigating a codebase, finding patterns, gathering context
  across many files.
WHEN NOT TO USE: making changes (the subagent cannot write or run commands).
DO NOT USE FOR: tasks that need decisions or askUser interactions.`,
    inputSchema: z.object({
      description: z.string().describe("What the subagent should investigate"),
    }),
    execute: async ({ description }) => {
      const explorer = new ToolLoopAgent({
        model: "anthropic/claude-haiku-4-5",
        instructions: `You are an explorer agent. Investigate and report back concisely.
Working directory: ${sandbox.workingDirectory}`,
        tools: { read: parentTools.read, grep: parentTools.grep },
        stopWhen: stepCountIs(5),
      });

      try {
        const { text, steps } = await explorer.generate({ prompt: description });
        return text
          ? `[Explorer: ${steps.length} steps]\n${text}`
          : "(no response from subagent)";
      } catch (e: any) {
        return `Subagent error: ${e.message}`;
      }
    },
  });
}
```

一些值得指出的设计选择：

- **每次呼叫都有新代理。** 浏览器无法在呼叫之间生存。 每个任务都有自己的上下文窗口，这就是委派的全部意义
- **没有 `bash`，没有 `askUser`。** 浏览器可以读取和搜索。 它无法修改项目或暂停以等待用户输入。 父母仍然负责决定
- **俳句，不是十四行诗。**探索是阅读和总结，而不是深度推理。 更快、更便宜的型号才是正确的选择
- **五个步骤。** 足以查看少量文件并报告。 如果探索者需要更多，家长应该将任务分成更小的部分
- **错误以字符串形式返回。**工具将字符串返回到模型。 未捕获的异常会破坏工具循环。 返回错误文本让家长决定要做什么

#### 将其连接到父级

```ts title="index.ts"
const tools = {
  read: createReadTool(sandbox),
  grep: createGrepTool(sandbox),
  bash: createBashTool(sandbox, createApproval({ mode: "interactive" })),
};

const tools_with_task = {
  ...tools,
  task: createTaskTool(sandbox, { read: tools.read, grep: tools.grep }),
};

const agent = new ToolLoopAgent({
  // ...
  tools: tools_with_task,
});
```

父级现在有四个工具：`read`、`grep`、`bash` 和 `task`。 前三个是直接的。 第四届代表。

**警告：在调试时添加日志**

当子代理不返回任何内容或返回错误的内容时，您不知道其运行中发生了什么。 开发时，从任务工具内部记录子代理的步数和文本长度。 如果没有这一点，您将盯着混乱的父级输出，不知道子代理是否运行了一步或五步，发现了什么，或者悄悄失败了。

### 尝试一下

向家长询问探索者最适合的用途：

```bash title="Terminal"
bun run index.ts . "Delegate to a subagent: find every place this project uses zod and tell me which files import from it."
```

父级应使用该描述调用 `task` 。 资源管理器应该运行、查找导入并返回摘要。 家长应该将该摘要传回给您。

为了进行比较，在没有显式委托指令的情况下运行相同的任务：

```bash title="Terminal"
bun run index.ts . "Find every place this project uses zod and tell me which files import from it."
```

家长可以委托也可以不委托。 有了强大的工具描述，它可能会直接调用 `grep` 。 没关系。 当搜索必须遍历许多文件并且父级不希望所有文本都出现在其上下文中时，委派工具就会发挥作用。

```bash title="Terminal"
npx tsc --noEmit
```

### 犯罪

```bash
git add src/tools.ts index.ts
git commit -m "feat(subagents): add explorer via task tool"
```

### 完成时间

- [ ] `createTaskTool` 存在并返回 `task` 工具
- [ ] 任务工具每次调用都会生成一个新的 `ToolLoopAgent`
- [ ] 浏览器仅具有 `read` 和 `grep`
- [ ] 浏览器使用 `claude-haiku-4-5` 并在 5 步处停止
- [ ] 错误以字符串形式返回，而不是异常
- [ ] 家长可以委托研究并获得清晰的总结
- [ ] `npx tsc --noEmit` 通行证

**注意：并行浏览器**

单个探索器是一个协程。 从父级工具循环中并行生成两个是真正的并行性。 尝试更改任务工具的架构以接受描述数组并使用 `Promise.all` 运行它们。 现在，家长可以同时调查代码库的三个不同部分并综合结果。 家长利用这一点的提示有何变化？

### 解决方案

```ts title="src/tools.ts (createTaskTool)"
import { ToolLoopAgent, stepCountIs, tool } from "ai";
import { z } from "zod";
import type { Sandbox } from "./sandbox";

export function createTaskTool(
  sandbox: Sandbox,
  parentTools: { read: any; grep: any },
) {
  return tool({
    description: `Delegate research to a read-only subagent.
WHEN TO USE: investigating a codebase, finding patterns, gathering context.
WHEN NOT TO USE: making changes (the subagent cannot write or run commands).
DO NOT USE FOR: tasks that need decisions or askUser interactions.`,
    inputSchema: z.object({
      description: z.string().describe("What the subagent should investigate"),
    }),
    execute: async ({ description }) => {
      const explorer = new ToolLoopAgent({
        model: "anthropic/claude-haiku-4-5",
        instructions: `You are an explorer agent. Investigate and report back concisely.
Working directory: ${sandbox.workingDirectory}`,
        tools: { read: parentTools.read, grep: parentTools.grep },
        stopWhen: stepCountIs(5),
      });

      try {
        const { text, steps } = await explorer.generate({ prompt: description });
        return text
          ? `[Explorer: ${steps.length} steps]\n${text}`
          : "(no response from subagent)";
      } catch (e: any) {
        return `Subagent error: ${e.message}`;
      }
    },
  });
}
```

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 22. 执行子代理
原文标题：Executor Subagent
原文链接：https://vercel.com/academy/build-ai-agent-harness/executor-subagent
导读：一个全能力的实施子代理。 委托信任、更强的模型、更大的步骤预算。
探索者收集信息。 执行者对其采取行动。

这两个角色的划分与委托对代理本身的划分是一样的。 探索成本低廉、只读且容量大。 执行成本更高，可以修改文件，并且需要更强大的模型，因为出错的成本更高。

遗嘱执行人继承了父母的信任。 父角色决定允许执行者做什么，执行者精确地遵循指令，并且两个角色都不会询问用户任何事情。 那就留在父母身边。

### 结果

任务工具中的第二个分支使用 `claude-sonnet-4-6` 和 15 步预算，生成具有 `read`、`grep` 和委托模式 `bash` 的执行程序子代理。 家长现在可以在委派时在探索者和执行者之间进行选择。

### 快速通道

1. 使用 `subagentType: "explorer" | "executor"` 字段扩展 `task` 工具架构
2. 添加一个执行器分支，该分支使用更强大的模型、更大的步骤预算和委托模式 bash
3. 更新描述以使父级可以清晰地理解路由

### 实践练习 6.3

添加执行者角色并从 `task` 工具路由到它。

**要求：**

1. 将 `subagentType` 添加到任务工具的输入架构中，作为 `"explorer" | "executor"` 的枚举，默认为 `"explorer"`
2. 当 `subagentType === "executor"` 时，使用 `read`、`grep` 和委托模式 `bash` 实例化 `ToolLoopAgent`
3. 执行器使用 `claude-sonnet-4-6` 和 `stopWhen: stepCountIs(15)`
4. 使用 `createApproval({ mode: "delegated", trust: [...] })` 构建执行者的 `bash`，传递一个小的信任列表（`"npm test"`、`"npm run build"`、`"npx tsc"`）
5. 更新任务工具描述以向家长解释这两个角色

**实施提示：**

- 执行者需要自己的具有委托模式批准的 `bash` 工具。 不要重用父级的交互式 bash，因为交互模式会因执行器无法回答的用户提示而暂停
- Sonnet 是执行者工作的正确默认值。 Opus 对于大多数实施任务来说都是杀伤力大的，而且速度慢得足以让人感觉到
- 信任列表故意很小。 执行者应该只运行父级认为安全的命令。 测试运行程序和构建命令通常是安全的。 软件包安装和迁移不是

#### 执行者分支

```ts title="src/tools.ts (extended task tool)"
export function createTaskTool(
  sandbox: Sandbox,
  parentTools: { read: any; grep: any },
) {
  return tool({
    description: `Delegate work to a subagent.
Explorer (default): read-only research with a fast model.
Executor: implementation with a stronger model and delegated trust on bash.

WHEN TO USE: research across many files (explorer), bulk implementation (executor).
WHEN NOT TO USE: ambiguous requirements (use askUser),
  architectural decisions (the parent decides).`,
    inputSchema: z.object({
      description: z.string().describe("Task instructions for the subagent"),
      subagentType: z
        .enum(["explorer", "executor"])
        .default("explorer")
        .describe("Subagent role"),
    }),
    execute: async ({ description, subagentType }) => {
      if (subagentType === "executor") {
        const executorBash = createBashTool(
          sandbox,
          createApproval({
            mode: "delegated",
            trust: ["npm test", "npm run build", "npx tsc"],
          }),
        );

        const executor = new ToolLoopAgent({
          model: "anthropic/claude-sonnet-4-6",
          instructions: `You are an executor agent. Follow instructions precisely.
Working directory: ${sandbox.workingDirectory}
Do NOT ask questions. Do NOT explore beyond what's needed. Execute the task.`,
          tools: {
            read: parentTools.read,
            grep: parentTools.grep,
            bash: executorBash,
          },
          stopWhen: stepCountIs(15),
        });

        try {
          const { text, steps } = await executor.generate({ prompt: description });
          return text
            ? `[Executor: ${steps.length} steps]\n${text}`
            : "(no response from executor)";
        } catch (e: any) {
          return `Executor error: ${e.message}`;
        }
      }

      const explorer = new ToolLoopAgent({
        model: "anthropic/claude-haiku-4-5",
        instructions: `You are an explorer agent. Investigate and report back concisely.
Working directory: ${sandbox.workingDirectory}`,
        tools: { read: parentTools.read, grep: parentTools.grep },
        stopWhen: stepCountIs(5),
      });

      try {
        const { text, steps } = await explorer.generate({ prompt: description });
        return text
          ? `[Explorer: ${steps.length} steps]\n${text}`
          : "(no response from explorer)";
      } catch (e: any) {
        return `Explorer error: ${e.message}`;
      }
    },
  });
}
```

#### 探索者与执行者一览

|              | 探险家           | 执行者                           |
| ------------ | ------------------ | ---------------------------------- |
| 工具        | `read`、`grep`     | `read`、`grep`、`bash`（已委托） |
| 模型        | `claude-haiku-4-5` | `claude-sonnet-4-6`                |
| 步骤预算  | 5                  | 15                                 |
| 可以修改   | 不                 | 是（在信任列表内）            |
| 可以询问用户 | 不                 | 不                                 |

这两个角色在工具能力、模型强度和预算方面存在差异。 他们同意一件事：都不能向用户提问。 这种责任由父母承担，这是人类参与其中的角色。

#### 指令质量对于执行者来说更重要

探险家主要是环顾四周。 模糊的描述仍然会产生有用的东西。 执行者按照字面意思执行指令。 模糊的描述会给你带来模糊的（并且可能是破坏性的）结果。

坏的：

```
Fix the auth bug.
```

好的：

```
In src/auth.ts, the login function at line 42 doesn't check for null email.
Add a null check before the database query. Run `npx tsc --noEmit` after the change.
```

家长的工作是提供目标、程序、约束和验证步骤。 执行者的工作就是跟踪他们。 系统提示的“请勿提问”行在这里发挥了实际作用。 它迫使执行者要么按照现有的行动采取行动，要么失败，而不是拖延澄清。

**注意：委托信任，而不是一揽子信任**

执行者的 `bash` 使用模块 2 批准配置中的 `mode: "delegated"`。 父级决定哪些命令是可信的。 执行器可以运行`npm test`。 它无法运行 `npm install`、`rm -rf` 或列表中未列出的任何其他内容。 这是首先证明受歧视联盟合理性的用例。

### 尝试一下

请家长委托一些需要采取行动的事情，而不仅仅是研究：

```bash title="Terminal"
bun run index.ts . "Delegate to an executor: rename the 'cwd' variable in src/sandbox-local.ts to 'workingDir'. Then run npx tsc --noEmit and report the result."
```

父级应使用 `subagentType: "executor"` 调用 `task`。 执行者应该进行更改、运行类型检查并返回摘要。 将相同任务与资源管理器模式所获得的结果进行比较（它无法改变任何内容）。

```bash title="Terminal"
npx tsc --noEmit
```

### 犯罪

```bash
git add src/tools.ts
git commit -m "feat(subagents): add executor role with delegated bash"
```

### 完成时间

- [ ] `task` 工具架构包括 `subagentType: "explorer" | "executor"`
- [ ] 执行器使用 `claude-sonnet-4-6` 和 15 步预算
- [ ] Executor在`mode: "delegated"`中有自己的`bash`，有一个小的信任列表
- [ ] 执行者遵循精确的指示并且不提出问题
- [ ] 资源管理器行为与上一课相比没有变化
- [ ] `npx tsc --noEmit` 通行证

**注意：继承父级的信任**

执行者的信任列表现在是硬编码的。 尝试通过线程化父级的信任列表：当父级生成执行器时，执行器将获取父级的安全命令。 现在想想边界。 是否应该允许执行者生成具有相同信任的另一个执行者？ 或者每个级别都应该缩小信任集？ 生产线束的做法有所不同，答案取决于您对代理计划的信任程度。

### 解决方案

有关完整实现，请参阅上面的 `createTaskTool` 代码块。 本练习的解决方案是将相同的代码应用于您的 `src/tools.ts`。

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 23. 任务工具
原文标题：Task Tool
原文链接：https://vercel.com/academy/build-ai-agent-harness/task-tool
导读：通过一个任务工具路由委派，并使用每个角色模型和生成权限的形状。
您已经拥有大部分任务工具。 第 6.2 课和第 6.3 课在其 `execute` 函数内构建了资源管理器和执行器分支。

本课是关于将工具视为实际的路由层。 父级调用 `task`。 该工具选择正确的子代理类型，验证父代理生成它的权限，并返回结果。 稍后添加更多角色（审阅者、架构师、验证者）应该是添加分支的问题，而不是重新设计工具。

### 结果

`task` 工具被构造为一个显式路由器，具有统一的描述、特定于角色的模型以及在需要时进行生成权限检查的明确位置。

### 快速通道

1. 收紧 `task` 工具描述，以便父级知道何时选择哪个角色
2. 将子代理结构提取到一个小助手中，以便稍后添加角色是一个块
3. 勾画出生成权限检查的形状，即使您还没有强制执行它

### 实践练习 6.4

重构 `createTaskTool` 因此路由是您首先看到的，下面是特定于角色的构造。

**要求：**

1. 任务工具的描述命名了这两个角色，说明了每个角色的优点，并将父级指向 `askUser` 并直接处理非委派的情况
2. `execute` 主体是一个薄路由器。 每个角色都是由同一文件内的单独辅助函数构建的
3. 每个角色助手获取沙箱和父工具，返回 `ToolLoopAgent`，并在其定义的顶部公开模型和步骤预算
4. 将错误处理保留为字符串返回，而不是抛出异常

**实施提示：**

- 这两个助手可以共享生成和格式化函数，因此 `[Role: N steps]` 格式化位于一个位置
- 不要过度抽象。 两个助手和一个路由器就足够了。 当您有五个角色而不是两个角色时，注册和工厂系统是正确的选择
- 描述是家长阅读的内容。 何时使用和何时不使用也适用于路由层，而不仅仅是单个工具

#### 路由器形状

```ts title="src/tools.ts (refactored task tool)"
function buildExplorer(sandbox: Sandbox, parentTools: { read: any; grep: any }) {
  return new ToolLoopAgent({
    model: "anthropic/claude-haiku-4-5",
    instructions: `You are an explorer agent. Investigate and report back concisely.
Working directory: ${sandbox.workingDirectory}`,
    tools: { read: parentTools.read, grep: parentTools.grep },
    stopWhen: stepCountIs(5),
  });
}

function buildExecutor(sandbox: Sandbox, parentTools: { read: any; grep: any }) {
  const executorBash = createBashTool(
    sandbox,
    createApproval({
      mode: "delegated",
      trust: ["npm test", "npm run build", "npx tsc"],
    }),
  );
  return new ToolLoopAgent({
    model: "anthropic/claude-sonnet-4-6",
    instructions: `You are an executor agent. Follow instructions precisely.
Working directory: ${sandbox.workingDirectory}
Do NOT ask questions. Do NOT explore beyond what's needed. Execute the task.`,
    tools: { read: parentTools.read, grep: parentTools.grep, bash: executorBash },
    stopWhen: stepCountIs(15),
  });
}

async function runSubagent(role: string, agent: ToolLoopAgent, description: string) {
  try {
    const { text, steps } = await agent.generate({ prompt: description });
    return text ? `[${role}: ${steps.length} steps]\n${text}` : `(no response from ${role})`;
  } catch (e: any) {
    return `${role} error: ${e.message}`;
  }
}

export function createTaskTool(
  sandbox: Sandbox,
  parentTools: { read: any; grep: any },
) {
  return tool({
    description: `Delegate work to a subagent.
Explorer (default): read-only research with Haiku. Use for searching across files,
  understanding patterns, and gathering context.
Executor: implementation with Sonnet and delegated bash. Use for focused
  changes with explicit instructions and a known verification step.

WHEN TO USE: research across many files (explorer), bulk implementation (executor).
WHEN NOT TO USE: ambiguous requirements (use askUser), architectural decisions
  (the parent decides).
DO NOT USE FOR: single-step tasks the parent can do directly.`,
    inputSchema: z.object({
      description: z.string().describe("Task instructions for the subagent"),
      subagentType: z
        .enum(["explorer", "executor"])
        .default("explorer")
        .describe("Subagent role"),
    }),
    execute: async ({ description, subagentType }) => {
      const agent =
        subagentType === "executor"
          ? buildExecutor(sandbox, parentTools)
          : buildExplorer(sandbox, parentTools);
      return runSubagent(subagentType, agent, description);
    },
  });
}
```

路由器现在是五线。 其他一切都是按角色构建的。

#### 生成权限去哪里

现在，任何代理都可以使用任何 `subagentType` 调用 `task`。 对于入门安全带来说这很好。 在分层设置中，您需要每个角色的权限映射：

```ts title="src/tools.ts (sketch)"
const SPAWN_PERMISSIONS: Record<string, string[]> = {
  orchestrator: ["explorer", "executor", "reviewer"],
  executor: ["explorer"],
  explorer: [],
};

function canSpawn(parentRole: string, subagentType: string): boolean {
  return SPAWN_PERMISSIONS[parentRole]?.includes(subagentType) ?? false;
}
```

支票位于 `execute` 的顶部。 如果不允许生成，则返回错误字符串并且不构建子代理。

我们还没有将其添加到工作工具中，因为父级此时还没有角色。 当您开始使用本身称为 `task` 的子代理时，权限表是您接下来需要的东西。 在那之前，缺席情况很好，形状也被记录下来。

#### 每个角色的模型，而不是每个会话的模型

该模型是角色定义的一部分，而不是全局设置：

| 角色                 | 模型  | 为什么                             |
| -------------------- | ------ | ------------------------------- |
| 探险家             | 俳句  | 快速、便宜、只读          |
| 执行者             | 十四行诗 | 实施可靠     |
| 审稿人（后）     | 作品   | 代码审查的重推理 |
| 协调员（后来） | 十四行诗 | 多工具铣削              |

不同的角色，不同的模型。 不要选择一种模型并在任何地方使用它。 长期任务的成本差异会加剧，而且失败模式也不同。

**注意：两个角色是正确的起点**

您可以构建更高级的层次结构：架构师、规划师、审阅者、集成者。 我们不这样做是因为两个角色涵盖了大多数线束关心的工作。 当您有真正的任务需要它们时，添加更多。 不要推测性地添加它们。 每个角色都是一个新的指令漂移位置和新的模型账单跟踪。

### 尝试一下

请家长按顺序委派两项工作：先研究，然后实施：

```bash title="Terminal"
bun run index.ts . "First, delegate to an explorer: find every file that uses the zod schema for tools. Then delegate to an executor: in those files, add a comment above each tool() call saying which lesson introduced it."
```

您应该看到来自父级的两个任务调用。 第一个返回文件列表。 第二个执行编辑并返回报告。

```bash title="Terminal"
npx tsc --noEmit
```

### 犯罪

```bash
git add src/tools.ts
git commit -m "refactor(subagents): split task tool into router and role helpers"
```

### 完成时间

- [ ] `createTaskTool` 是一个瘦路由器，由 `subagentType` 调度
- [ ] 每个角色都存在于一个单独的助手中 (`buildExplorer`, `buildExecutor`)
- [ ] 任务工具描述列出了两个角色以及使用每个角色的正确时间
- [ ] 错误以字符串形式返回，而不是异常
- [ ] 添加第三个角色就是一个新的助手和一个新的分支，仅此而已
- [ ] `npx tsc --noEmit` 通行证

**注意：添​​加审阅者角色**

尝试添加 `reviewer` 子代理：只读工具、Opus 级模型，以及返回 `pass` 或 `fail` 并带有反馈的 `verdict` 工具。 执行程序完成后，自动生成一个审阅者，其中包含原始任务和执行程序的差异。 如果审阅者失败，请重新运行执行器并附加反馈。 将重试次数限制为两次。 什么模型组合可以产生最佳的评论质量？ 审稿人什么时候会橡皮图章而不是发现真正的问题？

### 解决方案

请参阅上面的路由器形状。 练习解决方案是相同的代码，应用于您的 `src/tools.ts`。

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 24. 状态机
原文标题：State Machine
原文链接：https://vercel.com/academy/build-ai-agent-harness/state-machine
导读：配置、活动、休眠、休眠。 两次超时以及什么算作活动。
云沙箱没有“运行”或“停止”。 它经过四个州，它们之间的区别就是你要花钱的地方。

将生命周期视为状态机。 这听起来很重量级。 事实并非如此。 四个状态、两个计时器和一个活动跟踪器就是全部。 当其中一个部分缺失或错误时，错误就会发生，而月底的账单会告诉你这一点。

### 结果

您可以命名这四种状态，解释在它​​们之间移动沙箱的两个超时，并确定活动跟踪器应该计数的内容以及应该忽略的内容。

### 各州

```
provisioning -> active -> hibernating -> hibernated
                  ^             |
                  +-------------+ (restore)
```

| 状态        | 发生了什么事                             | 成本                 |
| ------------ | -------------------------------------------- | -------------------- |
| 配置 | 虚拟机正在启动，依赖项正在安装   | 计费已开始  |
| 积极的       | 代理正在工作，命令运行，文件更改 | 全部每分钟费用 |
| 冬眠  | 快照正在进行中，沙箱完成   | 全部每分钟费用 |
| 休眠   | VM 已停止，快照已存储            | 仅存储成本    |

活跃是昂贵的状态。 休眠是最便宜的。 之间的两个转换（配置和休眠）很短，但按全费率计费，因此您不希望它们发生超出需要的次数。

### 两次暂停

每个云沙盒上运行两个时钟。 它们在不同的事物上到期，而你只能控制其中之一。

#### 硬性过期

提供商设置最长生命周期。 一到四个小时，具体取决于平台。 当时钟为零时，无论发生什么情况，虚拟机都会被终止。 你不能延长它。 你无法与之争论。 您只能在它触发之前完成，或者在它触发之前拍摄快照。

#### 不活动窗口

你设置这个。 N 分钟没有活动后，沙箱会自行休眠。 对于大多数代理工作负载来说，五分钟是合理的默认值。 两分钟是激进的（沙箱在回合之间休眠）。 二十分钟是宽松的（你要为空闲时间付费）。

```ts
const INACTIVITY_WINDOW = 5 * 60 * 1000;
```

硬过期是最坏情况的账单。 不活动是典型的账单。 他们都很重要。

### 什么才算是活动

活动跟踪器使非活动窗口正常工作。 该实现是在每个“真实”事件上更新一个时间戳，但关键在于确定什么是真实的：

| 事件                                     | 算作活动吗？ |
| ----------------------------------------- | ------------------- |
| 来自用户的聊天消息                    | 是的                 |
| 执行工具调用                        | 是的                 |
| 沙箱事件（文件写入、进程生成） | 是的                 |
| 状态轮询                            | 不                  |
| 重新连接探头                           | 不                  |
| 健康检查                              | 不                  |

如果您的状态轮询算作活动，则沙箱永远不会休眠，并且您需要为数小时的空闲时间付费。 如果您的工具调用不算数，则沙箱会在任务中休眠，并且您会丢失正在进行的工作。 这两种故障模式都很常见。

### 追踪时间线

```
0:00  User sends message, sandbox is provisioned
0:02  Sandbox active, agent starts working
0:05  Agent runs npm install (3 minutes)
0:08  Agent finishes, responds to user
0:13  Inactivity window expires (5 min since last activity)
0:13  Sandbox starts hibernating, snapshot in progress
0:14  Snapshot complete, sandbox hibernated
0:20  User sends another message, sandbox restores from snapshot
0:21  Sandbox active again, agent continues where it left off
1:30  Hard expiry hits, VM is killed
```

根据这个时间表，有两个问题值得回答：

1. 安全带应在什么时候警告用户硬过期即将到来？
2. 应何时触发自动快照以便用户可以在过期后恢复？

这两个问题的答案取决于您的平台的存储费用以及强制到期对代理任务的破坏程度。 没有单一的正确答案。 有一种是错误的（不执行任何操作），另一种是错误较少的（在 80% 硬过期时自动生成快照）。

### 尝试一下

这是概念课。 检查一下自己：

1. 从内存中绘制状态机并标记每个转换
2. 用一句话解释为什么硬性到期不能延长
3. 从活动表中选择一个事件并解释为什么它有效或无效

如果您从模块 4 连接生命周期挂钩，则在构建真正的云后端时，您可以在一个地方附加状态、`lastActivityAt` 和 `hardExpiryAt`。 本地和 `just-bash` 后端实际上不会触发这些超时，但形状已经就位。

### 犯罪

本课中没有代码。 本地沙箱还没有可以跟踪的有意义的超时。

### 完成时间

- [ ] 您可以按顺序命名这四种状态
- [ ] 您可以描述硬过期和不活动窗口之间的区别
- [ ] 您可以识别什么算作活动，什么算作噪音
- [ ] 您可以跟踪上面的时间线并解释何时应触发自动快照

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 25. 快照和恢复
原文标题：Snapshot and Restore
原文链接：https://vercel.com/academy/build-ai-agent-harness/snapshot-and-restore
导读：冻结文件系统，返回 ID，稍后恢复。 三个地方幂等性。
快照冻结沙箱文件系统并返回 ID。 恢复会根据该 ID 创建一个新的沙箱。 相同的文件，相同的状态，不同的虚拟机。

机制很简单。 出错的地方却不是。 它们三个都与幂等性有关，即调用某项两次会产生与调用一次相同的结果的属性。 沙箱充满了您真的、真的不想不假思索地调用两次的操作。

### 结果

您可以描述 `snapshot` 保留什么以及 `restore` 创建什么，并且可以识别生产生命周期代码中出现的三种幂等性危险。

### 应用程序编程接口

```ts
const { snapshotId } = await sandbox.snapshot!();

const restored = await createCloudSandbox({ snapshotId });
```

这就是表面。 一切有趣的事情都发生在它周围。

### 快照保留什么

快照捕获文件系统状态。 `/workspace` 的内容（或您的沙箱根目录）、任何已安装软件包的状态、代理创建的任何文件。 它们不捕获正在运行的进程、正在进行的网络连接或内存状态。 编译步骤进行到一半的长时间运行的构建不会在恢复后从中断处继续。 文件系统快照； 正在进行的工作则不然。

这对于代理人的心理模型很重要。 恢复后，代理拥有之前拥有的所有文件，但如果快照触发时代理正在运行测试，则必须再次运行测试。

### 幂等性的三大危害

#### 1. 快照已在进行中

用户（或生命周期工作流）在快照已经运行时触发快照。 如果没有防护，您会得到两个快照争夺同一个虚拟机，或者出现提供者错误，或者看起来有效但实际上无效的部分快照。

```ts
let inFlight: Promise<{ snapshotId: string }> | null = null;

snapshot: async () => {
  if (inFlight) return inFlight;
  inFlight = vm.snapshot();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
},
```

缓存 Promise，在第二次调用时返回它，在工作完成时清除它。

#### 2. 沙箱已在恢复时运行

用户重新连接到已经处于活动状态的会话，并且该工具会在其之上触发恢复。 现在您有两个虚拟机。 新的就是浪费钱。 旧的仍在提供交通服务。

```ts
async function attachOrRestore(sessionId: string, snapshotId: string) {
  const existing = await findActiveSandbox(sessionId);
  if (existing) return existing;
  return createCloudSandbox({ snapshotId });
}
```

创建之前先看看。 恢复路径应始终首先检查活动沙箱。

#### 3.双停

`stop` 由不活动计时器调用一次，由用户调用一次。 或者一次进入休眠状态，一次强制到期。 第二个调用会触及已经消失的沙箱，并且根据提供商的不同，要么大声失败，要么默默地破坏状态。

```ts
let stopped = false;

stop: async () => {
  if (stopped) return;
  stopped = true;
  await vm.close();
},
```

一个布尔值就足够了。 关键是第二个 `stop` 没有执行任何操作，而是击中了死虚拟机。

### 恢复不能解决什么问题

快照是时间上的一个时刻。 从昨天的快照恢复仍然会为您提供昨天的代码、昨天的依赖项、昨天的环境。 如果项目已经继续（新的提交、新的包、新的环境变量），则恢复的沙箱就是化石。

生产生命周期通过在项目更改时使快照无效或在恢复后重新运行安装挂钩（模块 4 中的 `afterStart`）来处理此问题。 两者都不是自动的。 两者都必须有意连接。

**注意：本地沙箱可以伪造这个**

本地后端没有真正的快照机制，但您可以使用 `git stash` 或工作目录的 tarball 来绘制快照机制。 它并不等同于云快照（没有虚拟机状态，没有安装缓存），但它教会了我们接缝。 如果你想尝试一下形状，这是一个很好的起点。

### 尝试一下

这是概念课。 检查一下自己：

1. 不回头，说出三种幂等性危险
2. 用你自己的话写下 `snapshot` 保留的内容和不保留的内容
3. 将 `attachOrRestore` 流程绘制为序列图。 相对于快照查找，活动沙箱检查发生在哪里？

如果您想在本地使用该形状，请将 `snapshot` 添加到运行 `git stash push` 的本地沙箱并返回存储引用作为快照 ID。 语义是错误的（真实的快照会冻结所有内容，而不仅仅是跟踪的文件），但接缝是真实的。

### 犯罪

除非您正在绘制本地快照，否则本课程中没有代码。 如果这样做，请将其提交到单独的分支上，这样它就不会与工作线束纠缠在一起。

### 完成时间

- [ ] 您可以描述快照保留什么以及不保留什么
- [ ] 您可以命名三种幂等性危险以及每种危险的防护模式
- [ ] 您可以解释为什么恢复的快照可能仍需要 `afterStart` 才能重新运行

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 26. 持久的工作流程
原文标题：Durable Workflows
原文链接：https://vercel.com/academy/build-ai-agent-harness/durable-workflows
导读：setTimeout 在函数结束时终止。 Vercel 工作流在部署后仍然存在。
沙盒生命周期想做一些简单的事情。 每三十秒检查一次沙箱是否空闲足够长的时间以进行休眠。 如果是，则快照并停止。 如果没有，请再等待三十秒。

在长时间运行的服务器中，这是一个 `setInterval` ，然后您就可以回家了。 在无服务器中，该函数会在一两分钟后终止，并带走计时器。 沙箱继续运行，您继续付费，并且您的生命周期代码位于不再存在的其他进程中。

您需要耐用的基础设施。 可以跨功能边界休眠并在另一侧恢复的东西。 Vercel 工作流程执行此操作。 即使您使用不同的运行时，该模式也很重要。

### 结果

您可以解释为什么 `setTimeout` 在无服务器环境中的沙箱生命周期失败，并且您可以绘制一个持久的工作流循环，该循环轮询沙箱、空闲时快照并在部署后恢复。

### setTimeout 的问题

```ts
setTimeout(() => checkAndSnapshot(), 30_000);
```

这在本地有效。 It does not work in serverless.

调用 `setTimeout` 的函数返回。 运行时清理函数的进程。 超时被垃圾收集。 该支票永远不会运行。 沙箱继续运行。 您的每月账单会显示无限沙箱运行时间的成本。

即使该函数在第一次检查时保持活动状态足够长的时间，也不能保证下一次部署不会取代它。 每次重新部署时您都会丢失计时器状态。

### 工作流程模式

Vercel Workflow 公开了一个 `sleep()` ，它不依赖于主机进程保持活动状态：

```ts title="src/lifecycle.ts"
"use workflow";
import { sleep } from "workflow/sleep";

const POLL_INTERVAL = 30;
const INACTIVITY_WINDOW = 5 * 60;

export async function sandboxLifecycle(sandboxId: string) {
  while (true) {
    await sleep(POLL_INTERVAL);

    const status = await checkSandboxStatus(sandboxId);

    if (status === "expired") {
      break;
    }

    if (status.lastActivity + INACTIVITY_WINDOW < Date.now() / 1000) {
      await snapshotAndStop(sandboxId);
      break;
    }
  }
}
```

`sleep(30)` 不会暂停该函数。 它将工作流程检查到持久存储并返回。 三十秒后，无论函数实例是否可用，工作流程都会从其停止的位置继续。 跨部署。 跨主机重新启动。 无论平台在幕后做什么。

这就是窍门。 循环体是普通代码。 `sleep` 就是魔法。

### 台阶边界

在工作流程内部，对外部系统（提供者 API、您的数据库、任何类型的副作用）的调用位于 `"use step"` 函数中：

```ts title="src/lifecycle-steps.ts"
"use step";

export async function checkAndSnapshotStep(sandboxId: string) {
  const sandbox = await getSandbox(sandboxId);
  if (!sandbox.isActive) return { action: "stop" };

  const idle = Date.now() - sandbox.lastActivityAt;
  if (idle > INACTIVITY_WINDOW) {
    await sandbox.snapshot();
    await sandbox.stop();
    return { action: "hibernated" };
  }

  return { action: "continue" };
}
```

步骤函数会在暂时失败时重试，并在成功时缓存。 工作流循环像普通函数一样调用它们。 运行时间使耐久性得以实现。

### 成本数学

这可以为您节省多少时间，具体取决于您的典型会话的空闲程度。 合理的中间情况：

| 设置                        | 行为                              | 每次会话费用           |
| ---------------------------- | ------------------------------------- | -------------------------- |
| 无生命周期                 | 沙盒运行至硬过期（4 小时） | 4 小时 x 0.02 美元/分钟 = 4.80 美元     |
| 基于不活动的休眠 | 沙箱闲置 5 分钟后休眠   | 25 分钟 x 0.02 美元/分钟 = 0.50 美元 |

长时间会话大约是一个数量级。 节省的费用会随着用户和时间的推移而复合。

**注意：该模式在运行时仍然存在**

Vercel Workflow 是一种实现。 时间是另一个。 AWS Step Functions 是另一个。 原理是相同的：在函数边界后存活的睡眠让您可以编写生命周期代码，就好像您有一个长时间运行的进程一样，即使您没有。 如果您使用不同的运行时，请查找 `sleep()` 的等效项和步骤函数的等效项。 仅当您真心实意时才推出自己的产品。

### 演示停止的地方

本课程中的本地和 `just-bash` 后端不运行持久的工作流程。 他们不需要。 生命周期是进程的生命周期。 没有什么不活动可以冬眠。

模块 4 中的生命周期挂钩是云后端的插入位置。 `afterStart` 将启动持久工作流程。 `beforeStop` 会告诉工作流程结束。 工作流本身将通过相同的 `Sandbox` 接口回调到沙箱，像任何其他消费者一样调用 `snapshot()` 和 `stop()` 。

这就是为什么界面是这样的。 同步、进程内世界（本地）和异步、多部署世界（云）都位于同一表面后面，因为工作流运行时处理最困难的部分。

### 尝试一下

这是概念课。 检查一下自己：

1. 用一句话解释为什么 `setTimeout` 在无服务器中的沙箱生命周期失败
2. 跟踪工作流程循环并列出 `sleep` 可以在部署中设置检查点的每个位置
3. 计算您实际运行的工作负载所节省的成本。 您每次会话的平均空闲时间是多少？

### 犯罪

本课中没有代码。 下一课列出了即使持久工作流程正确连接也会出现的生产陷阱。

### 完成时间

- [ ] 你可以解释为什么 `setTimeout` 在无服务器中不起作用
- [ ] 您可以绘制工作流程循环并识别耐久性接缝
- [ ] 您可以对您选择的工作负载进行成本计算

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 27. 来之不易的教训
原文标题：Hard-Won Lessons
原文链接：https://vercel.com/academy/build-ai-agent-harness/hard-won-lessons
导读：真实沙箱生命周期实施中的生产陷阱。
以下五件事中的每一件事都会导致真正的中断、真正的成本飙升或真正的工作损失。 一旦你看到它们，它们看起来就很明显了。 在此之前它们并不明显，这就是它们不断发生的原因。

这些来自针对云沙箱运行生产代理工具的团队。 它们都不是理论上的。 这些模式在不同的提供商、不同的平台和不同的实现中重复出现。

### 结果

您可以列出五个生产生命周期问题，描述每个问题的故障模式，并应用修复模式。

### 重新连接后陈旧的句柄

您重新连接到现有沙箱。 该句柄是您以前拥有的句柄，或者是从会话记录重建的线束。 无论哪种方式，命令流都会被破坏。 命令输入，垃圾输出，或者呼叫永远挂起。

手柄在断开连接后仍然存在。 其中的会话没有。

**修复：** 在使用之前探测重新连接的手柄。

```ts
const sandbox = await reconnect(sandboxId);
const probe = await sandbox.exec("echo probe");
if (probe.exitCode !== 0 || probe.stdout.trim() !== "probe") {
  sandbox = await createFromSnapshot(lastSnapshotId);
}
```

探针是只读的且快速。 每次重新连接之前运行一个代理的成本比代理与死句柄交谈的成本要小得多。

### 过时的过期数据

沙箱在创建时报告 `expiresAt`。 如果您缓存该值并稍后对其进行检查，那么您将检查在存储该值时已经旧的数据。 更糟糕的是，如果在缓存失效后将派生值 (`remainingTimeout = expiresAt - now()`) 传递给提供者 API，则可能会意外创建已过期的沙箱。

**修复：** 在生命周期决策之前始终从提供者获取新的到期时间。

```ts
const { expiresAt } = await sandbox.getStatus();
if (expiresAt < Date.now()) {
  await beforeStop?.(sandbox);
}
```

缓存过期信息用于显示，而不是用于控制流。

### 轮询重置不活动状态

您的生命周期工作流程每三十秒轮询一次沙箱状态。 如果状态检查算作活动，则非活动窗口永远不会关闭。 沙箱运行直到硬性过期。 账单到了。

这是一个伪装成集成问题的干净的纯功能错误。 修复同时存在于两个地方：活动跟踪器必须忽略状态调用，并且状态调用必须小心不要触发活动编码的事件。

**修复：** 活动跟踪器仅计算用户启动的工作。

```ts
function recordActivity(event: SandboxEvent) {
  if (event.kind === "user_message" || event.kind === "tool_call" || event.kind === "fs_change") {
    sandbox.lastActivityAt = Date.now();
  }
}
```

状态 ping、运行状况检查、重新连接探测、计费读取：这些都不会重置计时器。

### 自动恢复循环

用户重新连接。 沙箱会从上次快照自动恢复。 自动恢复会触发生命周期检查，该检查尚未发现任何活动并决定创建快照。 快照触发休眠。 休眠触发下一次自动恢复。

您已经用两段单独看起来正确的代码创建了无限循环。

**修复：** 仅在初次输入时自动恢复。 随后的重新连接将加入活动沙箱。

```ts
if (isInitialEntry && sandbox.state === "hibernated") {
  await restore(sandbox.snapshotId);
}
```

状态机是你的朋友。 如果沙箱已经处于活动状态，则附加到它是正确的做法。 如果处于休眠状态，则恢复。 如果处于任何其他状态，请等待或失败。 不要自动链接转换。

### 状态分歧

沙盒状态存在于三个地方：提供商的 API、您的数据库、客户端的本地缓存。 他们会出现分歧。 无论你向用户显示的是什么，有时都会是错误的，而你信任的地方决定了它是会导致你花钱的错误，还是会导致你失去信任的错误。

**修复：** 提供商 API 是事实来源。 从那里导出显示的所有内容。

```ts
const { state } = await provider.getSandboxStatus(sandboxId);
ui.showState(state);
```

您的数据库是一个缓存。 客户端缓存是一个缓存。 事实也不是。 如有疑问，请获取。

**警告：组合比个体更糟糕**

每个陷阱本身都是不好的。 昂贵的错误来自于将它们组合起来。 陈旧的句柄加上轮询计数活动跟踪器意味着您需要继续为无法与之通信的沙箱付费。 发散缓存加上自动恢复循环意味着您可以为一个用户创建三个重复的沙箱。 纵深防御是这里的正确姿势。 修复所有五个问题，即使其中一两个在您的环境中看起来不太可能。

### 尝试一下

这是概念课。 检查一下自己：

1. 不回头，说出五个陷阱
2. 首先选择最有可能影响您的环境的一个。 为什么？
3. 对于每个问题，绘制失败时间表。 能抓住它的固定门在哪里？

如果您正在构建真正的云后端，请在编写云沙箱本身之前将修复门写入生命周期挂钩。 这些门不会对本地后端产生任何影响，但现在添加它们比以后进行改造更便宜。

### 犯罪

本课中没有代码。

### 完成时间

- [ ] 您可以说出所有五个陷阱
- [ ] 您可以描述每个问题的修复模式
- [ ] 您可以确定每个修复将插入模块 4 的生命周期挂钩中的哪些门

**注意：构建混乱模式**

生产沙箱故障看起来与本地开发故障不同。 为您的测试运行构建一个 `--chaos` 标志，该标志会在每个会话中随机注入一次失败：在命令中间终止沙箱进程，在重新连接时返回过时的句柄，强制缓存和提供程序之间出现状态分歧，或跳过单个状态更新。 在混乱模式下运行完整的代理循环。 首先出现的问题是你忘记防御的问题。

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 28. 结构化问题
原文标题：Structured Questions
原文链接：https://vercel.com/academy/build-ai-agent-harness/structured-questions
导读：具有多种选择的askUser工具，以及强制代理实际使用它的系统提示脚本。
代理人不会问你问题。 不是靠它自己。

您可以构建一个 `askUser` 工具。 代理将看到它，阅读其描述，然后继续不使用它。 在开发者聊天中训练的模型吸收了大量“让我为你解决这个问题”的能量。 询问对他们来说感觉很弱。 他们宁愿猜测。

修复分为两部分。 该工具很小，系统提示必须完成告诉客服人员询问是正确举动的工作。

### 结果

一个 `askUser` 工具，需要一个问题和 2 到 4 个选项，加上系统提示中的 `# Handling Ambiguity` 部分，用于编写何时使用它的脚本。 不明确的提示会触发该工具。 具体提示没有。

### 快速通道

1. 添加带有 `question` 和 `options` 的 `askUser` 工具（2 到 4 个字符串）
2. 将 `# Handling Ambiguity` 部分添加到 `buildSystemPrompt` 中，告诉代理先搜索，然后询问，然后采取行动
3. 用两种提示进行验证：一种是模糊的，一种是具体的

### 实践练习 8.1

构建工具，添加提示部分，并确认两个部分都在完成其工作。

**要求：**

1. 使用上面的架构将 `askUser` 添加到 `src/tools.ts`
2. 在 `execute` 内，将选项格式化为编号列表并返回模型将传回用户的字符串
3. 将 `# Handling Ambiguity` 添加到 `buildSystemPrompt`。 告诉代理人：第一搜索，第二询问，第三行动
4. 运行两个提示：一个不明确的提示（“添加身份验证”）和一个特定的提示（“在 auth.ts 的第 42 行添加空检查”）。 确认仅第一个触发 `askUser`

**实施提示：**

- `askUser` 工具的 `execute` 实际上并不等待用户。 它返回一个描述问题和选项的字符串。 它周围的线束（或读取输出的用户）在下一回合中提供答案
- 系统提示脚本比此处的工具描述做了更多的工作。 如果没有提示部分，即使提示模糊，模型也会将 `askUser` 视为可选
- 提示中的两个示例通常足以锚定该模式。 不要超载

#### 工具

```ts title="src/tools.ts"
import { tool } from "ai";
import { z } from "zod";

export function createAskUserTool() {
  return tool({
    description: `Ask the user a multiple-choice question.
WHEN TO USE: scoping ambiguous tasks, choosing between approaches,
  resolving a missing detail before acting.
WHEN NOT TO USE: you already have enough context to proceed.
DO NOT USE FOR: rhetorical questions or progress updates.`,
    inputSchema: z.object({
      question: z.string().describe("The question to ask the user"),
      options: z
        .array(z.string())
        .min(2)
        .max(4)
        .describe("Two to four options for the user to pick from"),
    }),
    execute: async ({ question, options }) => {
      const formatted = options.map((o, i) => `${i + 1}. ${o}`).join("\n");
      console.log(`\nQuestion: ${question}\n${formatted}\n`);
      return `Asked: "${question}"\nOptions:\n${formatted}\n\n(Awaiting user response.)`;
    },
  });
}
```

该工具将问题和选项打印到标准输出（以便用户看到它）并返回与字符串相同的内容（以便模型在消息历史记录中看到它）。 该模型知道问题正在处理中，并且不会尝试根据问题已得到解答的假设采取行动。

#### 系统提示添加

```ts title="src/system.ts (additions)"
sections.push(`

When the task is ambiguous or has multiple valid approaches:
1. Search the code or docs to gather context first
2. Use askUser to let the user choose. Do NOT guess.
3. Examples: "add auth" -> ask OAuth or JWT; "set up a db" -> ask Postgres or SQLite

Specific tasks (with file paths, line numbers, or precise instructions) do not
need askUser. Act directly.`);
```

编号协议很重要。 “搜索、询问、行动”为模型提供了一个可以遵循的顺序。 如果没有它，代理要么问得太早（在它有足够的上下文使问题变得有用之前），要么问得太晚（在它已经开始构建错误的东西之后）。

**警告：模型宁愿探索而不是询问**

即使使用该协议，代理也会在拉出 `askUser` 之前读取三到四个文件。 这是正确的行为，因为第一步是“首先搜索”。 它仍然值得了解，因为如果您看着它运行并且变得不耐烦，那么该模型并没有忽略您。 它正在收集上下文来提出一个有用的问题。

如果 `bash` 被批准阻止，代理将无法运行收集该上下文所需的命令。 它可能永远不会到达第 2 步。审批系统和 `askUser` 处于紧张状态，这种紧张是真正的架构摩擦，而不是需要修复的错误。

#### 将工具接线

```ts title="index.ts"
const tools = {
  read: createReadTool(sandbox),
  grep: createGrepTool(sandbox),
  bash: createBashTool(sandbox, createApproval({ mode: "interactive" })),
  task: createTaskTool(sandbox, { read, grep }),
  askUser: createAskUserTool(),
};
```

代理的工具列表现在包括 `askUser`。 系统提示告诉它何时使用它。 用户的终端显示问题。 模型的消息历史记录显示该问题正在悬而未决。

### 尝试一下

运行一个不明确的任务并观察代理询问：

```bash title="Terminal"
bun run index.ts . "Add authentication to this project"
```

您应该看到代理读取了一些文件，然后调用 `askUser` 并询问“我应该使用哪种身份验证策略？”之类的问题。 以及“OAuth”、“JWT”、“会话 cookies”等选项。 终端打印问题。 模特坐着等待。

现在运行特定任务并确认代理不会询问：

```bash title="Terminal"
bun run index.ts . "Add a null check at line 42 of src/auth.ts before the database query"
```

代理人应直接进行变更。 没有 `askUser` 调用。

```bash title="Terminal"
npx tsc --noEmit
```

### 犯罪

```bash
git add src/tools.ts src/system.ts index.ts
git commit -m "feat(askUser): add structured question tool with ambiguity protocol"
```

### 完成时间

- [ ] `askUser` 工具已连接并接受 2 到 4 个选项
- [ ] `# Handling Ambiguity` 部分位于系统提示符中
- [ ] 不明确的提示触发 `askUser`
- [ ]具体提示不
- [ ] `npx tsc --noEmit` 通行证

**注意：提出问题**

现在 `askUser` 返回一个字符串并且模型继续。 在真正的线束中，线束实际上会暂停，收集用户的选择，并将其作为下一条用户消息传回。 画出这个停顿是什么样子的。 线束在哪里拦截工具调用结果？ 用户的答案插入到对话中的哪里？ 模块 8.2 的事件方法是连接它的自然位置。

### 解决方案

```ts title="src/tools.ts (createAskUserTool)"
export function createAskUserTool() {
  return tool({
    description: `Ask the user a multiple-choice question.
WHEN TO USE: scoping ambiguous tasks, choosing between approaches,
  resolving a missing detail before acting.
WHEN NOT TO USE: you already have enough context to proceed.
DO NOT USE FOR: rhetorical questions or progress updates.`,
    inputSchema: z.object({
      question: z.string().describe("The question to ask the user"),
      options: z
        .array(z.string())
        .min(2)
        .max(4)
        .describe("Two to four options for the user to pick from"),
    }),
    execute: async ({ question, options }) => {
      const formatted = options.map((o, i) => `${i + 1}. ${o}`).join("\n");
      console.log(`\nQuestion: ${question}\n${formatted}\n`);
      return `Asked: "${question}"\nOptions:\n${formatted}\n\n(Awaiting user response.)`;
    },
  });
}
```

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 29. 审批配置
原文标题：Approval Config
原文链接：https://vercel.com/academy/build-ai-agent-harness/approval-config
导读：两种审批模式。 配置操作模式、可插拔安全事件。
您已经有了审批系统。 模块 2 使用 `interactive`、`background` 和 `delegated` 模式构建了可区分联合。 这回答了一个问题：*谁决定？*

它没有回答另一个问题：*适用哪些具体政策？*

CI 运行使用 `mode: "background"` 自动批准命令。 美好的。 但您还希望阻止对 `.env` 的任何写入，无论模式如何。 无论模式如何，您都希望将 bash 命令包装在更严格的操作系统级沙箱中。 这些规则不适合受歧视的工会。 他们住在下面一层。

本课程设置第二层（基于事件的拦截）并显示两个模型的交汇点。 事件层在构建过程中是概念性的，但现在的形状值得一看，因此您可以在需要时将其连接起来。

### 结果

您可以描述两种审批模型，确定哪一种模型适合哪种用例，并解释它们如何在生产线束中组合。

### 两种模型

配置模型就是您所拥有的：

```ts
type ApprovalConfig =
  | { mode: "interactive" }
  | { mode: "background" }
  | { mode: "delegated"; trust: string[] };
```

启动时设置。 在会话期间不会改变。 答案*谁决定*。

事件模型是下面的层：

```ts title="src/approval-events.ts (sketch)"
harness.on("tool_call", async (event) => {
  const { toolName, input } = event;

  if (toolName === "write" && input.path.endsWith(".env")) {
    return { block: true, reason: "Cannot modify .env files" };
  }

  if (toolName === "bash") {
    event.input.command = `sandbox-exec -p '(deny default)' ${input.command}`;
  }

  return { block: false };
});
```

每次调用工具时都会触发。 扩展可以阻止、修改或通过。 回答*适用哪些政策*。

### 何时使用哪个

| 使用案例                              | 配置               | 活动                |
| ------------------------------------- | -------------------- | --------------------- |
| CI 运行，自动批准一切       | `mode: "background"` | 矫枉过正              |
| 子代理继承父代理的信任 | `mode: "delegated"`  | 级别错误           |
| 阻止写入特定文件        | 太粗糙           | 文件级策略     |
| 将命令包装在操作系统级沙箱中     | 无法修改输入   | 输入修改    |
| 项目特定安全规则         | 仅限全球          | 每个项目的扩展 |

配置层用于整个会话的操作模式。 事件层用于细粒度、通常是特定于项目的、通常是可插入的策略。 它们有一点重叠。 他们不会互相取代。

### 它们如何结合

真正的安全带同时使用：

```ts title="src/index.ts (sketch)"
const approval = createApproval({ mode: "interactive" });

harness.on("tool_call", async (event) => {
  if (event.toolName === "write" && event.input.path.endsWith(".env")) {
    return { block: true, reason: "Protected file" };
  }
});
```

配置显示“交互模式，人类批准”。 事件处理程序说“无论人类批准什么，都不要碰 `.env`”。 该事件在配置之后但工具运行之前触发。 纵深防御。

这很重要，因为运营模式和政策往往来自不同的地方。 该模式由运行该工具的人员（CI、开发人员、委托子代理）设置。 策略由项目设置（`.env` 是敏感的，构建目录是只读的，任何涉及生产凭证的内容都需要操作系统级沙箱）。 一个配置旋钮无法在不混乱的情况下同时执行两种决策。

**注意：事件层插入模块 11**

我们将在模块 11 的可扩展性工作中构建实际的事件总线，其中生命周期事件是主要扩展点。 批准事件是一种特定类型的生命周期事件。 一旦总线存在，批准拦截器就是订阅 `tool_call` 的几行代码。

### 构建过程中缺少什么

到目前为止您构建的线束具有配置层。 它还没有事件层。 没关系。 配置层涵盖了课程需要教授的大部分情况。

添加事件层将如下所示：

1. 在线束中构建一个小型类型事件发射器（模块 11）
2. 在每个工具运行之前从代理循环发出 `tool_call` 事件
3. 让订阅者返回 `{ block, reason }` 或修改输入
4. 连接一个阻止写入硬编码文件的订阅者作为冒烟测试

工作量很小。 它不在本模块中，因为先决条件（事件、扩展）属于可扩展性故事的其余部分。 当您到达模块 11 时，基于事件的批准成为事件总线为何有用的一个具体示例。

### 尝试一下

这是概念课。 检查一下自己：

1. 对于上表中的五个用例中的每一个，确定最适合的模型
2. 绘制一个同时应用两个模型的用例。 每层的作用是什么？
3. 确定您参与过的一个项目，在该项目中基于事件的审批可能会发现真正的错误。 规则会是什么？

### 犯罪

本课中没有代码。 事件层到达模块 11。

### 完成时间

- [ ] 您可以描述配置方法及其答案
- [ ] 您可以描述事件方法及其答案
- [ ] 您可以选择适合给定用例的一个
- [ ] 您可以概述两者如何结合起来进行纵深防御

**注意：构建风险评分自动批准**

二进制批准和拒绝是粗糙的。 尝试返回 0 到 100 之间的数字的 `riskScore(command)` 函数。得分因素：写入磁盘加 30，网络访问加 20，文件删除加 50，修改配置加 40，只读为 0。设置阈值，例如 40。低于自动批准。 以上提示用户。 记录每个自动批准及其分数，以便您以后进行审核。 添加 `--risk-threshold` 标志，以便用户可以调整自己的舒适度。 现在弄清楚如何以不同于 `rm -rf /` 的方式对 `rm -rf /tmp/test` 进行评分，而无需纯粹根据关键字进行评分。

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 30. 所有工具
原文标题：Todo Tool
原文链接：https://vercel.com/academy/build-ai-agent-harness/todo-tool
导读：具有待处理、进行中和已完成状态跟踪以及单个活动项约束的任务分解。
如果你给智能体一个复杂的任务并观察它的工作，你会发现它会做与人类在压力下做的事情相同的事情：它一次开始五件事，没有完成任何一件事，然后解释它要做什么。

该修复方法与适用于人类的方法相同。 列一个清单。 选择一件事。 完成它。 把它划掉。 选择下一件事情。

待办事项工具就是该列表，有一个代理无法争论的规则：一次只有一项正在进行。

### 结果

具有 `add`、`start`、`complete` 和 `list` 操作的 `todo` 工具，由内存列表支持。 多步骤任务被分解和跟踪。 单步任务完全跳过该工具。

### 快速通道

1. 添加带有 `add`、`start`、`complete` 和 `list` 的 `todo` 工具
2. 跟踪内存数组中具有 `pending`、`in_progress` 和 `completed` 状态的项目
3. 当另一个项目已在进行中时拒绝 `start`

### 实践练习 9.1

构建该工具并验证一次仅活动约束。

**要求：**

1. `todo` 工具接受 `action` 枚举以及可选的 `description` 和 `id`
2. `add` 创建一个具有短生成 ID、`pending` 状态和给定描述的新项目
3. 如果另一个项目是 `in_progress`，则 `start` 会拒绝。 否则，它将指定项设置为 `in_progress`
4. `complete` 标记命名项 `completed`
5. `list` 将项目返回为带有状态标签的多行字符串

**实施提示：**

- 状态存在于模块范围内。 同一代理运行共享一个列表。 新的征程重新开始
- `crypto.randomUUID().slice(0, 8)` 对于内存列表来说已经足够了。 您不需要串行计数器
- 确保拒绝消息具体：“已经在处理：\[id] 描述。请先完成它。”

#### 工具

```ts title="src/tools.ts (additions)"
interface TodoItem {
  id: string;
  description: string;
  state: "pending" | "in_progress" | "completed";
}

const todos: TodoItem[] = [];

export function createTodoTool() {
  return tool({
    description: `Manage a task list for multi-step work.
WHEN TO USE: tasks with 3+ steps, multiple files, or dependencies between
  changes. Plan once, then track progress as you go.
WHEN NOT TO USE: single-file fixes, simple questions, exploratory reads.
DO NOT USE FOR: status updates to the user (just answer them directly).`,
    inputSchema: z.object({
      action: z.enum(["add", "start", "complete", "list"]),
      description: z.string().optional(),
      id: z.string().optional(),
    }),
    execute: async ({ action, description, id }) => {
      if (action === "add") {
        const item: TodoItem = {
          id: crypto.randomUUID().slice(0, 8),
          description: description ?? "(unnamed)",
          state: "pending",
        };
        todos.push(item);
        return `Added: [${item.id}] ${item.description}`;
      }

      if (action === "start") {
        const active = todos.find((t) => t.state === "in_progress");
        if (active) {
          return `Already working on: [${active.id}] ${active.description}. Complete it first.`;
        }
        const next = todos.find((t) => t.id === id);
        if (next) {
          next.state = "in_progress";
          return `Started: [${next.id}] ${next.description}`;
        }
        return `No todo with id ${id}.`;
      }

      if (action === "complete") {
        const item = todos.find((t) => t.id === id);
        if (item) {
          item.state = "completed";
          return `Completed: [${item.id}] ${item.description}`;
        }
        return `No todo with id ${id}.`;
      }

      return todos
        .map((t) => `[${t.state}] ${t.id}: ${t.description}`)
        .join("\n") || "No todos.";
    },
  });
}
```

单主动规则是承重部分。 如果没有它，代理将预先启动每一项，然后并行地完成它们，从而失去对每一项的关注。

#### 将其连接起来

```ts title="index.ts"
const tools = {
  // ...everything else
  todo: createTodoTool(),
};
```

系统提示的 Agency 和 Guardrails 部分已经引导代理采取行动。 该工具的“何时使用”描述告诉它何时首先计划而不是一头扎进去。

#### 何时计划，何时不计划

| 先计划                           | 跳过计划者                          |
| ------------------------------------ | ----------------------------------------- |
| 3个或更多步骤来完成任务 | 一个文件更改且位置已知     |
| 多个文件受影响              | 一个简单的问题，不需要文件 |
| 变更之间的依赖关系         | 探索尚未有具体结果  |
| 用户要求多部分功能  | 错误修复并提供精确的错误消息      |

如果代理为单行拼写错误修复制定了待办事项列表，则表明描述过于激进。 不使用时拧紧。

**注意：该列表有意保存在内存中**

todos 数组不会在运行过程中持续存在。 这是故意的。 跨会话的长期列表往往会变成陈旧项目的垃圾抽屉。 如果您希望稍后保留，请在会话结束时将列表快照到文件中。 不要将过时的 `in_progress` 项带入新会话，因为代理不记得它们为何启动。

### 尝试一下

运行多部分任务并观察计划的发生：

```bash title="Terminal"
bun run index.ts . "Add a 'verify' npm script that runs typecheck, lint, and tests in sequence. Then run it and report the result."
```

您应该看到代理调用 `todo add` 两到三次来制定计划，然后在处理项目时调用 `todo start` 和 `todo complete`。 该列表决不能在 `in_progress` 中包含两项。

运行一个简单的任务来确认代理跳过该工具：

```bash title="Terminal"
bun run index.ts . "What does the cwd variable in src/sandbox-local.ts do?"
```

客服人员应在不致​​电 `todo` 的情况下应答。 如果它为一步式问题指定待办事项，则描述过于急切。

```bash title="Terminal"
npx tsc --noEmit
```

### 犯罪

```bash
git add src/tools.ts index.ts
git commit -m "feat(planning): add todo tool with single-active constraint"
```

### 完成时间

- [ ] `todo` 工具已连接并接受 `add`、`start`、`complete`、`list`
- [ ] 一次只有一项是 `in_progress`
- [ ] 多步骤任务被分解
- [ ] 单步任务不会触发该工具
- [ ] `npx tsc --noEmit` 通行证

**注意：添​​加依赖项**

现在项目是独立的。 尝试将 `dependsOn: string[]` 添加到每个项目，列出必须首先完成的项目的 ID。 如果任何依赖项仍在挂起或正在进行中，则 `start` 操作应拒绝。 现在，多步骤任务可以表达真正的顺序：“重命名函数”取决于“找到每个调用者”。 从哪里开始感觉这有点矫枉过正了？

### 解决方案

请参阅上面的 `createTodoTool`。 练习解决方案是相同的代码，应用于您的 `src/tools.ts`。

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 31. 快速上下文理解
原文标题：Fast Context Understanding
原文链接：https://vercel.com/academy/build-ai-agent-harness/fast-context-understanding
导读：首先 grep ，只阅读您要更改的内容。 不要阅读 30 个文件来理解代码库。
观察新代理执行实际任务，您会发现它每次都做同样的事情。 读取`package.json`。 阅读`tsconfig.json`。 读取入口点。 读取 `src/` 中的每个文件。 二十步后，才开始考虑实际工作。

这就是“阅读所有内容，然后采取行动”的策略。 感觉很彻底。 它污染了环境，消耗了预算，并且在代理做任何有用的事情之前就失去了注意力。

解决办法很小：首先搜索，第二阅读，第三行动。 整个变化存在于系统提示和代理从中养成的习惯中。

### 结果

只要相关文件尚未命名，系统提示符的代理部分就会将代理引导至 `read` 之前的 `grep`。 多文件任务只需几个步骤即可解决，而不是几十个。

### 快速通道

1. 在 Agency 部分添加两行：阅读前搜索，不要“以防万一”阅读文件
2. 使用真实任务进行验证：代理应该 `grep` 来获取模式，然后 `read` 仅匹配
3. 确认直接文件问题仍直接转到 `read`

### 实践练习 9.2

通过提示引导代理进行 grep-first 探索。

**要求：**

1. 使用两个新项目符号更新 `buildSystemPrompt` 中的 `# Agency` 部分：
   - 阅读前先搜索一下。 首先使用 `grep`，然后仅使用 `read` 您要更改的内容
   - 不要“以防万一”读取文件。 当您需要时阅读您需要的内容
2. 运行提示中未命名相关文件的任务。 首先确认代理使用 `grep`
3. 运行命名特定文件的任务。 确认代理直接前往 `read`

**实施提示：**

- 更改发生在 `src/system.ts` 中，而不是在任何工具中。 工具没变
- 代理部分是行动政策的所在地。 这是行动政策
- 不要将其添加到 `grep` 上的工具描述中。 它属于代理的策略级别，而不是工具的级别

#### 提示添加

```ts title="src/system.ts (excerpt)"
sections.push(`

- USE your tools. Read files, search code, run commands, then answer.
- Do NOT explain what you WOULD do. Actually do it.
- Available tools: ${ctx.toolNames.join(", ")}
- Search before reading. Use grep first, then read only what you'll change.
- Don't read files "just in case." Read what you need when you need it.`);
```

两颗子弹。 这就是整个政策的变化。

#### 实践中的模式

“向身份验证路由添加速率限制”的天真（缓慢）流程：

```
read package.json
read tsconfig.json
read src/index.ts
read src/routes/index.ts
read src/routes/auth.ts
read src/routes/users.ts
read src/middleware/index.ts
... 20 more files
start implementing
```

grep-first（快速）在同一提示符下流动：

```
grep pattern: "router\.post.*auth|router\.get.*auth"
  -> matches src/routes/auth.ts
read src/routes/auth.ts
grep pattern: "rateLimit|rate-limit|middleware"
  -> matches src/middleware/rate-limit.ts
read src/middleware/rate-limit.ts
start implementing
```

五步而不是三十步。 现在，代理准确地掌握了执行操作所需的上下文，几乎没有其他任何信息。

#### 并行读取，当它们应用时

一旦 `grep` 缩小了文件列表的范围，读取就可以散开。 当工具调用彼此不依赖时，AI SDK 会并行运行工具调用：

```
Step 1: grep for the pattern (1 call)
Step 2: read auth.ts AND read rate-limit.ts (2 parallel calls)
Step 3: start implementing
```

不要强迫这个。 如果代理自行并行读取文件，那就太好了。 如果没有，搜索优先的习惯本身就是胜利。

**注意：快速模式需要 grep 才能锋利**

此策略仅与 `grep` 工具的结果一样好。 如果 `grep` 由于模式模糊而返回数百个匹配项，则代理最终会读取一半的代码库。 第 5 单元中的 50 场比赛上限在这里发挥了实际作用。 当模型看到上限生效时，会习惯性地写出更窄的形态。

### 尝试一下

运行没有特定文件的多文件任务：

```bash title="Terminal"
bun run index.ts . "Find every place this project parses JSON and tell me which ones might fail on malformed input"
```

您应该在任何 `read` 之前看到 `grep` 调用，并且 `read` 应该位于找到的文件 `grep` 上。

运行命名特定文件的任务：

```bash title="Terminal"
bun run index.ts . "What's in src/sandbox-local.ts?"
```

代理应直接前往 `read`。 不需要 `grep`。 该模式会根据文件是否已知进行调整。

```bash title="Terminal"
npx tsc --noEmit
```

### 犯罪

```bash
git add src/system.ts
git commit -m "feat(prompt): steer agent toward grep-first exploration"
```

### 完成时间

- [ ] 代理部分有两个新项目符号
- [ ] 多文件任务在 `read` 之前使用 `grep`
- [ ] 特定文件任务跳过 `grep` 并直接进入 `read`
- [ ] 探索任务的总步数显着下降
- [ ] `npx tsc --noEmit` 通行证

**注意：当 grep 不够用时**

有些模式很难 grep。 架构问题（“如何在应用程序中处理身份验证”）不会映射到单个正则表达式。 绘制一个 `survey` 工具，该工具接受高级问题并返回文件列表以及每个文件的单行角色。 这应该是模块 6 中具有更严格提示的资源管理器子代理吗？ 还是新工具？ 工具和子代理之间的界限在哪里？

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 32. 验证合同
原文标题：Verification Contract
原文链接：https://vercel.com/academy/build-ai-agent-harness/verification-contract
导读：门序列（类型检查、lint、测试、构建）。 代理证明其工作，而不是其声明。
您在模块 3 的提示中添加了验证部分。这就是开始。 这是完整版。

代理应该以合理的顺序运行项目实际拥有的门，并报告结果，以区分它引起的故障和已经存在的故障。 最后一部分比人们想象的更重要。 当三个测试已经失败时说“测试通过”的代理比当没有一个测试运行时说“所有测试通过”更有用，但只是稍微有用。 两人都在撒谎。 真实的版本是“三个已经存在的故障，我的更改没有引入任何新的故障”。

### 结果

代理从项目的 `package.json` （和 `AGENTS.md` 如果存在）中发现验证门，以已知的顺序运行它们，并报告将其故障与预先存在的故障区分开来的范围声明。

### 快速通道

1. 从 `package.json` 脚本发现可用的门
2. 按顺序运行它们：类型检查、lint、测试、构建
3. 报告准确的命令和输出
4. 区分“我导致了这次失败”和“这已经失败了”

### 实践练习 9.3

使用项目感知门序列和范围声明合同来扩展系统提示。

**要求：**

1. 在 `index.ts` （或助手）中，读取 `package.json` 脚本并构建可用验证命令的列表
2. 将列表传递到 `buildSystemPrompt` 作为新的上下文字段 `verificationCommands: string[]`
3. 更新 `# Verification` 部分以列出项目的实际门而不是通用列表
4. 添加明确的范围声明规则：将您的失败与预先存在的失败区分开来

**实施提示：**

- 检查 `scripts.typecheck`、`scripts["type-check"]`、`scripts.lint`、`scripts.test`、`scripts.build`。 不同的项目使用不同的名称
- 当没有 `typecheck` 脚本并且 TypeScript 处于依赖项时，回退到 `npx tsc --noEmit`
- 顺序很重要。 首先进行类型检查，因为它失败得最快。 最后构建，因为它是最慢的
- 范围声明规则对代理人诚实性影响最大。 明确说明

#### 从 package.json 发现门

```ts title="src/verification.ts"
import type { Sandbox } from "./sandbox";

export async function discoverGates(sandbox: Sandbox): Promise<string[]> {
  try {
    const raw = await sandbox.readFile("package.json");
    const pkg = JSON.parse(raw);
    const scripts = pkg.scripts ?? {};
    const gates: string[] = [];

    if (scripts.typecheck || scripts["type-check"]) {
      gates.push("npm run typecheck");
    } else if (pkg.devDependencies?.typescript || pkg.dependencies?.typescript) {
      gates.push("npx tsc --noEmit");
    }

    if (scripts.lint) gates.push("npm run lint");
    if (scripts.test) gates.push("npm test");
    if (scripts.build) gates.push("npm run build");

    return gates;
  } catch {
    return [];
  }
}
```

该函数返回代理可以实际运行的命令数组。 如果 `package.json` 丢失或不可读，则数组为空，并且代理不运行门。 这仍然比运行不存在的门要好。

#### 将其传递到提示符中

```ts title="src/system.ts (changes)"
export interface PromptContext {
  workingDirectory: string;
  sandboxType: string;
  toolNames: string[];
  gitBranch?: string;
  projectContext?: string;
  verificationCommands?: string[];
}

// In buildSystemPrompt, replace the existing Verification section:
const gates = ctx.verificationCommands?.length
  ? ctx.verificationCommands.map((c, i) => `${i + 1}. \`${c}\``).join("\n")
  : "(no verification commands discovered for this project)";

sections.push(`

After making changes, verify your work by running these gates in order:
${gates}

Run each gate, capture the output, and report what passed and what didn't.

Distinguish failures you caused from failures that were already there:
- "Ran tsc: passed."
- "Ran npm test: 47 passed, 3 failed. The 3 failures are pre-existing in user.test.ts and unrelated to my changes."

Do NOT claim "tests pass" without running them. Do NOT inflate partial
verification into a blanket success claim.`);
```

代理现在看到的是项目的实际入口，而不是通用的占位符列表。

#### 将其连接起来

```ts title="index.ts"
import { discoverGates } from "./src/verification";

const verificationCommands = await discoverGates(sandbox);

const agent = new ToolLoopAgent({
  // ...
  instructions: buildSystemPrompt({
    workingDirectory: cwd,
    sandboxType: sandbox.type,
    toolNames: Object.keys(tools),
    projectContext,
    verificationCommands,
  }),
});
```

对于具有 `tsc` 和测试但没有构建脚本的项目，代理现在知道它有两个门。 对于根本没有脚本的项目，代理知道验证是为了诚实地确定范围。

#### 并列的范围内的权利要求

| 代理人可能会说的话 | 你想要什么                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| “所有测试都通过了。”        | “运行 `npm test`：47 次通过，3 次失败。这些失败是预先存在于 `user.test.ts` 中的，与我的更改无关。” |
| “构建成功了。”       | “运行`npm run build`：4.2秒成功，没有警告。”                                                              |
| “看起来不错。”            | “Ran tsc：通过。Lint 未配置。测试套件通过（12 次测试）。”                                               |

左栏是提示未推回时模型的默认语音。 右栏是合同旨在生产的内容。

**注：最难的关卡是代理商的诚信**

您可以连接完美的门发现，并且代理在未运行测试时仍会说“所有测试都通过”。 保护的力量是系统提示部分，而不是发现代码。 花时间在措辞上。 “区分你造成的故障和已经存在的故障”是一句很有分量的句子。

### 尝试一下

做一个小改动并要求代理验证：

```bash title="Terminal"
bun run index.ts . "Rename the cwd variable in src/sandbox-local.ts to workingDir, then verify"
```

代理人应该：

1. 进行重命名
2. 按顺序运行发现的门
3. 使用特定命令和结果报告每个门的结果
4. 如果任何门失败，请区分失败是由重命名引起的还是已经存在

```bash title="Terminal"
npx tsc --noEmit
```

### 犯罪

```bash
git add src/verification.ts src/system.ts index.ts
git commit -m "feat(verify): discover project gates and require scoped claims"
```

### 完成时间

- [ ] `discoverGates` 返回当前项目存在的门
- [ ] 系统提示的验证部分列出了发现的门
- [ ] 代理按顺序运行门并报告准确的结果
- [ ] 代理将其故障与先前存在的故障区分开来
- [ ] 在没有脚本的项目上，代理报告验证受到限制
- [ ] `npx tsc --noEmit` 通行证

**注意：以正确的顺序快速失败**

现在，大门按固定顺序运行。 尝试对项目中的每一项进行基准测试。 类型检查可能需要三秒钟。 测试可能有三十个。 构建可能是九十。 按典型持续时间排序并首先运行最快的，以便更快地出现故障。 然后注意：有些门依赖于其他门。 如果 `tsc` 失败，构建就没有意义。 如何在不失去快速失败属性的情况下表达这一点？

### 解决方案

```ts title="src/verification.ts"
import type { Sandbox } from "./sandbox";

export async function discoverGates(sandbox: Sandbox): Promise<string[]> {
  try {
    const raw = await sandbox.readFile("package.json");
    const pkg = JSON.parse(raw);
    const scripts = pkg.scripts ?? {};
    const gates: string[] = [];

    if (scripts.typecheck || scripts["type-check"]) {
      gates.push("npm run typecheck");
    } else if (pkg.devDependencies?.typescript || pkg.dependencies?.typescript) {
      gates.push("npx tsc --noEmit");
    }

    if (scripts.lint) gates.push("npm run lint");
    if (scripts.test) gates.push("npm test");
    if (scripts.build) gates.push("npm run build");

    return gates;
  } catch {
    return [];
  }
}
```

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 33. CLI 入口点
原文标题：CLI Entry Point
原文链接：https://vercel.com/academy/build-ai-agent-harness/cli-entry-point
导读：解析参数、创建沙箱、初始化代理并彻底关闭。
从模块 1 开始，您就一直在运行 `bun run index.ts . "prompt"`。这是一个 CLI。 这只是一种不礼貌的行为。

位置论证做了太多的工作。 沙箱后端没有标志，因此您一直在玩弄 `process.env.SANDBOX`。 该模型被硬编码到代理中。 如果您在运行中按 Ctrl-C，沙箱不会完全关闭。 对于本地来说还好。 对于云沙箱来说，这意味着虚拟机在其他人的信用卡上运行。

本课正式确定了切入点。 通过 `parseArgs` 的参数。 通过读取标志的工厂进行沙箱。 通过带有默认值的标志进行建模。 通过始终运行 `sandbox.stop()` 的信号处理程序关闭。

### 结果

`index.ts` 解析 `--sandbox`、`--model`、位置工作目录和位置提示。 沙箱在正常退出和 SIGINT 时完全关闭。

### 快速通道

1. 将 `node:util` 中的 `parseArgs` 用于 `--sandbox` 和 `--model`
2. 通过小工厂从旗帜开始构建沙箱
3. 连接调用 `sandbox.stop()` 并退出的 `SIGINT` 处理程序
4. 代理运行后始终在 `finally` 中调用 `sandbox.stop()`

### 实践练习 10.1

将 ad-hoc CLI 替换为 `parseArgs` 并干净关闭。

**要求：**

1. 将 `node:util` 中的 `parseArgs` 与 `--sandbox`（默认 `local`）和 `--model`（默认 `anthropic/claude-haiku-4-5`）一起使用
2. 允许位置：第一个是 `cwd`，其余的加入到提示中
3. 通过 `sandboxFromFlag(name, cwd)` 助手从标志构建沙箱
4. 将代理运行包装在 `try/finally` 中，以便 `sandbox.stop()` 始终运行
5. 注册一个 `SIGINT` 处理程序来停止沙箱并以代码 0 退出

**实施提示：**

- `parseArgs` 位于 `node:util` 中。 设置 `allowPositionals: true` 来混合标志和位置
- `sandboxFromFlag` 是 `"local"` 和 `"just-bash"` 的单行切换
- `finally` 对于云沙箱比本地沙箱更重要，但无论如何您都需要相同的代码路径

#### 命令行界面

```ts title="index.ts"
import { parseArgs } from "node:util";
import { ToolLoopAgent, stepCountIs, pruneMessages } from "ai";
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { createLocalSandbox } from "./src/sandbox-local";
import { createJustBashSandbox } from "./src/sandbox-just-bash";
import { buildSystemPrompt } from "./src/system";
import {
  createReadTool,
  createGrepTool,
  createBashTool,
  createTaskTool,
  createAskUserTool,
  createTodoTool,
} from "./src/tools";
import { createApproval } from "./src/approval";
import { addCacheControl } from "./src/cache";
import { discoverGates } from "./src/verification";
import type { Sandbox } from "./src/sandbox";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    sandbox: { type: "string", default: "local" },
    model: { type: "string", default: "anthropic/claude-haiku-4-5" },
  },
  allowPositionals: true,
});

const cwd = resolve(positionals[0] || process.cwd());
const prompt = positionals.slice(1).join(" ") || "Hello!";

async function sandboxFromFlag(name: string, dir: string): Promise<Sandbox> {
  if (name === "just-bash") return createJustBashSandbox(dir);
  return createLocalSandbox(dir);
}

const sandbox = await sandboxFromFlag(values.sandbox!, cwd);
console.error(`Sandbox: ${sandbox.type}`);

const projectContext = existsSync(join(cwd, "AGENTS.md"))
  ? readFileSync(join(cwd, "AGENTS.md"), "utf-8")
  : undefined;

const verificationCommands = await discoverGates(sandbox);

const baseTools = {
  read: createReadTool(sandbox),
  grep: createGrepTool(sandbox),
  bash: createBashTool(sandbox, createApproval({ mode: "interactive" })),
};
const tools = {
  ...baseTools,
  task: createTaskTool(sandbox, { read: baseTools.read, grep: baseTools.grep }),
  askUser: createAskUserTool(),
  todo: createTodoTool(),
};

const agent = new ToolLoopAgent({
  model: values.model!,
  instructions: buildSystemPrompt({
    workingDirectory: cwd,
    sandboxType: sandbox.type,
    toolNames: Object.keys(tools),
    projectContext,
    verificationCommands,
  }),
  tools,
  stopWhen: stepCountIs(15),
  prepareCall: async (options) => {
    const pruned = options.messages
      ? pruneMessages({
          messages: options.messages,
          toolCalls: "before-last-3-messages",
        })
      : undefined;
    return {
      ...options,
      messages: pruned ? addCacheControl(pruned) : undefined,
    };
  },
  onStepFinish: ({ usage, stepNumber }) => {
    console.error(
      `Step ${stepNumber}: ${usage.inputTokens} input, ${usage.outputTokens} output`,
    );
  },
});

process.on("SIGINT", async () => {
  console.error("\nShutting down...");
  await sandbox.stop();
  process.exit(0);
});

try {
  const { text, steps } = await agent.generate({ prompt });
  console.log(text);
  console.log(`\n(${steps.length} steps)`);
} finally {
  await sandbox.stop();
}
```

这就是完整的文件。 其中大部分是前面九个模块已经编写的程序集。 CLI 更改包括：`parseArgs`、`sandboxFromFlag` 帮助程序、`SIGINT` 处理程序和 `try/finally`。

#### 为什么 `finally` 很重要

如果代理中途抛出，`finally` 仍然运行。 对于本地沙箱，您没有清理任何重要的内容。 对于云沙箱，您可以避免让虚拟机保持运行状态。 对于 `just-bash` 沙箱，您已经释放了一些内存。 相同的代码，不同的成本，所有这些都处理得很干净。

`SIGINT` 处理程序是重复的。 用户按 Ctrl-C 是一种路径。 未捕获的异常是另一条路。 `finally` 涵盖正常退出，处理程序涵盖显式中断。

**注意：CLI 是一个薄包装器**

该文件中几乎没有任何内容与 CLI 相关。 代理、工具、提示、沙箱：这些都是可重用的。 CLI 部分是五六行 `parseArgs` 和一个信号处理程序。 如果您构建不同的表面（Web 服务器、Slack 机器人、VS Code 扩展），唯一改变的代码就是那五六行。 他们下面的所有东西都保持原样。

### 尝试一下

使用新标志运行：

```bash title="Terminal"
bun run index.ts --sandbox=just-bash --model=anthropic/claude-haiku-4-5 . "Read the package.json"
```

您应该在 stderr 中看到 `Sandbox: just-bash`，然后在 stdout 中看到模型的响应，然后是步数。

通过在运行中发送 SIGINT 来测试干净关闭：

```bash title="Terminal"
bun run index.ts . "Run a long task"
```

按 Ctrl-C。 您应该看到“正在关闭...”并且干净退出，而不是挂起。

```bash title="Terminal"
npx tsc --noEmit
```

### 犯罪

```bash
git add index.ts
git commit -m "feat(cli): parseArgs and SIGINT-aware shutdown"
```

### 完成时间

- [ ] `parseArgs` 读取 `--sandbox` 和 `--model` 标志
- [ ] 位置提供 `cwd` 和提示
- [ ] `sandbox.stop()` 在正常退出时运行（通过 `finally`）
- [ ] `sandbox.stop()` 在 SIGINT 上运行（通过处理程序）
- [ ] `npx tsc --noEmit` 通行证

**注意：添​​加会话标志**

添加 `--session=<id>` 从磁盘加载先前运行的消息并将其重播为 `messages` 到 `agent.generate({ prompt, messages })`。 退出时，保存新消息。 现在您可以明天继续对话。 文件存放在哪里？ 文件损坏时会发生什么？ 您是否应该对其进行版本标记，以便旧会话在线束更改时不会中断？

### 解决方案

请参阅上面完整的 `index.ts`。

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 34. 流媒体和工具渲染
原文标题：Streaming and Tool Rendering
原文链接：https://vercel.com/academy/build-ai-agent-harness/streaming-and-tool-rendering
导读：将代理响应流式传输至终端。 渲染工具在触发时进行调用。
`agent.generate()` 会阻塞，直到整个响应完成。 一旦代理走了一两步，等待就会变得不舒服。 您盯着一个看起来冻结的终端，不知道它是在工作还是卡住了。

`agent.stream()` 是升级。 您可以在文本到达时获得文本增量，在工具触发时获得工具调用，在工具返回时获得工具结果。 用户看到运动。 您可以看到代理实际上在做什么。

本课程在 CLI 中将 `generate` 替换为 `stream` 并决定每个块的渲染方式。

### 结果

CLI 使用 `agent.stream()`。 文本增量实时写入标准输出。 工具调用及其结果呈现给 stderr，因此它们不会与代理的实际响应混合。

### 快速通道

1. 将 `agent.generate({ prompt })` 替换为 `agent.stream({ prompt })`
2. 迭代 `result.fullStream` 并打开 `chunk.type`
3. 将 `text-delta` 发送到 stdout，将 `tool-call` 和 `tool-result` 发送到 stderr

### 实践练习 10.2

切换到流式传输并适当地渲染块类型。

**要求：**

1. 将 `agent.generate(...)` 替换为 `agent.stream(...)`
2. 使用 `for await` 循环 `result.fullStream`
3. 在 `text-delta` 上，将增量写入标准输出（无换行符）
4. 在 `tool-call` 上，将工具名称和参数记录到 stderr
5. 在 `tool-result` 上，将截断的预览记录到 stderr

**实施提示：**

- `result.fullStream` 是一个异步可迭代对象。 `for await (const chunk of result.fullStream)` 是自然循环
- 工具结果可能很长。 切片为 100 个字符左右以供预览
- 不要将 `tool-result` 块渲染到标准输出。 他们是元的。 它们与响应一起出现，而不是在响应内部

#### 流循环

```ts title="index.ts (replacing the generate block)"
const result = await agent.stream({ prompt });

for await (const chunk of result.fullStream) {
  switch (chunk.type) {
    case "text-delta":
      process.stdout.write(chunk.textDelta);
      break;
    case "tool-call":
      console.error(
        `\n[tool] ${chunk.toolName}(${JSON.stringify(chunk.args)})`,
      );
      break;
    case "tool-result": {
      const preview =
        typeof chunk.result === "string"
          ? chunk.result.slice(0, 100)
          : JSON.stringify(chunk.result).slice(0, 100);
      console.error(`  -> ${preview}`);
      break;
    }
  }
}

console.log();
```

这就是整个变化。 代理、工具、沙箱和提示符保持不变。 CLI 的工作从“等待答案”转变为“渲染流”。

#### 这在实践中是什么样子的

与之前相同的提示，但有动作：

```
[tool] grep({"pattern":"TODO","glob":"*.ts"})
  -> src/auth.ts:42: // TODO: add rate limiting
  -> src/routes.ts:15: // TODO: validate input

Based on my search, there are 2 TODO comments left in this project...
```

工具调用会在模型决定执行时显示。 结果在工具返回时立即显示。 文本答案随着模型的写入而流入。 用户可以继续阅读而不是等待。

#### 每个工具的渲染选择

不同的工具需要不同的摘要。 这是一个起点：

| 工具      | 渲染为                           |
| --------- | ----------------------------------- |
| `read`    | 文件路径和行数            |
| `grep`    | 比赛次数和前三场比赛 |
| `bash`    | 命令和退出代码               |
| `write`   | 文件路径和字节数            |
| `edit`    | 文件路径和“1替换”       |
| `task`    | 子代理类型和步数        |
| `askUser` | 完整的问题和选项列表       |

将表格视为提示，而不是合同。 对于 CLI，上面简单的 `tool-call` 和 `tool-result` 开关已经涵盖了您所需的大部分内容。 当一个工具的输出始终存在噪音时，每个工具的格式化就会赢得一席之地。

**注意：当您进行流式传输时，内联批准会变得更加困难**

当命令未获批准时，模块 1 的 `bash` 返回块字符串。 这与 `generate` 配合得很好。 对于流式传输，您可能需要暂停流式传输，询问用户，然后恢复。 这是一个交互循环，而不是一个块处理程序。 完整的模式位于下一个模块（可扩展性和事件）中。 就目前而言，阻止和报告行为仍然是正确的。

### 尝试一下

多步骤运行任何内容并观察 CLI 的运行情况：

```bash title="Terminal"
bun run index.ts . "Find all TODO comments, then read the files that contain them"
```

您应该看到工具调用在发生时出现在 stderr 中，并且模型的最终响应逐个令牌流入 stdout 中。

为了进行比较，将 stderr 重定向并仅查看代理的文本响应：

```bash title="Terminal"
bun run index.ts . "Find all TODO comments, then read the files that contain them" 2>/dev/null
```

您会得到响应，没有任何工具噪音。 这就是 stdout/stderr 分割给你带来的东西。

```bash title="Terminal"
npx tsc --noEmit
```

### 犯罪

```bash
git add index.ts
git commit -m "feat(cli): stream agent output with chunk-level rendering"
```

### 完成时间

- [ ] `agent.stream({ prompt })` 替换 `agent.generate(...)`
- [ ] `for await` 迭代 `result.fullStream`
- [ ] `text-delta` 写入标准输出
- [ ] `tool-call` 和 `tool-result` 写入 stderr
- [ ] 重定向 stderr 仅在 stdout 中留下代理的响应
- [ ] `npx tsc --noEmit` 通行证

**注意：每个工具渲染**

将通用 `tool-call` 和 `tool-result` 日志记录替换为一个小的 `renderTool(chunk)` 函数，该函数打开 `chunk.toolName` 并为每个函数生成特定的摘要。 `read` 显示文件路径和行数。 `grep` 显示匹配计数和第一个匹配。 `bash` 显示命令和退出代码。 观察添加新工具时会发生什么。 保存每个工具格式定义的正确位置在哪里？

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 35. 网面
原文标题：Web Surface
原文链接：https://vercel.com/academy/build-ai-agent-harness/web-surface
导读：同一个代理提供网络聊天 UI。 持久性、可恢复流、工具结果作为组件。
代理无头。 CLI 是一个界面。 网络聊天用户界面是另一个。 有趣的是，代理代码在它们之间不会改变。 差异都在包装中。

本课是概念演练。 CLI 是工作演示； 网页表面是建筑草图。 重点是使分离足够明显，以便您可以在周五下午构建网络表面而无需接触代理。

### 结果

您可以描述 Web 表面如何重用无头代理、表面在顶部添加的内容（持久性、通过 HTTP 进行流式传输、工具结果组件）以及代理和表面之间的边界所在的位置。

### 并排的两个表面

|            | 命令行界面                    | 网络                          |
| ---------- | ---------------------- | ---------------------------- |
| 输出     | 终端文本          | 聊天气泡                 |
| 工具调用 | 标准错误行           | 工具结果组件       |
| 赞同   | 标准输入提示符           | 按钮组                 |
| 寿命   | 进程退出           | 会话保持          |
| 流媒体  | `process.stdout.write` | 服务器发送的事件           |
| 输入      | argv 的一枪     | 从文本区域连续 |

代理代码是同一列。 表面代码是其右侧的列。

### Web Surface 增加了什么

#### 坚持

当终端关闭时，CLI 会话就会终止。 网络会话不应该。 表面上继续对话：

```ts
await db.saveMessages(sessionId, messages);

const messages = await db.loadMessages(sessionId);
const result = await agent.stream({ prompt, messages });
```

代理不了解数据库。 它收到 `messages` （或没有）并继续。 表面决定是否加载和保存。

#### 通过 HTTP 进行流式传输

CLI 流式传输至 TTY。 网络表面流向浏览器。 服务器发送的事件是简单的机制：

```ts title="src/route.ts (sketch)"
export async function POST(req: Request) {
  const { prompt, sessionId } = await req.json();
  const messages = await loadMessages(sessionId);

  const stream = new ReadableStream({
    async start(controller) {
      const result = await agent.stream({ prompt, messages });
      for await (const chunk of result.fullStream) {
        controller.enqueue(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
}
```

CLI 使用相同的块形状，只是通过 HTTP 而不是 stdout。 客户端在每个块到达时对其进行渲染。

#### 作为组件的工具结果

CLI 将工具结果呈现为文本。 Web 表面可以将它们呈现为 React 组件：

| 工具      | CLI 渲染                 | 网页渲染                        |
| --------- | ----------------------------- | ------------------------------------ |
| `read`    | 文件路径和行数      | 带有语法高亮的代码块  |
| `grep`    | 比赛次数和首场比赛 | 带有文件链接的搜索结果       |
| `bash`    | 命令和退出代码         | 带有退出代码标志的终端输出 |
| `write`   | 路径和字节                | 差异视图                            |
| `edit`    | 路径和“1个替换”      | 内联差异                          |
| `askUser` | 问题正文                 | 带有选项的按钮组        |

代理发出相同的块。 表面选择如何显示它们。

#### 可恢复的流

用户在响应中关闭浏览器选项卡。 五分钟后他们重新打开它。 Web 表面可以从中断的位置恢复流（如果代理仍在运行）或拾取持久状态（如果不是）。 CLI 无法执行此操作，因为没有可返回的表面。

这是持久性和流媒体相遇的地方。 会话是工作单元。 该流是该会话的一个渲染。

**注意：代理不知道有网络**

任何 Web 表面代码都不会进入代理内部。 代理获取 `prompt` 和可选的 `messages`。 它返回一个块流。 其他一切（身份验证、持久性、布局、组件）都存在于表面。 如果您发现自己添加了“这是网络吗？” 分支到代理，那就是接缝滑落。 将特殊情况拉回表面。

### 构建过程中缺少什么

该模块的工作代码是 CLI。 课程存储库中没有网络界面。 这个决定是有意的。 构建一个可用的 Web 前端需要一个自己的（或多个）模块，并且教学点是关于分离，而不是关于 React。

如果您想尝试一下：从包装 `agent.stream()` 的 Next.js 路由开始，将块作为 SSE 进行管道传输，然后编写一个使用事件的小型客户端。 如果您在模块 1 到模块 9 中编写的代理代码在没有更改的情况下运行，您就会知道您的分离是干净的。

### 尝试一下

这是概念课。 检查一下自己：

1. 不回头，列出 CLI 和 Web 界面之间的变化
2. 绘制 Web 案例中单个用户提示的数据流。 持久性发生在哪里？ 流在哪里穿过网络？
3. 从你的安全带中选择一个工具。 写下 CLI 渲染，然后绘制用于 Web 渲染的 React 组件。 他们读取的是相同的块形状吗？

### 犯罪

本课中没有代码。 下一个模块（可扩展性）是基于事件的挂钩为工具结果组件和内联批准打开大门以干净地插入。

### 完成时间

- [ ] 您可以解释为什么代理代码在表面之间不会改变
- [ ] 您可以为 Web 表面绘制持久性、流式传输和组件渲染草图
- [ ] 您可以识别留在代理中的内容与移动到表面的内容

**注意：构建流式网络表面**

设置包装 `agent.stream({ prompt, messages })` 的 Next.js 路由。 将每个块作为服务器发送的事件进行管道传输。 在客户端上，使用 `EventSource` 或 `fetch` 加 `ReadableStream` 消费事件。 将 `text-delta` 块渲染到聊天气泡中。 使用工具名称将 `tool-call` 块渲染为微调器。 当 `tool-result` 到达时，用小结果卡替换旋转器。 添加一个取消按钮，用于中止流并存储部分结果。 有趣的部分是文本和工具调用之间的视觉转换，没有布局卡顿。 你如何处理？

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 36. 技能系统
原文标题：Skills System
原文链接：https://vercel.com/academy/build-ai-agent-harness/skills-system
导读：渐进式披露。 名称和描述始终在上下文中，完整内容按需加载。
为座席提供专业知识的简单方法是将其粘贴到系统提示中。 “这是我们的身份验证约定。这是我们的数据库模式。这是测试策略。这是部署说明。”

这适用于一两个包。 到了五点，系统提示符长度为一万五千个令牌，您每次调用都要为它们付费，并且代理正在翻阅它们，寻找适用于今天任务的一个项目符号。

技能通过渐进式披露起到同样的作用。 名称和一行描述永远存在于系统提示中（便宜）。 完整内容位于磁盘上的 markdown 文件中，仅在代理请求时加载（也很便宜，但仅在需要时加载）。

### 结果

`src/skills.ts` 从 `skills/<name>/SKILL.md` 文件中发现技能，在系统提示符中显示其名称和描述，并提供可按需返回完整内容的 `loadSkill` 工具。

### 快速通道

1. 创建一个 `skills/` 目录，其中包含一两个技能文件夹，每个文件夹包含 `SKILL.md`
2. 解析每个 `SKILL.md` 中的 frontmatter 以获取名称和描述
3. 将 `skills` 部分添加到系统提示符列表中，列出名称和描述
4. 添加返回完整降价的 `loadSkill(name)` 工具

### 实践练习 11.1

实现技能发现和按需加载。

**要求：**

1. 定义 `Skill` 形状（`name`、`description`、`path`）
2. 编写 `discoverSkills(dirs: string[])` 扫描 `<dir>/<name>/SKILL.md` 并解析 frontmatter
3. 按名称删除重复项。 第一个目录获胜，因此项目本地技能可以覆盖全局技能
4. 将 `# Skills` 部分添加到 `buildSystemPrompt` 中，列出每个技能的名称和一行描述
5. 添加一个 `loadSkill` 工具，该工具采用 `name` 并返回完整的 Markdown 内容

**实施提示：**

- Frontmatter 解析不需要库。 `---` 标记之间的两行切片足以满足 `name:` 和 `description:` 字段的需要
- 对加载的技能内容进行限制，以防止一项大型技能破坏上下文窗口（与模块 5 中的限制相同）
- 系统提示部分应该简短。 每个技能一行是正确的密度。 仅名称和描述

#### 技能形态

```ts title="src/skills.ts"
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface Skill {
  name: string;
  description: string;
  path: string;
}

function parseFrontmatter(md: string): { description?: string } {
  if (!md.startsWith("---")) return {};
  const end = md.indexOf("\n---", 3);
  if (end < 0) return {};
  const block = md.slice(3, end);
  const descLine = block.split("\n").find((l) => l.startsWith("description:"));
  return {
    description: descLine?.replace("description:", "").trim().replace(/^['"]|['"]$/g, ""),
  };
}

export function discoverSkills(dirs: string[]): Skill[] {
  const skills: Skill[] = [];
  const seen = new Set<string>();

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry, "SKILL.md");
      if (existsSync(path) && !seen.has(entry)) {
        seen.add(entry);
        const content = readFileSync(path, "utf-8");
        const { description } = parseFrontmatter(content);
        skills.push({
          name: entry,
          description: description ?? "(no description)",
          path,
        });
      }
    }
  }

  return skills;
}
```

`dirs` 是一个数组，因为真正的安全带会出现在多个位置。 项目本地技能（在工作目录中）优先。 全局技能（在用户的主目录中）填写其余部分。

#### 在提示中显示它们

```ts title="src/system.ts (additions)"
export interface PromptContext {
  // ...existing fields
  skills?: { name: string; description: string }[];
}

// Inside buildSystemPrompt, after Guardrails:
if (ctx.skills?.length) {
  const lines = ctx.skills
    .map((s) => `- ${s.name}: ${s.description}`)
    .join("\n");
  sections.push(`

The following skills are available. Call \`loadSkill\` with the name to get full content.
${lines}`);
}
```

客服人员在每次呼叫时都会看到技能名称和一行描述。 仅当代理决定加载时，完整内容才会进入上下文。

#### 加载工具

```ts title="src/tools.ts (additions)"
import { tool } from "ai";
import { z } from "zod";
import { readFileSync } from "node:fs";
import type { Skill } from "./skills";

export function createLoadSkillTool(skills: Skill[]) {
  const MAX_SKILL_CHARS = 4000;
  const byName = new Map(skills.map((s) => [s.name, s]));

  return tool({
    description: `Load the full content of a skill.
WHEN TO USE: the task touches a domain you have a skill for (auth, db, testing,
  deployment, etc.). Check the # Skills section in your instructions.
WHEN NOT TO USE: tasks unrelated to any available skill.
DO NOT USE FOR: tasks where the skill name is not in the listed skills.`,
    inputSchema: z.object({
      name: z.string().describe("Skill name as listed in the Skills section"),
    }),
    execute: async ({ name }) => {
      const skill = byName.get(name);
      if (!skill) return `Unknown skill: ${name}`;
      const content = readFileSync(skill.path, "utf-8");
      return content.length > MAX_SKILL_CHARS
        ? content.slice(0, MAX_SKILL_CHARS) + `\n... (truncated at ${MAX_SKILL_CHARS} chars)`
        : content;
    },
  });
}
```

帽子很重要。 增长到一万五千字的技能不应该在代理调用 `loadSkill` 时破坏上下文窗口。 截断消息让模型知道是否需要使用偏移量再次加载（此处未实现，但易于添加）。

#### 将其连接起来

```ts title="index.ts"
import { discoverSkills } from "./src/skills";

const skillDirs = [
  join(cwd, "skills"),
  join(process.env.HOME ?? "", ".harness", "skills"),
];
const skills = discoverSkills(skillDirs);

const tools = {
  // ...everything else
  loadSkill: createLoadSkillTool(skills),
};

const instructions = buildSystemPrompt({
  // ...existing context
  skills: skills.map((s) => ({ name: s.name, description: s.description })),
});
```

项目技能第一，全球第二。 提示中的名称和描述。 通过该工具按需加载内容。

#### 为什么要“名字进来，内容出去”

数字讲述故事。 五个技能，每个技能一千个字，每次召唤都会永远增加大约五千个代币。 五个技能一行描述总共一百个令牌。 模型仍然知道技能的存在。 代理根据任务决定加载哪些。 只有在有原因的情况下，完整的内容才会进入上下文。

这与模块 5 中的预防胜于清理原则相同，应用于知识层而不是工具输出层。

**注意：模型必须询问**

该模型不会自动加载技能。 系统提示符为它们命名，工具显示它们。 模型仍然必须决定调用 `loadSkill`。 将此视为检索路径，而不是保证。 观察你的会话：如果模型从未加载明显有帮助的技能，那么你的技能描述需要更尖锐的钩子。

### 尝试一下

将示例技能放入 `skills/auth-patterns/SKILL.md` 中：

```markdown title="skills/auth-patterns/SKILL.md"
---
description: Patterns and pitfalls for adding authentication to this project
---


This project uses NextAuth with JWT sessions. Key files:

- `lib/auth.ts`: NextAuth config
- `middleware.ts`: route protection
...
```

运行一个应该达到技能的任务：

```bash title="Terminal"
bun run index.ts . "Add OAuth login to this project. Check the auth-patterns skill first."
```

您应该看到代理使用 `name: "auth-patterns"` 调用 `loadSkill`，然后继续使用加载的内容。

运行不相关的任务并确认代理未加载任何内容：

```bash title="Terminal"
bun run index.ts . "What's the syntax for a TypeScript const assertion?"
```

无技能负载。 系统提示技能存在； 模型知道当它们不适用时就不会去接触它们。

```bash title="Terminal"
npx tsc --noEmit
```

### 犯罪

```bash
git add src/skills.ts src/tools.ts src/system.ts index.ts skills/
git commit -m "feat(skills): progressive-disclosure skill loading"
```

### 完成时间

- [ ] `discoverSkills` 扫描目录并解析 frontmatter
- [ ] 系统提示列出技能及其一行描述
- [ ] `loadSkill` 工具按需返回完整内容，有上限
- [ ] 当名称发生冲突时，项目本地技能会覆盖全局技能
- [ ] 命名技能的任务会触发 `loadSkill`； 不相关的任务不会
- [ ] `npx tsc --noEmit` 通行证

**注意：分段目标加载**

现在 `loadSkill` 返回整个文件。 对于五千字的技能来说，当代理只需要一个部分时，这是浪费。 使用可选的 `section: string` 参数扩展该工具，该参数仅返回请求的标题及其内容。 现在模型可以加载 `loadSkill({ name: "auth-patterns", section: "OAuth flow" })`。 您如何在“作为文档的技能”和“作为小型可搜索语料库的技能”之间划清界限？

### 解决方案

请参阅上面的完整代码块。 练习解决方案与应用于您的文件的代码相同。

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 37. 定制工具
原文标题：Custom Tools
原文链接：https://vercel.com/academy/build-ai-agent-harness/custom-tools
导读：无需分叉即可注册工具。 映射每个自定义表面并将工具视为注册工具，而不是内置工具。
您当前在 `index.ts` 中手动构建工具列表。 `read`、`grep`、`bash`、`task`、`askUser`、`todo`、`loadSkill`。 这对于课程为您提供的七个内容来说效果很好。 当有人想要添加自己的 `deploy` 工具，或者使用特定于项目的安全命令包装 `bash` 而不分叉线束时，它不起作用。

工具注册表就是接缝。 新工具通过它注册。 现有工具可以组合成新工具。 核心线束保持不变。

### 结果

`src/registry.ts` 公开了一个带有 `register`、`get`、`list` 和一个小的 `wrapTool` 帮助程序的工具注册表。 代理的工具集是从注册表构建的，而不是硬编码在 `index.ts` 中。

### 快速通道

1. 使用 `register(name, tool)`、`get(name)`、`list()` 定义 `ToolRegistry`
2. 将内置工具接线移至 `registerBuiltins(registry, sandbox)` 帮助程序中
3. 添加 `wrapTool(base, { beforeExecute, afterExecute })` 进行组合
4. 从 `registry.list()` 而不是内联对象构建代理的工具集

### 实践练习 11.2

构建注册表并将现有工具迁移到其中。

**要求：**

1. `src/registry.ts` 导出 `createRegistry()` 返回带有 `register`、`get`、`list` 和 `entries` 的对象
2. 内置工具通过`registerBuiltins(registry, sandbox)`注册。 与之前相同的设置
3. `wrapTool(base, hooks)` 返回一个新工具，该工具围绕 `base.execute` 运行 `beforeExecute` 和 `afterExecute`
4. 在 `index.ts` 中，代理的工具来自 `Object.fromEntries(registry.entries())` 而不是内联对象
5. 演示一种自定义注册（`deploy` 工具）以证明接缝有效

**实施提示：**

- 注册表是一个 `Map<string, Tool>` 加上三个或四个方法名称。 不要过度建造它
- `wrapTool` 是一个返回新工具的精简函数。 基本工具保持不变
- `entries()` 返回 `[name, tool][]` 使 `Object.fromEntries` 干净地工作

#### 注册表

```ts title="src/registry.ts"
import type { Tool } from "ai";

export interface ToolRegistry {
  register(name: string, tool: Tool): void;
  get(name: string): Tool | undefined;
  list(): string[];
  entries(): [string, Tool][];
}

export function createRegistry(): ToolRegistry {
  const tools = new Map<string, Tool>();
  return {
    register: (name, tool) => {
      tools.set(name, tool);
    },
    get: (name) => tools.get(name),
    list: () => [...tools.keys()],
    entries: () => [...tools.entries()],
  };
}
```

注册表不拥有任何策略。 这是一个带有类型化界面的地图。 谁调用 `register` 就决定什么进入。

#### 内置助手

```ts title="src/registry.ts (additions)"
import type { Sandbox } from "./sandbox";
import { createReadTool, createGrepTool, createBashTool, createTaskTool, createAskUserTool, createTodoTool, createLoadSkillTool } from "./tools";
import { createApproval } from "./approval";
import type { Skill } from "./skills";

export function registerBuiltins(
  registry: ToolRegistry,
  sandbox: Sandbox,
  skills: Skill[],
) {
  registry.register("read", createReadTool(sandbox));
  registry.register("grep", createGrepTool(sandbox));
  registry.register(
    "bash",
    createBashTool(sandbox, createApproval({ mode: "interactive" })),
  );
  registry.register(
    "task",
    createTaskTool(sandbox, {
      read: registry.get("read")!,
      grep: registry.get("grep")!,
    }),
  );
  registry.register("askUser", createAskUserTool());
  registry.register("todo", createTodoTool());
  registry.register("loadSkill", createLoadSkillTool(skills));
}
```

这里的顺序很重要。 `task` 需要 `read` 和 `grep` 已存在于注册表中，因为它会生成使用它们的子代理。 如果顺序错误，您将使用未定义的引用注册 `task` 。

#### 包装纸

```ts title="src/registry.ts (additions)"
import { tool, type Tool } from "ai";

interface WrapHooks {
  beforeExecute?: (input: any) => any | Promise<any>;
  afterExecute?: (result: any) => any | Promise<any>;
}

export function wrapTool(base: Tool, hooks: WrapHooks): Tool {
  return tool({
    description: base.description,
    inputSchema: base.inputSchema,
    execute: async (input) => {
      const transformed = hooks.beforeExecute ? await hooks.beforeExecute(input) : input;
      const result = await base.execute(transformed);
      return hooks.afterExecute ? await hooks.afterExecute(result) : result;
    },
  });
}
```

`beforeExecute` 可以重写输入。 `afterExecute` 可以对输出进行后处理。 两者都是可选的。 基本工具保持不变，因此项目可以包装内置工具，而不会破坏该内置工具的其他使用者。

#### 将其连接到 CLI

```ts title="index.ts (changes)"
import { createRegistry, registerBuiltins } from "./src/registry";

const registry = createRegistry();
registerBuiltins(registry, sandbox, skills);

registry.register("deploy", tool({
  description: `Deploy the project to a target environment.
WHEN TO USE: pushing changes to staging or production.
WHEN NOT TO USE: testing changes (use bash with the test runner instead).`,
  inputSchema: z.object({
    environment: z.enum(["staging", "production"]),
  }),
  execute: async ({ environment }) => {
    const { stdout } = await sandbox.exec(`vercel deploy --${environment}`);
    return stdout;
  },
}));

const agent = new ToolLoopAgent({
  // ...
  tools: Object.fromEntries(registry.entries()),
  instructions: buildSystemPrompt({
    // ...
    toolNames: registry.list(),
  }),
});
```

代理的 `tools` 字段现在源自注册表。 添加新工具是在代理构建之前的某个地方进行一次 `registry.register(...)` 调用。 移除工具只需一行。

#### 为项目包装 bash

这就是 `wrapTool` 赢得一席之地的原因：

```ts title="index.ts (sketch)"
const baseBash = registry.get("bash")!;
registry.register("bash", wrapTool(baseBash, {
  beforeExecute: (input) => {
    if (input.command.startsWith("bun test")) {
      return { ...input, command: input.command + " --reporter=spec" };
    }
    return input;
  },
}));
```

基础 `bash` 仍在内存中； 注册表现在拥有一个包装版本，添加了特定于项目的调整。 特工永远不会看到未包装的包裹。 线束核心从未改变。

**注：扩展面表**

| 表面       | 您可以定制什么    | 如何                                      |
| ------------- | ------------------------- | ---------------------------------------- |
| 工具         | 添加、删除、包裹         | 注册表加上 `wrapTool`                 |
| 技能        | 添加专业知识 | `skills/` 目录加上 `loadSkill`     |
| 沙盒       | 自定义后端           | `createSandbox` 工厂                  |
| 赞同      | 定制政策           | 配置加事件（下一课）         |
| 系统提示 | 自定义部分           | `PromptContext` 加 `buildSystemPrompt` |
| 模型         | 每个角色模型           | 子代理定义                     |

每一行都映射到您已经编写的代码。 注册表是第一行的入口点。 其余的也是扩展表面，每个表面都有自己的约定。

### 尝试一下

添加一个特定于项目的小型工具来确认接缝：

```ts title="index.ts (after registerBuiltins)"
registry.register("now", tool({
  description: "Return the current timestamp",
  inputSchema: z.object({}),
  execute: async () => new Date().toISOString(),
}));
```

运行一个使用它的任务：

```bash title="Terminal"
bun run index.ts . "What's the current timestamp? Use the now tool."
```

代理应调用 `now` 并返回时间戳。 删除 `register` 行，运行相同的提示，代理应报告 `now` 不存在。

```bash title="Terminal"
npx tsc --noEmit
```

### 犯罪

```bash
git add src/registry.ts index.ts
git commit -m "feat(registry): tool registry with wrapTool composition"
```

### 完成时间

- [ ] `createRegistry` 返回工作注册表
- [ ] `registerBuiltins` 连接七个内置工具
- [ ] `wrapTool` 围绕基本工具组成钩子
- [ ] 代理的 `tools` 字段是根据 `registry.entries()` 构建的
- [ ] 在 `registerBuiltins` 之后注册的自定义工具可由代理调用
- [ ] `npx tsc --noEmit` 通行证

**注意：替换，不要换行**

包裹工具可保持底座不变。 更换一个即可将其完全删除。 添加 `registry.unregister(name)` 和一个模式，项目可以将内置 `bash` 交换为具有较小安全前缀列表的项目特定版本。 在引导程序顺序中需要在哪里进行替换？ 如果代理构建后发生替换，会出现什么问题？

### 解决方案

请参阅上面的完整代码块。

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)

---

## 38. 扩展点
原文标题：Extension Points
原文链接：https://vercel.com/academy/build-ai-agent-harness/extension-points
导读：可扩展行为的生命周期事件。 订阅、屏蔽、修改、通过。
上一课的注册表处理“存在哪些工具”。 它不处理“工具调用周围发生的事情”。 记录每个通话。 阻止写入特定文件。 将命令包装在操作系统级沙箱中。 关闭时自动提交。 这些是跨领域的问题，不属于任何单一工具。

事件是正确的原语。 线束发出生命周期事件。 扩展订阅。 每个订阅者都可以在线束继续之前传递、阻止或修改事件。 多个订阅者链。

本课是建筑草图。 将事件总线构建到工作线束中很简单，但价值来自于在连接合同之前了解合同。

### 结果

您可以描述触发关键生命周期事件的事件总线、可以阻止或修改的处理程序以及使多处理程序链可预测的顺序规则。

### 事件面

```ts title="src/events.ts (sketch)"
type LifecycleEvent =
  | "session_start"
  | "tool_call"
  | "tool_result"
  | "session_before_compact"
  | "session_shutdown";

type EventResult = { block?: boolean; reason?: string; modify?: any } | void;

interface EventBus {
  on(event: LifecycleEvent, handler: (data: any) => Promise<EventResult>): void;
  emit(event: LifecycleEvent, data: any): Promise<EventResult[]>;
}
```

事件本身故意做得很小。 五个名称涵盖了通常需要插入扩展的时刻。稍后添加更多名称也可以； 以五开头是为了使合同清晰易读。

### 四个例子

一旦你看到扩展实际上用它做什么，它的形状就会变得显而易见。

#### 记录每个工具调用

```ts title="src/extensions/logging.ts"
bus.on("tool_call", async ({ toolName, input }) => {
  console.error(`[${new Date().toISOString()}] ${toolName}: ${JSON.stringify(input)}`);
});
```

无返回值。 处理程序通过。 线束继续进行呼叫。

#### 阻止写入受保护的文件

```ts title="src/extensions/protect-files.ts"
const PROTECTED = [".env", "package-lock.json"];

bus.on("tool_call", async ({ toolName, input }) => {
  if (toolName === "write" && PROTECTED.some((p) => input.path.endsWith(p))) {
    return { block: true, reason: `${input.path} is protected by policy.` };
  }
});
```

处理程序返回 `block: true`。 线束停止调用并将原因作为工具结果反馈给模型。 该模型以纯文本形式查看策略并将其报告给用户。

#### 压实前注入安全提示

```ts title="src/extensions/compact-safety.ts"
bus.on("session_before_compact", async () => {
  return {
    modify: {
      customInstructions:
        "Preserve all safety constraints and approval rules across compaction.",
    },
  };
});
```

处理程序返回 `modify`。 线束在继续之前应用修改（在本例中为额外的指令行）。 压缩是指令可能泄漏的时刻； 这是防止泄漏的一种方法。

#### 关闭时自动提交

```ts title="src/extensions/auto-commit.ts"
bus.on("session_shutdown", async ({ sandbox }) => {
  const { stdout } = await sandbox.exec("git status --porcelain");
  if (stdout.trim()) {
    await sandbox.exec(`git add -A && git commit -m "WIP: auto-save"`);
  }
});
```

这是模块 4 中的云沙箱 `beforeStop` 挂钩，已概括。 任何结束的会话，无论出于何种原因，都有机会检查其工作。

### 链接规则

多个处理程序可以订阅同一事件。 它们按照注册顺序运行。 如果任何处理程序返回 `block: true`，则调用将停止，原因将返回到模型。 如果有任何返回 `modify`，后续处理程序将看到修改后的数据。

```
Tool call requested
  -> emit "tool_call"
       handler 1: log (pass through)
       handler 2: check protected files (may block)
       handler 3: project safety policy (may block)
  -> if any blocked: return reason to model, do not execute
  -> if all passed: execute tool
  -> emit "tool_result"
       handler 1: log result
       handler 2: telemetry
```

顺序很重要。 即使呼叫被阻止，安全检查之前的记录也会捕获呼叫尝试。 结果后的遥测捕获实际运行的内容。 顺序正确，链条就会产生有用的痕迹。 弄错了，你就记录了一半的故事。

### 事件如何与您已经构建的内容相结合

这些部分开始以一种很好的方式重叠：

- 模块 2 中的审批配置设置操作模式（交互、后台、委派）。 它仍然运行在工具级别
- 事件总线围绕工具层运行。 即使批准已通过，`tool_call` 处理程序也可能会阻塞
- 模块 4 中的生命周期挂钩（`afterStart`、`beforeStop`）与 `session_start` 和 `session_shutdown` 重叠。 处理程序签名更通用； 生命周期钩子是最常见情况的方便名称
- 11.1 中的技能系统是一个单独的检索界面。 它不会经历事件，因为模型决定是否加载技能，而不是线束

该工具最终是分层的：工具在底部，事件围绕工具，生命周期挂钩在会话边界，技能作为发现的知识，注册表作为一切的入口点。 每一层都有自己的工作。

**注意：为什么这是最后一课**

事件总线是最灵活的扩展面，也是最危险的一种。 错误的处理程序可能会使代理陷入僵局，通过日志记录泄露秘密，或阻止合法的工具调用。 最后构建它（在工具、沙箱、提示、上下文、子代理和生命周期挂钩之后）意味着您在插入之前了解要插入的内容。

如果您较早进行连接，那么很可能会使用事件挂钩来处理所有问题。 首先学习其他层的纪律可以阻止线束变成一个巨大的 `on('tool_call', ...)` 处理程序。

### 尝试一下

这是概念课。 检查一下自己：

1. 不回头，说出五个生命周期事件
2. 对于每个扩展，描述一个可以订阅的实际扩展
3. 跟踪当 `tool_call` 上的两个处理程序都返回 `block: true` 时会发生什么。 谁的理由获胜？
4. 解释事件总线如何与模块 2 中的批准配置相关。它们在哪里重叠，哪里不重叠？

如果您想真正构建它，则实现很小：一个 `Map<string, Handler[]>` 和一个 `emit` 按顺序运行处理程序，并在块上提前退出。 在工具执行之前和工具结果之后将其插入代理循环。 模块 4 的生命周期挂钩成为前两个订阅者。

### 犯罪

除非您连接总线，否则本课程中没有代码。 如果这样做，请将其提交到单独的分支上，并在添加任何阻塞分支之前使用日志记录扩展来执行它。

### 完成时间

- [ ] 您可以命名五个生命周期事件
- [ ] 可以描述传递、阻塞和修改返回值
- [ ] 您可以跟踪多处理程序链并预测结果
- [ ] 您可以解释总线如何补充（而不是取代）批准配置

**注意：构建遥测扩展**

订阅 `tool_call`、`tool_result` 和每步事件。 记录时间戳、持续时间和令牌计数。 在事件发生时将其附加到 JSONL 文件，这样崩溃就不会丢失跟踪。 在会话结束时，生成一屏报告：总时间、工具调用计数、最慢的工具、总令牌。 现在，使用不同的系统提示运行相同的任务两次，并比较遥测数据。 哪个提示产生的工具调用较少？ 减少浪费？ 这就是您无需猜测即可对代理行为进行 A/B 测试的方法。

---

[Full course index](/academy/llms.txt) · [Sitemap](/academy/sitemap.md)
