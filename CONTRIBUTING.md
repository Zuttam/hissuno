# Contributing to Hissuno

Thank you for your interest in contributing to Hissuno - the open-source unified context layer for product agents. This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ with the pgvector extension (any provider - Supabase, Neon, Railway, or local)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/zuttam/hissuno.git
cd hissuno

# Install dependencies
cd app
npm install

# Set up environment variables
cp env.example .env.local
# Edit .env.local with your database URL, OpenAI key, and auth secrets
# See env.example for the full list of variables

# Push the database schema
npx drizzle-kit push

# Start the development server
npm run dev
```

The app will be available at `http://localhost:3000`.

## Terminology

The codebase uses internal names that differ from the UI labels (e.g., "sessions" in code = "Feedback" in the UI). See the [Terminology Mapping](docs/architecture.md#terminology-mapping) section in the architecture docs for the full mapping.

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feat/short-description` - new features
- `fix/short-description` - bug fixes
- `docs/short-description` - documentation changes
- `refactor/short-description` - code refactoring

### Pull Request Process

1. Fork the repository and create your branch from `main`.
2. Make your changes, following the code standards below.
3. Add or update tests as needed.
4. Ensure all tests pass with `npm run test`.
5. Ensure linting passes with `npm run lint`.
6. Open a pull request with a clear description of the changes and why they are needed.
7. A maintainer will review your PR and may request changes.

### Code Standards

- **TypeScript**: Strict mode is enabled. All new code must be fully typed.
- **File naming**: Use `kebab-case` for all files (e.g., `session-sidebar.tsx`, `use-sessions.ts`).
- **Component naming**: Use `PascalCase` for React components (e.g., `SessionSidebar`).
- **Imports**: Use absolute imports with the `@/` alias. No relative imports.
- **UI components**: Check `@/components/ui` for existing components before creating new ones.
- **No internal HTTP calls**: Never fetch from one API route to another. Import service functions directly.
- **Logging**: Use bracketed prefixes - `console.log('[route.method] message', data)`.

### Testing

We use [Vitest](https://vitest.dev/) for testing.

```bash
# Run all tests
npm run test

# Run unit tests only
npm run test:unit

# Run a specific test file
npx vitest run path/to/file.test.ts

# Run tests in watch mode
npm run test:watch
```

All new features and bug fixes should include appropriate tests.

### Database Changes

If your changes require database schema modifications:

1. Update the schema files in `src/lib/db/schema/`.
2. Generate a migration with `npx drizzle-kit generate`.
3. Include the generated migration file in your PR.

## Reporting Issues

- Use the [GitHub issue tracker](https://github.com/zuttam/hissuno/issues).
- Search existing issues before opening a new one.
- Use the provided issue templates for bug reports and feature requests.

## License

By contributing to Hissuno, you agree that your contributions will be licensed under the MIT License.
