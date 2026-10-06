# calc-mcp-worker

[![CI](https://github.com/Kerry1020/calc-mcp-worker/actions/workflows/ci.yml/badge.svg)](https://github.com/Kerry1020/calc-mcp-worker/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![MCP](https://img.shields.io/badge/MCP-Streamable%20HTTP-6E56CF)](https://modelcontextprotocol.io)

[English](README.md) | 简体中文

一个运行在 Cloudflare Workers 上的数学计算 [MCP](https://modelcontextprotocol.io) 服务。

## 功能特性

- 共 **25 个工具**，**零运行时依赖**，**无需 API Key**。
- 用途：表达式求值、微积分、方程求解、矩阵运算、描述统计、概率分布、假设检验、回归、相关性、单位换算、数论、绘图数据。
- 表达式由手写的词法分析器和解析器处理，用户输入绝不会进入 `eval` / `Function`。
- 所有输入都会校验，所有循环和内存分配都有上限（见[资源限制](#资源限制)）。
- 特殊函数（erf、gamma、不完全 gamma/beta、t/χ²/F 分布）精度约为 1e-14。
- Taylor 系数由自动微分计算，精确到机器精度。

## 快速开始

```bash
git clone https://github.com/Kerry1020/calc-mcp-worker.git
cd calc-mcp-worker
npx wrangler deploy
claude mcp add --transport http calc https://calc-mcp-worker.<your-subdomain>.workers.dev/mcp
```

不需要配置任何 secret 或绑定。部署后就可以让 Agent 试试“求 x^2 在 0 到 1 上的积分”。

## 接口与传输

服务使用 HTTP `POST` 上的 JSON-RPC 2.0，即 MCP Streamable HTTP，只返回 JSON 响应。

| 请求 | 响应 |
| --- | --- |
| `POST`（任意路径），JSON-RPC 请求或批量请求 | `200`，JSON-RPC 响应 |
| `POST`，仅包含通知或客户端响应 | `202`，空 body |
| `POST`，JSON 格式错误 | `400`，JSON-RPC 错误 `-32700` |
| `POST`，JSON-RPC 消息不合法 | `400`，JSON-RPC 错误 `-32600` |
| `POST`，body 超过 1 MiB | `413` |
| `GET`（浏览器 / JSON） | `200`，服务信息 `{name, version, tools, mcp}` |
| `GET` 且 `Accept: text/event-stream` | `405`（不提供 SSE 流） |
| `OPTIONS` | `204`，CORS 预检 |
| 其他方法 | `405` |

支持的协议版本为 `2025-06-18`、`2025-03-26`、`2024-11-05`。客户端请求其中之一时原样返回，否则返回最新版本。

支持的方法：`initialize`、`ping`、`tools/list`、`tools/call`。通知会被接收，但不会回复。

### 错误处理

- **工具执行失败**会作为普通工具结果返回，并带 `isError: true`，例如奇异矩阵、参数非法、结果非有限值。文本内容为 `{"error": "..."}`，模型可以读到错误信息并重试。
- **协议错误**使用 JSON-RPC 错误码：
  - `-32700` 解析错误
  - `-32600` 无效请求
  - `-32601` 未知方法
  - `-32602` 未知工具或 `tools/call` 参数错误
  - `-32603` 内部错误

## 表达式语法

```text
2+3*4              -> 14
5!/(3!*2!)         -> 10
sin(pi/6)          -> 0.5
ln(e)              -> 1
log(e)             -> 0.4342944819      （log 为常用对数，底 10）
log(8, 2)          -> 3                 （指定底数）
sqrt(2)            -> 1.414213562
abs(-5+3i)         -> 5.830951895
e^(i*pi)+1         -> 0
2pi                -> 6.283185307
2x^2  (x=3)        -> 18                （隐式乘法优先级低于 ^）
1/2pi              -> 0.1591549431      （= 1/(2*pi)：隐式乘法优先级高于 * 和 /）
[[1,2],[3,4]]      -> 矩阵字面量；[1,2;3,4] 等价
h                  -> 6.62607015e-34
```

- **运算符：** `+ - * / % ^`（`**` 等同于 `^`）、后缀阶乘 `!`，以及绝对值 `|x|`。
- **优先级：** `+ -` < `* / %` < 隐式乘法 < `^` < `!`。一元负号在 `^` 之后作用，所以 `-x^2 = -(x^2)`。
- **函数：**
  - 三角函数：`sin cos tan sec csc cot asin acos atan atan2`
  - 双曲函数：`sinh cosh tanh asinh acosh atanh`
  - 根、幂与对数：`sqrt cbrt exp ln log log2 log10 pow`
  - 取整与符号：`abs ceil floor round sign`
  - 最值：`max min`
  - 特殊函数与整数函数：`factorial gamma erf mod gcd lcm binom rad deg`
  - 统计函数：`mean median stdev variance`。可传入数字或数组，例如 `mean(1,2,3)`、`mean([1,2,3])`。
  - 复数函数：`re im conj arg csin ccos ctan csqrt cexp cln`
- **常数：** 完整列表见 `calc_constants`。包括数学常数（如 `pi`、`e`、`phi`、`euler_gamma`）、物理常数（CODATA 2018，如 `c`、`h`、`hbar`、`k`、`G`、`Na`、`R`）、天文常数和单位换算系数。`i` 是虚数单位。
- **非法输入：** 未知字符、括号不匹配、多余的尾随符号都会报错，不会被静默忽略。

## 工具一览

| # | 工具 | 用途 | 示例参数 | 示例结果 |
| --- | --- | --- | --- | --- |
| 1 | `calc_batch` | 一次最多计算 100 个表达式 | `{"expressions": ["2+3*4", "5!/(3!*2!)", "ln(e)"]}` | `14`、`10`、`1` |
| 2 | `calc_single` | 计算单个表达式 | `{"expression": "sin(pi/6)+sqrt(9)"}` | `3.5` |
| 3 | `calc_derivative` | 数值导数（Richardson 外推） | `{"expression": "x^3", "point": 2}` | `12` |
| 4 | `calc_integral` | 定积分（复合 Simpson） | `{"expression": "x^2", "a": 0, "b": 1}` | `0.3333333333` |
| 5 | `calc_double_integral` | 矩形区域二重积分 | `{"expression": "x+y", "xa": 0, "xb": 1, "ya": 0, "yb": 1}` | `1` |
| 6 | `calc_solve` | 求 f(x)=0 的根（Newton / 二分法） | `{"expression": "x^2-2", "method": "bisection", "a": 1, "b": 2}` | 根 `1.41421356237…` |
| 7 | `calc_series` | 有限级数求和（补偿求和） | `{"expression": "1/n^2", "n_start": 1, "n_end": 5}` | `1.4636111111111112` |
| 8 | `calc_limit` | 数值极限分类 | `{"expression": "sin(x)/x", "approach": 0}` | 极限 `1` |
| 9 | `calc_taylor` | Taylor 系数（自动微分） | `{"expression": "exp(x)", "order": 4}` | `[1, 1, 0.5, 0.1666…, 0.04166…]` |
| 10 | `calc_ode` | 解 dy/dx = f(x,y)（Euler / RK4） | `{"expression": "x+y", "x0": 0, "y0": 1, "x_end": 1, "steps": 5}` | y(1) ≈ `3.4365` |
| 11 | `calc_matrix` | det、inv、transpose、trace、eigen、add、sub、mul | `{"operation": "inv", "matrix": "[[4,7],[2,6]]"}` | `[["0.6","-0.7"],["-0.2","0.4"]]` |
| 12 | `calc_simplify` | 代入求值（非符号 CAS） | `{"expression": "2*x+3", "substitutions": {"x": 4}}` | `11` |
| 13 | `calc_constants` | 列出 / 搜索常数 | `{"query": "hbar"}` | `1.054571817e-34` |
| 14 | `calc_convert` | 同量纲单位换算 | `{"value": 100, "from": "C", "to": "F"}` | `212` |
| 15 | `calc_stats` | 描述统计 | `{"data": [1, 2, 2, 3, 4]}` | mean `2.4`、q1 `2`、q3 `3` 等 |
| 16 | `calc_base_convert` | 2–36 进制整数转换（任意大小） | `{"value": "255", "to_base": 16}` | `FF` |
| 17 | `calc_prime` | 判素、分解、第 n 个素数、区间素数、素数计数、前/后一个素数 | `{"operation": "factorize", "n": 84}` | `[2, 2, 3, 7]` |
| 18 | `calc_plot_data` | 生成绘图用 x/y 数组 | `{"expression": "x^2", "x_min": -2, "x_max": 2, "points": 5}` | `y=[4,1,0,1,4]` |
| 19 | `calc_least_squares` | 线性 / 多项式（≤ 10 次）最小二乘 | `{"x": [1,2,3,4], "y": [2,4.1,5.9,8.2]}` | 斜率 `2.04`，R² `0.99799` |
| 20 | `calc_probability` | normal、binomial、poisson、exponential、uniform、chi2、t | `{"distribution": "normal", "operation": "cdf", "params": {"x": 1.96}}` | `0.9750021048517795` |
| 21 | `calc_hypothesis_test` | z 检验、单样本 t、Welch 双样本 t、χ² 拟合优度 | `{"test": "z_test", "params": {"sample_mean": 5.2, "mu0": 5, "sigma": 1.5, "n": 36}}` | p `0.4237` |
| 22 | `calc_confidence_interval` | 均值（z / t）、比例、方差的置信区间 | `{"type": "mean_t", "data": [10,12,9,11,13]}` | `[9.0368, 12.9632]` |
| 23 | `calc_anova` | 单因素方差分析（F 分布 p 值） | `{"groups": [[4,5,6],[5,6,7],[8,9,10]]}` | F `13`，p `0.00659` |
| 24 | `calc_correlation` | Pearson（含 p 值）、Spearman、Kendall τ-b、协方差 | `{"x": [1,2,3,4], "y": [2,4,6,8]}` | r `1` |
| 25 | `health` | 健康检查 | `{}` | `{"status": "ok", "version": "1.1.0", "tools": 25}` |

以下工具接受可选参数 `variables`（变量名到数值的对象）：

- `calc_batch`、`calc_single`
- `calc_derivative`、`calc_integral`、`calc_double_integral`
- `calc_solve`、`calc_series`、`calc_limit`、`calc_taylor`
- `calc_ode`、`calc_plot_data`

### 各工具说明

- **`precision`**（`calc_batch`、`calc_single`）表示**有效数字位数**，取值 1–17，默认 10。
- **`calc_probability`：**
  - 所有分布都支持 `pdf` 和 `cdf`。
  - normal、exponential、uniform、chi2、t 支持 `quantile`。
  - normal 和 poisson 支持 `sample`，最多 10,000 个样本。
  - 不存在的矩（例如 df = 1 时 t 分布的均值）返回 `null`。
- **`calc_hypothesis_test`：** 均为双侧检验。t 检验使用精确的 Student t 分布，双样本检验为 Welch 检验。
- **`calc_confidence_interval`：** 可传 `data`，也可传汇总统计量（`sample_mean`、`sample_std`、`n`）。
- **`calc_stats`：**
  - 四分位数使用线性插值（与 NumPy 默认方式和 Excel `QUARTILE.INC` 一致）。
  - 偏度和超额峰度使用总体矩。数据全部相同时返回 `null`。
- **`calc_convert`：**
  - 支持的量纲：长度、质量、压强、能量、功率、频率、速度、体积、时间、温度（`C`/`F`/`K`）。
  - 单位名区分大小写；大小写不敏感匹配唯一时自动采用（`kwh` → `kWh`）。
  - 跨量纲换算会报错。
  - `nm` 表示**海里**（为兼容旧版本保留）。如需明确，请用 `nmi`。
- **`calc_matrix`：**
  - `eigen` 用幂迭代求主特征值（|λ| 最大者），并返回 `converged` 标志。
  - 主特征值为复数或模相同时不收敛。
  - 矩阵可以写成表达式字符串，也可以直接传 JSON 数组。
- **`calc_taylor`：**
  - 支持初等函数、幂、`abs`、取整函数、`atan2`、`erf`，以及双参数的 `max`/`min`。
  - 自变量依赖 x 的 `gamma`、`factorial` 和统计函数会报错。
- **`calc_limit` 和 `calc_simplify`** 是数值工具，不做符号运算。

## 资源限制

以下上限用于防止不可信输入导致 CPU 或内存无限占用。

| 限制项 | 上限 |
| --- | --- |
| HTTP 请求 body | 1 MiB |
| JSON-RPC 批量请求 | 50 条消息 |
| 表达式长度 / 嵌套深度 | 20,000 字符 / 1,000 层 |
| `calc_batch` 表达式数量 | 100 |
| 数值工具计算预算 | 每次调用 5·10⁷ 次表达式节点求值 |
| 积分剖分数 | 一维 10⁶，二维每轴 2,000 |
| 级数项数 / ODE 步数 / 绘图点数 | 10⁶ / 10⁵ / 10⁴ |
| 求根迭代次数 | 10,000 |
| Taylor 阶数 | 50 |
| 数据数组 | 100,000 个值（Kendall：5,000） |
| 矩阵大小 | 100 × 100 |
| `nth_prime` / `prime_count` / `primes_in_range` 区间宽度 | 10⁶ / 10⁷ / 10⁵ |
| `calc_prime` 整数范围 | 安全整数（≤ 2⁵³ − 1） |

## 配置

无需任何配置。Worker 不读取环境变量、secret 或绑定。`wrangler.toml` 里只有 Worker 名称、入口文件、`compatibility_date`、`workers_dev = true` 和 observability 设置。

## MCP 客户端配置

Worker 在任意路径上都响应 MCP 请求，习惯上使用 `/mcp`。

**Claude Code：**

```bash
claude mcp add --transport http calc https://calc-mcp-worker.<your-subdomain>.workers.dev/mcp
```

**支持远程 HTTP 的客户端**可以直接连接：

```json
{
  "mcpServers": {
    "calc": { "url": "https://calc-mcp-worker.<your-subdomain>.workers.dev/mcp" }
  }
}
```

**Claude Desktop / 只支持 stdio 的客户端**可以通过 [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) 桥接：

```json
{
  "mcpServers": {
    "calc": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://calc-mcp-worker.<your-subdomain>.workers.dev/mcp"]
    }
  }
}
```

## 安全说明

- 没有内置鉴权：所有接口都是公开的，CORS 允许任意来源。Worker 本身无状态、不保存任何密钥、也不发起外部请求，所以主要风险是别人消耗你的 Workers CPU 额度。
- 如需访问控制，可以放在 [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/) 之后，或在 `src/index.js` 中加一段 Bearer Token 校验（Token 用 `npx wrangler secret put AUTH_TOKEN` 保存）。
- 所有不可信输入都有上限，见[资源限制](#资源限制)。

## 目录结构

```text
src/index.js              Worker 入口：HTTP、CORS、body 大小限制
src/protocol.js           JSON-RPC / MCP 消息处理
src/tools/definitions.js  工具名称与输入 schema（tools/list）
src/tools/index.js        工具分发
src/tools/*.js            按领域划分的工具实现（表达式、微积分、矩阵、单位、素数、统计、概率）
src/lib/expression.js     词法分析、解析器、求值器、内置函数
src/lib/special.js        特殊函数与概率分布
src/lib/numeric.js        数值微积分
src/lib/taylor.js         Taylor 模式自动微分
src/lib/matrix.js         矩阵算法
src/lib/validate.js       输入校验与资源限制
test/*.test.js            node:test 测试
```

## 本地开发

需要 Node.js 20 或更新版本，没有需要安装的运行时依赖。

```bash
npm test                          # 运行测试（node:test）
npx wrangler dev                  # 本地开发服务器 http://localhost:8787
```

对本地服务做冒烟测试：

```bash
curl -s localhost:8787/mcp -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"calc_single","arguments":{"expression":"2x^2","variables":{"x":3}}}}'
```

CI（GitHub Actions）会在推送到 `main` 和每个 Pull Request 时，用 Node 20 和 22 运行测试。

## 部署

```bash
npx wrangler login
npx wrangler deploy
```

部署后地址为 `https://calc-mcp-worker.<your-subdomain>.workers.dev`。`npm run deploy` 执行的是同一条命令。公开部署前请先看[安全说明](#安全说明)。

## 兼容性说明（1.1.0）

工具名称、顺序和输入 schema 均未改变，schema 只新增了可选字段。由于旧行为有误，以下输出有变化：

- **工具错误：** 现在以 `isError` 工具结果返回，不再是 JSON-RPC 错误 `-32000`。
- **隐式乘法：** `2x^2` 现在表示 `2*(x^2)`，旧版为 `(2x)^2`。
- **非法输入：**
  - 尾随符号、未知字符、括号不匹配现在会报错，旧版会被静默忽略。
  - `2e` 现在表示 `2*e`，旧版为 `2`。
- **极小值：** 小于 1e-15 的非零值不再显示为 `0`。
- **`precision`：** 统一表示有效数字位数，包括科学计数法输出。
- **统计：**
  - t 检验、χ² 拟合优度、ANOVA、Pearson 的 p 值现在是正确的。旧版使用正态近似或临时公式。
  - 四分位数、偏度、峰度，以及有并列值时的 Spearman 和 Kendall，现在都采用标准定义。
- **`calc_convert`：**
  - 输出使用规范单位名。
  - 量纲不一致时报错。
- **`calc_limit`：** 非有限的采样值现在以字符串（如 `"NaN"`、`"Infinity"`）返回，旧版为 `null`。

## 相关项目

- [time-mcp-worker](https://github.com/Kerry1020/time-mcp-worker) — 时区查询、时间换算与时间差计算
- [geo-mcp-worker](https://github.com/Kerry1020/geo-mcp-worker) — 基于 OpenStreetMap 服务的地理编码、POI 搜索和路线规划
- [memory-mcp-worker](https://github.com/Kerry1020/memory-mcp-worker) — 基于 KV 的 Agent 持久化记忆
- [webhook-inbox-mcp-worker](https://github.com/Kerry1020/webhook-inbox-mcp-worker) — 把 Webhook 收进 KV，再通过 MCP 工具读取
- [summarize-mcp-worker](https://github.com/Kerry1020/summarize-mcp-worker) — 网页正文提取与抽取式摘要
- [image-mcp-worker](https://github.com/Kerry1020/image-mcp-worker) — 对接任意 OpenAI 兼容图像接口的图片生成
- [search-mcp-worker](https://github.com/Kerry1020/search-mcp-worker) — 多引擎网页搜索，排序规则公开可审计

## 许可证

[GNU 通用公共许可证 v3.0](LICENSE)（GPL-3.0-only）。
