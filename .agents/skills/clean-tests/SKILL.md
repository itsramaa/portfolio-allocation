---
name: clean-tests
description: Use when writing, fixing, editing, or refactoring tests in any programming language. Enforces Clean Code principles—fast tests, boundary coverage, one assert per test.
---

# Clean Tests

## When to Use

Use this skill when writing, fixing, editing, or refactoring tests in any programming language.

Also trigger on: slow or flaky tests, `test.skip`/`it.skip`/`.todo` without a clear reason, `test.only` left in committed code, tests that only cover the happy path, tests with multiple assertions about different concepts, missing boundary cases (empty arrays, off-by-one, page zero), or asks about "coverage gap" / "edge case".

## Instructions

### T1: Insufficient Tests

Test everything that could possibly break. Use coverage tools as a guide, not a goal.

```text
# Bad - only tests happy path
test("divide"):
  expect(divide(10, 2)) == 5

# Good - tests edge cases too
test("divide normal"):
  expect(divide(10, 2)) == 5

test("divide by zero"):
  expect(divide(10, 0)) throws RangeError

test("divide negative"):
  expect(divide(-10, 2)) == -5
```

### T2: Use a Coverage Tool

Coverage tools report gaps in your testing strategy. Don't ignore them.

```text
# Run with coverage
run tests with coverage enabled

# Aim for meaningful coverage, not 100%
```

### T3: Don't Skip Trivial Tests

Trivial tests document behavior and catch regressions. They're worth more than their cost.

```text
# Worth having - documents expected behavior
test("user default role"):
  user = new User("Alice")
  expect(user.role) == "member"
```

### T4: An Ignored Test Is a Question About an Ambiguity

Don't use `test.skip` to hide problems. Either fix the test or delete it.

```text
# Bad - hiding a problem
test.skip("async operation"):
  # flaky, fix later

# Good - either fix it or document why it's skipped
test.skip("cache invalidation - requires Redis (see CONTRIBUTING.md)"):
  ...
```

### T5: Test Boundary Conditions

Bugs congregate at boundaries. Test them explicitly.

```text
test("pagination boundaries"):
  items = generate 100 items

  # First page
  expect(paginate(items, 1, 10)) == items[0..9]

  # Last page
  expect(paginate(items, 10, 10)) == items[90..99]

  # Beyond last page
  expect(paginate(items, 11, 10)) == []

  # Page zero (invalid)
  expect(paginate(items, 0, 10)) throws RangeError

  # Empty list
  expect(paginate([], 1, 10)) == []
```

### T6: Exhaustively Test Near Bugs

When you find a bug, write tests for all similar cases. Bugs cluster.

```text
# Found bug: off-by-one in date calculation
# Now test ALL date boundaries
test("month boundaries"):
  expect(lastDayOfMonth(2024, 1)) == 31   # January
  expect(lastDayOfMonth(2024, 2)) == 29   # Leap year February
  expect(lastDayOfMonth(2023, 2)) == 28   # Non-leap February
  expect(lastDayOfMonth(2024, 4)) == 30   # 30-day month
  expect(lastDayOfMonth(2024, 12)) == 31  # December
```

### T7: Patterns of Failure Are Revealing

When tests fail, look for patterns. They often point to deeper issues.

```text
# If all async tests fail intermittently,
# the problem isn't the tests—it's the async handling
```

### T8: Test Coverage Patterns Can Be Revealing

Look at which code paths are untested. Often they reveal design problems.

```text
# If you can't easily test a function, it probably does too much
# Refactor for testability
```

### T9: Tests Should Be Fast

Slow tests don't get run. Keep unit tests under 100ms each.

```text
# Bad - hits real database
test("user creation"):
  db = connectToDatabase()          # Slow!
  user = db.createUser("Alice")
  expect(user.name) == "Alice"

# Good - uses mock or in-memory
test("user creation"):
  db = new InMemoryDatabase()
  user = db.createUser("Alice")
  expect(user.name) == "Alice"
```

### Test Organization

#### F.I.R.S.T. Principles

- **Fast**: Tests should run quickly
- **Independent**: Tests shouldn't depend on each other
- **Repeatable**: Same result every time, any environment
- **Self-Validating**: Pass or fail, no manual inspection
- **Timely**: Written before or with the code, not after

#### One Concept Per Test

```text
# Bad - testing multiple things
test("user"):
  user = new User("Alice", "alice@example.com")
  expect(user.name) == "Alice"
  expect(user.email) == "alice@example.com"
  expect(user.isValid()) == true
  user.activate()
  expect(user.isActive) == true

# Good - one concept each
test("user stores name"):
  user = new User("Alice", "alice@example.com")
  expect(user.name) == "Alice"

test("user stores email"):
  user = new User("Alice", "alice@example.com")
  expect(user.email) == "alice@example.com"

test("new user is valid"):
  user = new User("Alice", "alice@example.com")
  expect(user.isValid()) == true

test("user can be activated"):
  user = new User("Alice", "alice@example.com")
  user.activate()
  expect(user.isActive) == true
```

### Quick Reference

| Rule | Principle |
|------|-----------|
| T1 | Test everything that could break |
| T2 | Use coverage tools |
| T3 | Don't skip trivial tests |
| T4 | Ignored test = ambiguity question |
| T5 | Test boundary conditions |
| T6 | Exhaustively test near bugs |
| T7 | Look for patterns in failures |
| T8 | Check coverage when debugging |
| T9 | Tests must be fast (<100ms) |