---
name: clean-functions
description: Use when writing, fixing, editing, or refactoring functions in any programming language. Enforces Clean Code principles—maximum 3 arguments, single responsibility, no flag parameters.
---

# Clean Functions

## When to Use

Use this skill when writing, fixing, editing, or refactoring functions in any programming language.

Also trigger on: functions (or React components) with 4+ parameters/props, boolean flag parameters like `isTest`, functions that mutate their parameters (e.g. push to an input array), unused exports or dead helper functions, or asks like "too many props", "split this function", "is this still used".

## Instructions

### F1: Too Many Arguments (Maximum 3)

```text
# Bad - too many parameters
function createUser(name, email, age, country, timezone, language, newsletter):
  ...

# Good - use a data object
type UserData = fields: name, email, age, country, timezone, language, newsletter

function createUser(data: UserData):
  ...
```

More than 3 arguments means your function is doing too much or needs
a data structure.

### F2: No Output Arguments

Don't modify arguments as side effects. Return values instead.

```text
type Report = fields: content

# Bad - modifies argument
function appendFooter(report):
  report.content = report.content + footer

# Good - returns new value
function withFooter(report): Returns
  report copy with content = report.content + footer
```

### F3: No Flag Arguments

Boolean flags mean your function does at least two things.

```text
# Bad - function does two different things
function render(isTest):
  if isTest:
    renderTestPage()
  else:
    renderProductionPage()

# Good - split into two functions
function renderTestPage(): ...
function renderProductionPage(): ...
```

### F4: Delete Dead Functions

If it's not called, delete it. No "just in case" code. Git preserves history.