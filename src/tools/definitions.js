// MCP tool definitions (order is significant: it is the order returned by tools/list).
export const TOOLS = [
  {
    name: "calc_batch",
    description: "Batch evaluate multiple math expressions in parallel. Supports arithmetic, functions, constants, complex numbers, matrices. Returns all results at once.",
    inputSchema: {
      type: "object",
      properties: {
        expressions: {
          type: "array",
          items: { type: "string" },
          description: "Array of math expressions to evaluate (up to 100)"
        },
        precision: { type: "number", description: "Decimal places for output, default 10" },
        variables: { type: "object", description: "Variable assignments: {\"x\": 3, \"y\": 5}" }
      },
      required: ["expressions"]
    }
  },
  {
    name: "calc_single",
    description: "Evaluate a single math expression. Supports: arithmetic, trig, log, exp, factorial, gamma, erf, complex numbers (use 'i'), matrices ([a,b;c,d]), all constants.",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "Math expression" },
        variables: { type: "object", description: "Variable assignments" },
        precision: { type: "number", description: "Decimal places, default 10" }
      },
      required: ["expression"]
    }
  },
  {
    name: "calc_derivative",
    description: "Numerical derivative d/dx of an expression at a point. Returns derivative value.",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "Function f(x), e.g. 'sin(x)*exp(x)'" },
        point: { type: "number", description: "x value to evaluate at" },
        variables: { type: "object" }
      },
      required: ["expression", "point"]
    }
  },
  {
    name: "calc_integral",
    description: "Numerical definite integral ∫f(x)dx from a to b using Simpson's rule. High accuracy.",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "Integrand f(x)" },
        a: { type: "number", description: "Lower bound" },
        b: { type: "number", description: "Upper bound" },
        n: { type: "number", description: "Subdivisions, default 10000" },
        variables: { type: "object" }
      },
      required: ["expression", "a", "b"]
    }
  },
  {
    name: "calc_double_integral",
    description: "Numerical double integral ∬f(x,y)dxdy over a rectangular region.",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "Integrand f(x,y)" },
        xa: { type: "number" }, xb: { type: "number" },
        ya: { type: "number" }, yb: { type: "number" },
        n: { type: "number", description: "Subdivisions per axis, default 50" }
      },
      required: ["expression", "xa", "xb", "ya", "yb"]
    }
  },
  {
    name: "calc_solve",
    description: "Solve f(x)=0 using Newton's method. Returns root, iterations, and convergence info.",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "f(x) = 0, e.g. 'x^3 - 2*x - 5'" },
        initial_guess: { type: "number", description: "Starting x value" },
        method: { type: "string", enum: ["newton", "bisection"], description: "Solver method, default newton" },
        tol: { type: "number", description: "Tolerance, default 1e-12" },
        max_iter: { type: "number", description: "Max iterations, default 100" },
        a: { type: "number", description: "For bisection: lower bound" },
        b: { type: "number", description: "For bisection: upper bound" }
      },
      required: ["expression"]
    }
  },
  {
    name: "calc_series",
    description: "Sum a series ∑f(n) from n_start to n_end. Returns sum and partial sums.",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "General term, e.g. '1/n^2'" },
        n_start: { type: "number", description: "Start index, default 1" },
        n_end: { type: "number", description: "End index" },
        variable: { type: "string", description: "Index variable name, default n" }
      },
      required: ["expression", "n_end"]
    }
  },
  {
    name: "calc_limit",
    description: "Compute numerical limit of f(x) as x approaches a value.",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "f(x)" },
        approach: { type: "number", description: "Value x approaches" },
        direction: { type: "string", enum: ["both", "left", "right"], description: "Direction, default both" }
      },
      required: ["expression", "approach"]
    }
  },
  {
    name: "calc_taylor",
    description: "Compute Taylor series expansion of f(x) around x0 to given order.",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "f(x)" },
        x0: { type: "number", description: "Center point, default 0" },
        order: { type: "number", description: "Order of expansion, default 5" }
      },
      required: ["expression"]
    }
  },
  {
    name: "calc_ode",
    description: "Solve ODE dy/dx = f(x,y) with initial condition. Euler or RK4 method.",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "dy/dx = f(x,y), e.g. '-x*y'" },
        x0: { type: "number", description: "Initial x" },
        y0: { type: "number", description: "Initial y" },
        x_end: { type: "number", description: "End x" },
        steps: { type: "number", description: "Number of steps, default 100" },
        method: { type: "string", enum: ["euler", "rk4"], description: "Method, default rk4" }
      },
      required: ["expression", "x0", "y0", "x_end"]
    }
  },
  {
    name: "calc_matrix",
    description: "Matrix operations: add, sub, mul, det, inv, transpose, trace, eigen. Input as [[a,b],[c,d]].",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["det", "inv", "transpose", "trace", "eigen", "add", "sub", "mul"], description: "Operation" },
        matrix: { type: "string", description: "Matrix A as expression, e.g. [[1,2],[3,4]]" },
        matrix_b: { type: "string", description: "Matrix B (for add/sub/mul)" }
      },
      required: ["operation", "matrix"]
    }
  },
  {
    name: "calc_simplify",
    description: "Numeric simplification/evaluation with substitutions. Not a symbolic CAS.",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "Expression to simplify" },
        operation: { type: "string", enum: ["evaluate", "expand", "substitute"], description: "Default evaluate. expand/substitute return an unsupported-operation error for free-symbol algebra." },
        substitutions: { type: "object", description: "Variable substitutions" }
      },
      required: ["expression"]
    }
  },
  {
    name: "calc_constants",
    description: "List all available constants or search for specific ones. Returns name, value, and category.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search filter (optional). Returns all if omitted." }
      }
    }
  },
  {
    name: "calc_convert",
    description: "Unit conversion between common units. Supports length, mass, pressure, energy, temperature.",
    inputSchema: {
      type: "object",
      properties: {
        value: { type: "number", description: "Value to convert" },
        from: { type: "string", description: "Source unit" },
        to: { type: "string", description: "Target unit" }
      },
      required: ["value", "from", "to"]
    }
  },
  {
    name: "calc_stats",
    description: "Statistical analysis of a dataset: mean, median, mode, stdev, variance, min, max, quartiles, skewness, kurtosis.",
    inputSchema: {
      type: "object",
      properties: {
        data: { type: "array", items: { type: "number" }, description: "Dataset" }
      },
      required: ["data"]
    }
  },
  {
    name: "calc_base_convert",
    description: "Convert numbers between bases: binary, octal, decimal, hexadecimal, and arbitrary bases.",
    inputSchema: {
      type: "object",
      properties: {
        value: { type: "string", description: "Number to convert" },
        from_base: { type: "number", description: "Source base (2-36), default 10" },
        to_base: { type: "number", description: "Target base (2-36), default 10" }
      },
      required: ["value"]
    }
  },
  {
    name: "calc_prime",
    description: "Prime number operations: test if prime, factorize, nth prime, primes in range, prime counting function.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["is_prime", "factorize", "nth_prime", "primes_in_range", "prime_count", "next_prime", "prev_prime"], description: "Operation" },
        n: { type: "number", description: "Input number" },
        b: { type: "number", description: "Upper bound for range operations" }
      },
      required: ["operation", "n"]
    }
  },
  {
    name: "calc_plot_data",
    description: "Generate x,y data points for plotting a function. Returns arrays suitable for charting.",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "f(x) to plot" },
        x_min: { type: "number", description: "X range start" },
        x_max: { type: "number", description: "X range end" },
        points: { type: "number", description: "Number of points, default 100" },
        variables: { type: "object" }
      },
      required: ["expression", "x_min", "x_max"]
    }
  },
  {
    name: "calc_least_squares",
    description: "Linear least squares regression y=ax+b. Returns slope, intercept, R², residuals.",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "array", items: { type: "number" }, description: "X data points" },
        y: { type: "array", items: { type: "number" }, description: "Y data points" },
        degree: { type: "number", description: "Polynomial degree: 1=linear, 2=quadratic, etc. Default 1." }
      },
      required: ["x", "y"]
    }
  },
  {
    name: "calc_probability",
    description: "Probability distributions: normal CDF/PDF, binomial, poisson, uniform, exponential, chi-square, t-distribution.",
    inputSchema: {
      type: "object",
      properties: {
        distribution: { type: "string", enum: ["normal", "binomial", "poisson", "exponential", "uniform", "chi2", "t"], description: "Distribution type" },
        operation: { type: "string", enum: ["pdf", "cdf", "quantile", "mean", "variance", "sample"], description: "Operation" },
        params: { type: "object", description: "Distribution parameters" }
      },
      required: ["distribution", "operation"]
    }
  },
  {
    name: "calc_hypothesis_test",
    description: "Hypothesis testing: z-test, t-test (one-sample, two-sample), chi-square goodness of fit.",
    inputSchema: {
      type: "object",
      properties: {
        test: { type: "string", enum: ["z_test", "t_test_one_sample", "t_test_two_sample", "chi2_gof"], description: "Test type" },
        params: { type: "object", description: "Test parameters" }
      },
      required: ["test", "params"]
    }
  },
  {
    name: "calc_confidence_interval",
    description: "Confidence intervals for mean (z or t), proportion, and variance.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["mean_z", "mean_t", "proportion", "variance"], description: "CI type" },
        data: { type: "array", items: { type: "number" }, description: "Sample data (for mean_z, mean_t, variance)" },
        confidence: { type: "number", description: "Confidence level 0-1, default 0.95" },
        sample_mean: { type: "number", description: "For proportion/variance" },
        sample_std: { type: "number" },
        n: { type: "number", description: "Sample size" },
        p: { type: "number", description: "Proportion (for proportion CI)" },
        sigma: { type: "number", description: "Known population std (for mean_z)" }
      },
      required: ["type"]
    }
  },
  {
    name: "calc_anova",
    description: "One-way ANOVA: test if means of multiple groups are equal. Returns F-statistic, p-value, SS between/within.",
    inputSchema: {
      type: "object",
      properties: {
        groups: { type: "array", items: { type: "array", items: { type: "number" } }, description: "Array of groups" }
      },
      required: ["groups"]
    }
  },
  {
    name: "calc_correlation",
    description: "Correlation and regression: Pearson r, Spearman rho, covariance, Kendall tau.",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "array", items: { type: "number" } },
        y: { type: "array", items: { type: "number" } },
        method: { type: "string", enum: ["pearson", "spearman", "covariance", "kendall"], description: "Default pearson" }
      },
      required: ["x", "y"]
    }
  },
  {
    name: "health",
    description: "Health check.",
    inputSchema: { type: "object", properties: {} }
  }
];
