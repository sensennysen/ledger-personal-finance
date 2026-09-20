# One schema, one form per entity
Keep the zod schema in its own pure file (`src/lib/accountSchema.ts`) and one form component (`AccountForm`) used by every create/edit entry point.
**Why:** two copies diverged and left loan schedules uneditable (LED-04).
**Note:** the schema is a separate file so `node --test` can import it without `@/` aliases.
