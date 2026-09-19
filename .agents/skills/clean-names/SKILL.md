---
name: clean-names
description: Use when naming, renaming, or fixing names of variables, functions, classes, interfaces, or modules in any programming language. Enforces Clean Code principles—descriptive names, appropriate length, no encodings.
---

# Clean Names

## When to Use

Use this skill when naming, renaming, or fixing names of variables, functions, classes, interfaces, or modules in any programming language.

Also trigger on: single-letter or cryptic identifiers (`d`, `x`, `proc`), Hungarian notation (`strName`, `arrUsers`, `nCount`), `I`-prefixed interfaces (`IUserRepository`), function names that hide side effects (e.g. `getConfig` that also mutates state), ambiguous names like `rename(source, target)`, or asks like "rename this", "clearer name".

## Instructions

### N1: Choose Descriptive Names

Names should reveal intent. If a name requires a comment, it doesn't reveal its intent.

```text
# Bad - what is d?
d = 86400

# Good - obvious meaning
SECONDS_PER_DAY = 86400

# Bad - what does this function do?
function proc(values):
  return filter(values, value > 0)

# Good - intent is clear
function filterPositiveNumbers(numbers):
  return filter(numbers, number > 0)
```

### N2: Choose Names at the Appropriate Level of Abstraction

Don't pick names that communicate implementation; choose names that reflect the level of abstraction of the class or function.

```text
# Bad - too implementation-specific
function getMapOfUserIdsToNames():
  ...

# Good - abstracts the data structure
function getUserDirectory():
  ...
```

### N3: Use Standard Nomenclature Where Possible

Use terms from the domain, design patterns, or well-known conventions.

```text
# Good - uses pattern name
class UserFactory:
  method create(data): ...

# Good - uses domain term
function calculateAmortization(principal, rate, term): ...
```

### N4: Unambiguous Names

Choose names that make the workings of a function or variable unambiguous.

```text
# Bad - ambiguous
function rename(source, target):
  ...

# Good - clear what's being renamed
function renameFile(oldPath, newPath):
  ...
```

### N5: Use Longer Names for Longer Scopes

Short names are fine for tiny scopes. Longer scopes need longer, more descriptive names.

```text
# Good - short name for tiny scope
total = reduce(numbers, (sum, n) -> sum + n, 0)

# Good - longer name for module-level constant
MAX_RETRY_ATTEMPTS_BEFORE_FAILURE = 5

# Bad - short name at module level
MAX = 5
```

### N6: Avoid Encodings

Don't encode type or scope information into names. Modern editors make this unnecessary.

```text
# Bad - Hungarian notation
strName = "Alice"
arrUsers = []
nCount = 0

# Good - clean names
name = "Alice"
users = []
count = 0

# Bad - interface prefix
interface IUserRepository: method findById(id)

# Good - just name it
interface UserRepository: method findById(id)
```

### N7: Names Should Describe Side Effects

If a function does something beyond what its name suggests, the name is misleading.

```text
configStore = map()

# Bad - name doesn't mention that it stores the config
function getConfig(configPath):
  if not has(configStore, configPath):
    set(configStore, configPath, "{}")   # Hidden side effect!
  return parse(configStore[configPath])

# Good - name reveals behavior
function getOrCreateConfig(configPath):
  if not has(configStore, configPath):
    set(configStore, configPath, "{}")
  return parse(configStore[configPath])
```

### Quick Reference

| Rule | Principle | Example |
|------|-----------|---------|
| N1 | Descriptive names | `SECONDS_PER_DAY` not `d` |
| N2 | Right abstraction level | `getUserDirectory()` not `getMapOf...` |
| N3 | Standard nomenclature | `UserFactory`, `calculateAmortization` |
| N4 | Unambiguous | `renameFile(oldPath, newPath)` |
| N5 | Length matches scope | Short for loops, long for globals |
| N6 | No encodings | `users` not `arrUsers` |
| N7 | Describe side effects | `getOrCreateConfig()` |