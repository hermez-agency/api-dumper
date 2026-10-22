# api-dumper

Dump an OpenAPI 3.x schema into TypeScript: the
[openapi-typescript](https://openapi-ts.dev) types, a cleaned copy of the schema,
and one file of constants per enum.

It works with any OpenAPI API. An `api-platform` preset covers what
[API Platform](https://api-platform.com) and JSON-LD / Hydra APIs need on top:
dropping the per-format schemas (`Animal.csv`…) and mapping enum values to their IRIs.

```
app/api-schema/
├── openapi.json       # the schema, cleaned
├── api-schema.ts      # openapi-typescript types (`paths`, `components`…)
└── enums/
    ├── Gender.ts
    └── PetStatus.ts
```

## Install

```bash
pnpm add -D api-dumper typescript
```

Node 20 or later. `typescript` is a peer dependency of openapi-typescript.

## Quick start

Create `api-dumper.config.ts` at the root of your project:

```ts
import { defineConfig } from "api-dumper"

export default defineConfig({
  source: "https://api.example.com/openapi.yaml", // URL or file, JSON or YAML
  outDir: "src/api",
})
```

Then run it:

```bash
npx api-dumper              # writes what changed, removes vanished enums
npx api-dumper --check      # writes nothing, exits 1 if the files are out of date
npx api-dumper -c other.config.ts
```

`--check` is meant for CI: regenerate from the committed schema and fail when someone
forgot to commit the result.

Paths in the config resolve against the config file's directory. The config may be
`.ts`, `.mts`, `.js`, `.mjs` or `.json`.

## Enums

Every named schema carrying the standard `enum` keyword becomes a file:

```yaml
components:
  schemas:
    PetStatus:
      type: string
      enum: [available, pending, sold]
```

```ts
// enums/PetStatus.ts
export const PetStatus = ["available","pending","sold"] as const

export const PetStatusEnum = {
  available: "available",
  pending: "pending",
  sold: "sold",
} as const

export type PetStatusValues = keyof typeof PetStatusEnum
```

`null` is left out of the values. Enums declared inline on a property are skipped,
unless `enums.inline` is on: they are then named `<Schema><Property>` (`PetSize`).

These schema extensions are understood:

| Extension                            | Effect                                                                     |
|--------------------------------------|----------------------------------------------------------------------------|
| `x-enum-name`                        | TypeScript name, instead of the one derived from the schema key            |
| `x-enum-varnames` / `x-enumNames`    | Key of each value — needed for numeric enums (`{ LOW: 1, HIGH: 3 }`)       |
| `x-enum-iris`                        | IRI of each value (`{ "MALE": "/api/genders/MALE" }`), emits `XxxApiEnum`  |

Without `x-enum-varnames`, a numeric value gets a `VALUE_1`-style key. Two enums ending
up with the same name but different values are an error, never a silent overwrite.

## API Platform / JSON-LD

```ts
export default defineConfig({
  source: "../api/var/openapi.json", // bin/console api:openapi:export --output=var/openapi.json
  outDir: "app/api-schema",
  preset: "api-platform",
  strip: { contentTypes: ["text/csv"] },
})
```

On top of the core, the preset:

- **removes the schemas of a stripped format.** Stripping `text/csv` also drops
  `Animal.csv`, `Animal.csv-read`, `Animal.csv_noid`… (same for XML, YAML, HTML, JSON:API, HAL).
- **emits `XxxApiEnum`** (value → IRI) for enums exposed as resources:

  ```ts
  export const GenderApiEnum = {
    MALE: "/api/genders/MALE",
    FEMALE: "/api/genders/FEMALE",
  } as const
  ```

  API Platform does not publish those values in the OpenAPI document: a relation to an
  enum is a plain `iri-reference`. Two ways to get them:

  1. **From the document (recommended).** Decorate API Platform's `OpenApiFactory` so it
     adds, for each backed enum, a schema with `enum`, `x-enum-name` and `x-enum-iris`.
     Generation then works offline, from a file.
  2. **From the Hydra collections**, fetched at generation time. Each member must carry
     `value` and `@id`; the enum is named after the collection's `@context`.

     ```ts
     apiPlatform: {
       collections: {
         host: "http://localhost:8080", // defaults to the origin of `source` when it is a URL
         paths: ["/api/genders", "/api/roles"],
         headers: { authorization: "Bearer …" },
       },
     },
     ```

## Configuration

| Option                     | Default          | Description                                                       |
|----------------------------|------------------|-------------------------------------------------------------------|
| `source`                   | —                | URL or path of the OpenAPI 3.x document (JSON or YAML)            |
| `outDir`                   | —                | Output directory                                                  |
| `preset`                   | `"openapi"`      | `"openapi"`, `"api-platform"`, or a custom `Preset` object        |
| `strip.contentTypes`       | `[]`             | Content types removed everywhere (`content` left empty goes too)  |
| `strip.paths`              | `[]`             | Paths removed — a string matches exactly, a RegExp is tested      |
| `schemaFile`               | `"openapi.json"` | Cleaned schema, relative to `outDir`; `false` to skip             |
| `types.fileName`           | `"api-schema.ts"`| openapi-typescript output, relative to `outDir`                   |
| `types.options`            | `{}`             | Passed as-is to [openapi-typescript](https://openapi-ts.dev/node) |
| `types`                    |                  | `false` to skip the types                                         |
| `enums.dir`                | `"enums"`        | Enum directory, relative to `outDir`                              |
| `enums.inline`             | `false`          | Also generate enums declared inline on a property                 |
| `enums.asConst`            | `true`           | Add `as const` to the constants                                   |
| `enums`                    |                  | `false` to skip the enums                                         |
| `apiPlatform.collections`  | —                | See above                                                         |

After cleanup, any local `$ref` that no longer resolves is an error: a too-broad `strip`
fails loudly instead of producing broken types.

Files are only rewritten when their content changes. In the enum directory, files that
were generated (they carry the `Generated by api-dumper` marker) and no longer are get
removed; a hand-written file is never touched.

## Custom presets

A preset is an object with two optional hooks:

```ts
import { defineConfig, type Preset } from "api-dumper"

const internalOnly: Preset = {
  name: "internal",
  // mutate the document after loading, before anything is generated
  transform(document) {
    delete document.components.schemas.Debug
  },
  // complete or replace the enums found in the document
  enums(document, enums) {
    return enums.filter((e) => !e.name.startsWith("Internal"))
  },
}

export default defineConfig({ source: "openapi.json", outDir: "src/api", preset: internalOnly })
```

## Programmatic use

```ts
import { generate, run } from "api-dumper"

const { files } = await generate(config, cwd)         // in memory, nothing written
const { changed, removed } = await run(config, { cwd, check: false })
```

The building blocks (`loadDocument`, `stripContentTypes`, `collectEnums`, `renderEnum`,
`generateTypes`…) are exported too.

## Development

```bash
pnpm install
pnpm test        # vitest, against real files and a real local HTTP server
pnpm typecheck
pnpm build
```

## License

MIT

A Hermez product — [hermez.dev](https://hermez.dev).
