# Go Project Layout Reference

Detailed explanation of each directory based on golang-standards/project-layout.

## `/cmd`

Main applications for this project. Each subdirectory should match the executable name (e.g., `/cmd/myapp`).

- Keep code minimal—only `main` function
- Import and invoke code from `/internal` and `/pkg`
- Don't put reusable code here—move to `/pkg`
- Don't put private code here—move to `/internal`

**Example:**
```
/cmd
└── myapp
    └── main.go
```

## `/internal`

Private application and library code. **Enforced by Go compiler**—other projects cannot import these packages.

- Contains code you don't want others importing
- Can have multiple `/internal` directories at any level
- Structure option: `/internal/app/myapp` for app code, `/internal/pkg/myprivlib` for shared private code

**Key benefit:** Explicitly signals "not for external use" with compiler enforcement.

## `/pkg`

Library code that's **safe for external applications** to import. Other projects will depend on these.

- Use when you want to explicitly signal "this is public API"
- Good for grouping Go code when root has many non-Go components
- **Not universally accepted**—some in community don't recommend it
- Skip if your app is small and extra nesting doesn't add value

**Origins:** Old Go source code used `/pkg`, community adopted the pattern.

## `/vendor`

Application dependencies managed by Go Modules.

- Created by `go mod vendor`
- Might need `-mod=vendor` flag pre-Go 1.14
- Don't commit if building a library
- Go module proxy (`proxy.golang.org`) may make this unnecessary

## `/api`

API definitions in standard formats:

- OpenAPI/Swagger specs
- JSON schema files
- Protocol definitions (protobuf, gRPC)

## `/web`

Web application specific components:

- Static web assets
- Server-side templates
- Single Page Applications

## `/configs`

Configuration file templates or defaults:

- `confd` templates
- `consul-template` files

## `/init`

System initialization configs:

- systemd
- upstart
- sysv
- Process managers (runit, supervisord)

## `/scripts`

Build, install, analysis scripts. Keeps root `Makefile` small.

- Build automation
- Installation scripts
- Analysis tools
- Code generation

## `/build`

Packaging and CI configurations:

- **Cloud:** AMI configs
- **Container:** Dockerfiles
- **OS packages:** deb, rpm, pkg
- **CI:** Travis, Circle, Drone configs

## `/deployments`

IaaS, PaaS, container orchestration configs:

- Docker Compose
- Kubernetes/Helm
- Terraform
- Sometimes called `/deploy`

## `/test`

Additional external test apps and data. Structure as needed:

- `/test/data`
- `/test/testdata` (Go ignores this directory)

Go also ignores directories starting with `.` or `_`.

## `/docs`

Design and user documents (beyond godoc).

## `/tools`

Supporting tools for the project. Can import from `/pkg` and `/internal`.

## `/examples`

Examples for applications and/or public libraries.

## `/third_party`

External helper tools, forked code, other 3rd party utilities (e.g., Swagger UI).

## `/githooks`

Git hooks.

## `/assets`

Other assets: images, logos, etc.

## `/website`

Project website data (if not using GitHub Pages).

## `/src`

**DO NOT USE** in Go projects. This is a Java pattern.

- Don't confuse with Go workspace `$GOPATH/src`
- Go 1.11+ allows projects outside GOPATH
- Using `/src` in your project creates confusing nested paths