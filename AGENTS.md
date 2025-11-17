# AGENTS.md

## Agent Workflow

YOU MUST CHECK `pnpm run check` passing before finishing any task.

## Project Context

### Overview

TBD

### Architecture

TBD

### Key Features

TBD

### Design Decisions

TBD

---

## Development Environment

### Available Scripts

In most case you just run `pnpm run check` to run all checks.

```bash
pnpm lint          # ESLint with auto-fix
pnpm format        # Biome format with write
pnpm format:check  # Biome format check (GitHub reporter)
pnpm typecheck     # TypeScript type checking
pnpm test          # Run Vitest tests
pnpm build         # Build with tsdown
```

### Development Workflow

1. **Code**: Write TypeScript code following ESLint and import-access rules
2. **Format**: Auto-formatted by Biome (2 spaces, 80 chars, double quotes)
3. **Lint**: ESLint enforces TypeScript and import access rules
4. **Type Check**: Ensure types are correct with `pnpm typecheck`
5. **Test**: Run tests with Vitest
6. **Build**: Bundle with tsdown before publishing
7. **Publish**: Managed via release-it workflow

### Key Constraints

- **ESM Only**: No CommonJS support
- **Tree-shakeable**: `sideEffects: false` in package.json
- **Import Access Control**: Must follow JSDoc annotations for private/public exports
- **Type Safety**: Full TypeScript with no emit errors
- **Code Style**: Enforced by Biome + ESLint combination
