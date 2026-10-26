import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';
import { format, resolveConfig } from 'prettier';

const source = process.argv[2];
if (!source) throw new Error('Usage: npm run api:types -- <path-to-backend-openapi.json>');
const schema = await openapiTS(pathToFileURL(resolve(source)));
const target = new URL('../src/shared/api/schema.d.ts', import.meta.url);
const output = `/** Generated TypeScript types from backend OpenAPI. Run npm run api:types; do not edit manually. */\n${astToString(schema)}`;
await writeFile(
  target,
  await format(output, {
    ...(await resolveConfig(fileURLToPath(target))),
    filepath: fileURLToPath(target),
  }),
);
