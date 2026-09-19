---
name: clean-general
description: Use when writing, fixing, editing, or reviewing code quality in any programming language. Enforces Clean Code's core principles—DRY, single responsibility, clear intent, no magic numbers, proper abstractions.
---

# General Clean Code Principles

## When to Use

Use this skill when writing, fixing, editing, or reviewing code quality in any programming language.

Also trigger on: duplicated logic across files or branches (G5), magic numbers or hardcoded strings (G25), long if/else chains that should be union types plus polymorphism (G23), chained property access like `a.b.c.d` or long optional-chain trains (G36), functions juggling multiple responsibilities (G30), clever one-liners whose intent is not obvious (G16).

## Instructions

### Critical Rules

**G5: DRY (Don't Repeat Yourself)**

Every piece of knowledge has one authoritative representation.

```text
# Bad - duplication
taxRate = 0.0825
caTotal = subtotal * 1.0825
nyTotal = subtotal * 1.07

# Good - single source of truth
TAX_RATES = { "CA": 0.0825, "NY": 0.07 }

function calculateTotal(subtotal, state):
  return subtotal * (1 + TAX_RATES[state])
```

**G16: No Obscured Intent**

Don't be clever. Be clear.

```text
# Bad - what does this do?
return bit-manipulation of x and y

# Good - obvious intent
return packCoordinates(x, y)
```

**G23: Prefer Polymorphism to If/Else**

```text
# Bad - will grow forever
function calculatePay(employee):
  if employee.type == "SALARIED":
    return employee.salary
  else if employee.type == "HOURLY":
    return employee.hours * employee.rate
  else if employee.type == "COMMISSIONED":
    return employee.base + employee.commission
  return 0

# Good - open/closed principle
interface Employee: method calculatePay()

class SalariedEmployee implements Employee:
  fields: salary
  calculatePay: return salary

class HourlyEmployee implements Employee:
  fields: hours, rate
  calculatePay: return hours * rate

class CommissionedEmployee implements Employee:
  fields: base, commission
  calculatePay: return base + commission
```

**G25: Replace Magic Numbers with Named Constants**

```text
# Bad
if elapsedTime > 86400:
  ...

# Good
SECONDS_PER_DAY = 86400
if elapsedTime > SECONDS_PER_DAY:
  ...
```

**G30: Functions Should Do One Thing**

If you can extract another function, your function does more than one thing.

**G36: Law of Demeter (Avoid Train Wrecks)**

```text
# Bad - reaching through multiple objects
outputDir = context.options.scratchDir.absolutePath

# Good - one dot
outputDir = context.getScratchDir()
```

### Enforcement Checklist

When reviewing AI-generated code, verify:
- [ ] No duplication (G5)
- [ ] Clear intent, no magic numbers (G16, G25)
- [ ] Polymorphism over conditionals (G17)
- [ ] Functions do one thing (G30)
- [ ] No Law of Demeter violations (G36)
- [ ] Boundary conditions handled (G4)
- [ ] Dead code removed (G9)