# calc-mcp-worker

中文 | [English](#english)

## 中文

一个运行在 Cloudflare Worker 上的数学计算 MCP 服务。**25 个工具**，**零依赖**，**无需 API Key**。

适合做：表达式求值、微积分、方程求解、矩阵运算、统计分析、概率分布、回归、相关性、单位换算、绘图数据生成。

### 特点

- 单次可批量计算最多 100 个表达式
- 支持常数、复数、矩阵、后缀阶乘 `!`
- `ln(x)` 是自然对数，`log(x)` / `log10(x)` 是常用对数（底 10）
- 对奇异矩阵、非有限值、缺失参数优先返回明确错误
- `calc_simplify` 是数值求值工具，不是符号 CAS
- `calc_limit` 是数值极限分类，不是符号极限求解器

### 表达式语法

```text
2+3*4              -> 14
5!/(3!*2!)         -> 10
sin(pi/6)          -> 0.5
ln(e)              -> 1
log(e)             -> 0.4342944819
sqrt(2)            -> 1.414213562
abs(-5+3i)         -> 5.830951895
e^(i*pi)+1         -> 0
2pi                -> 6.283185307
[[1,2],[3,4]]      -> matrix literal
```

### 工具总览（每个工具 1 个例子）

#### 1) `calc_batch`
批量计算多个表达式。

```json
{
  "expressions": ["2+3*4", "5!/(3!*2!)", "ln(e)"]
}
```

示例结果：返回 `14`、`10`、`1`。

#### 2) `calc_single`
计算单个表达式。

```json
{
  "expression": "sin(pi/6)+sqrt(9)"
}
```

示例结果：`3.5`

#### 3) `calc_derivative`
在指定点计算数值导数。

```json
{
  "expression": "x^3",
  "point": 2
}
```

示例结果：约 `11.99999994`

#### 4) `calc_integral`
用 Simpson's rule 计算定积分。

```json
{
  "expression": "x^2",
  "a": 0,
  "b": 1
}
```

示例结果：约 `0.3333333333`

#### 5) `calc_double_integral`
计算矩形区域上的二重积分。

```json
{
  "expression": "x+y",
  "xa": 0,
  "xb": 1,
  "ya": 0,
  "yb": 1
}
```

示例结果：`1`

#### 6) `calc_solve`
求解 `f(x)=0`，支持 Newton / bisection。

```json
{
  "expression": "x^2-2",
  "method": "bisection",
  "a": 1,
  "b": 2
}
```

示例结果：根约 `1.4142135623733338`

#### 7) `calc_series`
计算级数部分和。

```json
{
  "expression": "1/n^2",
  "n_start": 1,
  "n_end": 5
}
```

示例结果：和约 `1.4636111111111112`

#### 8) `calc_limit`
做数值极限分类。

```json
{
  "expression": "1/x",
  "approach": 0,
  "direction": "right"
}
```

示例结果：右极限分类为 `infinite`，值为 `Infinity`

#### 9) `calc_taylor`
计算 Taylor 展开系数。

```json
{
  "expression": "exp(x)",
  "x0": 0,
  "order": 4
}
```

示例结果：返回 0 到 4 阶系数和多项式字符串。

#### 10) `calc_ode`
解常微分方程 `dy/dx = f(x,y)`。

```json
{
  "expression": "x+y",
  "x0": 0,
  "y0": 1,
  "x_end": 1,
  "steps": 5,
  "method": "rk4"
}
```

示例结果：返回一组 `(x, y)` 数值点。

#### 11) `calc_matrix`
矩阵运算：`det`、`inv`、`transpose`、`trace`、`eigen`、`add`、`sub`、`mul`。

```json
{
  "operation": "inv",
  "matrix": "[[4,7],[2,6]]"
}
```

示例结果：

```json
[["0.6", "-0.7"], ["-0.2", "0.4"]]
```

#### 12) `calc_simplify`
数值化简 / 代入求值，不做自由符号代数展开。

```json
{
  "expression": "2*x+3",
  "substitutions": { "x": 4 }
}
```

示例结果：`11`

#### 13) `calc_constants`
列出或搜索内置常数。

```json
{
  "query": "hbar"
}
```

示例结果：返回 `hbar = 1.054571817e-34`

#### 14) `calc_convert`
单位换算。

```json
{
  "value": 100,
  "from": "C",
  "to": "F"
}
```

示例结果：`212`

#### 15) `calc_stats`
对一组数据做统计分析。

```json
{
  "data": [1, 2, 2, 3, 4]
}
```

示例结果：返回 mean、median、mode、stdev、variance、quartiles 等。

#### 16) `calc_base_convert`
进制转换，支持 2 到 36 进制。

```json
{
  "value": "255",
  "from_base": 10,
  "to_base": 16
}
```

示例结果：`FF`

#### 17) `calc_prime`
质数相关操作。

```json
{
  "operation": "factorize",
  "n": 84
}
```

示例结果：`[2, 2, 3, 7]`

#### 18) `calc_plot_data`
生成绘图点数据。

```json
{
  "expression": "x^2",
  "x_min": -2,
  "x_max": 2,
  "points": 5
}
```

示例结果：`x=[-2,-1,0,1,2]`，`y=[4,1,0,1,4]`

#### 19) `calc_least_squares`
最小二乘回归。

```json
{
  "x": [1, 2, 3, 4],
  "y": [2, 4.1, 5.9, 8.2],
  "degree": 1
}
```

示例结果：返回 slope、intercept、`r_squared`、residuals。

#### 20) `calc_probability`
概率分布工具：normal、binomial、poisson、exponential、uniform、chi2、t。

```json
{
  "distribution": "normal",
  "operation": "cdf",
  "params": { "x": 1.96, "mean": 0, "std": 1 }
}
```

示例结果：`cdf ≈ 0.9750021738917761`

#### 21) `calc_hypothesis_test`
假设检验：z-test、单样本 t-test、双样本 t-test、卡方拟合优度检验。

```json
{
  "test": "z_test",
  "params": {
    "sample_mean": 5.2,
    "mu0": 5,
    "sigma": 1.5,
    "n": 36
  }
}
```

示例结果：返回统计量、p 值、是否显著、结论。

#### 22) `calc_confidence_interval`
置信区间：均值、比例、方差。

```json
{
  "type": "mean_t",
  "data": [10, 12, 9, 11, 13],
  "confidence": 0.95
}
```

示例结果：下界约 `8.3253`，上界约 `13.6747`

#### 23) `calc_anova`
单因素方差分析。

```json
{
  "groups": [[4, 5, 6], [5, 6, 7], [8, 9, 10]]
}
```

示例结果：返回 `F_statistic`、`p_value`、显著性结论。

#### 24) `calc_correlation`
相关性 / 协方差分析。

```json
{
  "x": [1, 2, 3, 4],
  "y": [2, 4, 6, 8],
  "method": "pearson"
}
```

示例结果：`r ≈ 1`

#### 25) `health`
健康检查。

```json
{}
```

示例结果：

```json
{
  "status": "ok",
  "version": "1.0.0",
  "tools": 25
}
```

### 行为说明

- 支持后缀阶乘 `!`，但只接受非负整数。
- `calc_batch` 和 `calc_single` 都会拒绝 `NaN` / `Infinity` 结果。
- `calc_matrix` 遇到奇异矩阵会报错，不会返回假的 `Infinity`。
- `calc_probability` 和 `calc_hypothesis_test` 对缺失参数会显式报错。
- `calc_simplify` 不支持真正的符号 `expand/factor`。
- `calc_limit` 会返回左/右侧分类信息，如 `finite`、`infinite`、`unstable`。

### 本地开发

```bash
npm install
npm test
npx wrangler dev --local --port 8791
```

### 部署

```bash
npx wrangler deploy
```

---

## English

A math-focused MCP server running on Cloudflare Workers. **25 tools**, **zero dependencies**, **no API keys**.

Good for expression evaluation, calculus, equation solving, matrix operations, statistics, probability, regression, correlation, unit conversion, and plotting data generation.

### Highlights

- Batch-evaluate up to 100 expressions in one call
- Supports constants, complex numbers, matrices, and postfix factorial `!`
- `ln(x)` is natural log; `log(x)` / `log10(x)` are base-10
- Returns explicit errors for singular matrices, non-finite results, and missing required params
- `calc_simplify` is a numeric evaluator, not a symbolic CAS
- `calc_limit` is a numerical limit classifier, not a symbolic limit solver

### Expression syntax

```text
2+3*4              -> 14
5!/(3!*2!)         -> 10
sin(pi/6)          -> 0.5
ln(e)              -> 1
log(e)             -> 0.4342944819
sqrt(2)            -> 1.414213562
abs(-5+3i)         -> 5.830951895
e^(i*pi)+1         -> 0
2pi                -> 6.283185307
[[1,2],[3,4]]      -> matrix literal
```

### Tool reference with one example each

#### 1) `calc_batch`
Evaluate multiple expressions in one request.

```json
{
  "expressions": ["2+3*4", "5!/(3!*2!)", "ln(e)"]
}
```

Example result: `14`, `10`, `1`

#### 2) `calc_single`
Evaluate one expression.

```json
{
  "expression": "sin(pi/6)+sqrt(9)"
}
```

Example result: `3.5`

#### 3) `calc_derivative`
Numerical derivative at a point.

```json
{
  "expression": "x^3",
  "point": 2
}
```

Example result: about `11.99999994`

#### 4) `calc_integral`
Definite integral using Simpson's rule.

```json
{
  "expression": "x^2",
  "a": 0,
  "b": 1
}
```

Example result: about `0.3333333333`

#### 5) `calc_double_integral`
Double integral over a rectangular region.

```json
{
  "expression": "x+y",
  "xa": 0,
  "xb": 1,
  "ya": 0,
  "yb": 1
}
```

Example result: `1`

#### 6) `calc_solve`
Solve `f(x)=0` with Newton or bisection.

```json
{
  "expression": "x^2-2",
  "method": "bisection",
  "a": 1,
  "b": 2
}
```

Example result: root about `1.4142135623733338`

#### 7) `calc_series`
Compute a finite series sum.

```json
{
  "expression": "1/n^2",
  "n_start": 1,
  "n_end": 5
}
```

Example result: about `1.4636111111111112`

#### 8) `calc_limit`
Numerically classify a limit.

```json
{
  "expression": "1/x",
  "approach": 0,
  "direction": "right"
}
```

Example result: right-hand classification `infinite`, value `Infinity`

#### 9) `calc_taylor`
Compute Taylor coefficients around `x0`.

```json
{
  "expression": "exp(x)",
  "x0": 0,
  "order": 4
}
```

Example result: returns coefficients and a polynomial string.

#### 10) `calc_ode`
Solve `dy/dx = f(x,y)` with Euler or RK4.

```json
{
  "expression": "x+y",
  "x0": 0,
  "y0": 1,
  "x_end": 1,
  "steps": 5,
  "method": "rk4"
}
```

Example result: returns sampled `(x, y)` points.

#### 11) `calc_matrix`
Matrix operations: `det`, `inv`, `transpose`, `trace`, `eigen`, `add`, `sub`, `mul`.

```json
{
  "operation": "inv",
  "matrix": "[[4,7],[2,6]]"
}
```

Example result:

```json
[["0.6", "-0.7"], ["-0.2", "0.4"]]
```

#### 12) `calc_simplify`
Numeric simplification / substitution-based evaluation.

```json
{
  "expression": "2*x+3",
  "substitutions": { "x": 4 }
}
```

Example result: `11`

#### 13) `calc_constants`
List or search built-in constants.

```json
{
  "query": "hbar"
}
```

Example result: `hbar = 1.054571817e-34`

#### 14) `calc_convert`
Unit conversion.

```json
{
  "value": 100,
  "from": "C",
  "to": "F"
}
```

Example result: `212`

#### 15) `calc_stats`
Descriptive statistics for a dataset.

```json
{
  "data": [1, 2, 2, 3, 4]
}
```

Example result: returns mean, median, mode, stdev, variance, quartiles, and more.

#### 16) `calc_base_convert`
Convert numbers between bases 2 through 36.

```json
{
  "value": "255",
  "from_base": 10,
  "to_base": 16
}
```

Example result: `FF`

#### 17) `calc_prime`
Prime number utilities.

```json
{
  "operation": "factorize",
  "n": 84
}
```

Example result: `[2, 2, 3, 7]`

#### 18) `calc_plot_data`
Generate `x` / `y` arrays for plotting.

```json
{
  "expression": "x^2",
  "x_min": -2,
  "x_max": 2,
  "points": 5
}
```

Example result: `x=[-2,-1,0,1,2]`, `y=[4,1,0,1,4]`

#### 19) `calc_least_squares`
Least-squares regression.

```json
{
  "x": [1, 2, 3, 4],
  "y": [2, 4.1, 5.9, 8.2],
  "degree": 1
}
```

Example result: returns slope, intercept, `r_squared`, and residuals.

#### 20) `calc_probability`
Probability distribution helper for normal, binomial, poisson, exponential, uniform, chi-square, and t.

```json
{
  "distribution": "normal",
  "operation": "cdf",
  "params": { "x": 1.96, "mean": 0, "std": 1 }
}
```

Example result: `cdf ≈ 0.9750021738917761`

#### 21) `calc_hypothesis_test`
Hypothesis testing utilities.

```json
{
  "test": "z_test",
  "params": {
    "sample_mean": 5.2,
    "mu0": 5,
    "sigma": 1.5,
    "n": 36
  }
}
```

Example result: returns the test statistic, p-value, significance flag, and conclusion.

#### 22) `calc_confidence_interval`
Confidence intervals for means, proportions, and variance.

```json
{
  "type": "mean_t",
  "data": [10, 12, 9, 11, 13],
  "confidence": 0.95
}
```

Example result: lower bound about `8.3253`, upper bound about `13.6747`

#### 23) `calc_anova`
One-way ANOVA.

```json
{
  "groups": [[4, 5, 6], [5, 6, 7], [8, 9, 10]]
}
```

Example result: returns `F_statistic`, `p_value`, and significance conclusion.

#### 24) `calc_correlation`
Correlation / covariance analysis.

```json
{
  "x": [1, 2, 3, 4],
  "y": [2, 4, 6, 8],
  "method": "pearson"
}
```

Example result: `r ≈ 1`

#### 25) `health`
Service health check.

```json
{}
```

Example result:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "tools": 25
}
```

### Behavior notes

- Postfix factorial `!` is supported for non-negative integers only.
- Both `calc_batch` and `calc_single` reject `NaN` / `Infinity` outputs.
- `calc_matrix` throws a real error for singular matrices instead of returning fake `Infinity` values.
- `calc_probability` and `calc_hypothesis_test` explicitly validate required parameters.
- `calc_simplify` does not provide true symbolic `expand` / `factor` behavior.
- `calc_limit` includes directional classifications such as `finite`, `infinite`, and `unstable`.

### Local development

```bash
npm install
npm test
npx wrangler dev --local --port 8791
```

### Deploy

```bash
npx wrangler deploy
```

## License

MIT
