---
name: go-project-layout
description: >-
  Guide Go project structure following golang-standards/project-layout conventions.
  Use when creating new Go projects, organizing code structure, reviewing Go project
  organization, or restructuring existing Go codebases. Also triggers on mentions of
  /cmd, /internal, /pkg directories or Go module layout questions.
---

# Go Project Layout

Based on [golang-standards/project-layout](https://github.com/golang-standards/project-layout).

## Core Directories

| Directory | Purpose | Import Rule |
|-----------|---------|-------------|
| `/cmd` | Main applications (one per executable) | Entry point only, minimal code |
| `/internal` | Private application/library code | **Enforced by Go compiler** |
| `/pkg` | Public library code (safe for external use) | Optional, for shared libraries |
| `/api` | OpenAPI/Swagger specs, protobuf definitions | Non-Go documentation |
| `/web` | Static web assets, templates, SPAs | Non-Go assets |

## Application Directories

| Directory | Purpose |
|-----------|---------|
| `/configs` | Configuration file templates |
| `/init` | System init configs (systemd, supervisord) |
| `/scripts` | Build, install, analysis scripts |
| `/build` | Packaging (Docker, deb, rpm) and CI configs |
| `/deployments` | IaaS, PaaS, container orchestration (k8s, terraform) |
| `/test` | Additional external test apps and data |

## Other Directories

| Directory | Purpose |
|-----------|---------|
| `/docs` | Design and user documents |
| `/tools` | Supporting tools (can import `/pkg` and `/internal`) |
| `/examples` | Examples for applications/libraries |
| `/third_party` | External helper tools, forked code |
| `/githooks` | Git hooks |
| `/assets` | Other assets (images, logos) |
| `/website` | Project website data |

## Directory to Avoid

| Directory | Why |
|-----------|-----|
| `/src` | Java pattern—don't use in Go projects |

## Decision Tree

```
New code to write?
├── Reusable by external projects? → /pkg
├── Private to this project? → /internal
├── Entry point? → /cmd/{appname}/main.go
└── Configuration/asset? → /configs, /web, etc.
```

## Quick Rules

1. Keep `/cmd` minimal—only `main.go` that imports from `/internal` or `/pkg`
2. Use `/internal` for anything you don't want imported elsewhere
3. Only put code in `/pkg` if you want external projects to import it
4. `/vendor` exists but optional—Go modules handle dependencies
5. One executable = one directory under `/cmd`

## Reference

For detailed explanations, see [reference.md](reference.md).

## When to Use

- Creating new Go projects
- Organizing or restructuring Go code structure
- Reviewing Go project organization
- When questions come up about /cmd, /internal, /pkg directories or Go module layout

## Instructions

- Follow golang-standards/project-layout conventions when structuring Go projects.
- Keep `/cmd` minimal — only `main.go` importing from `/internal` or `/pkg`.
- Use `/internal` for code not meant to be imported elsewhere and `/pkg` only for code safe for external import.
- Use one executable directory under `/cmd` per binary and rely on Go modules instead of `/vendor`.