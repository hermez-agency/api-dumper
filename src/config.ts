import type { OpenAPITSOptions } from "openapi-typescript"

/** An OpenAPI 3.x document, loosely typed: it comes as-is from the network or the disk. */
export type OpenApiDocument = Record<string, any>

export interface EnumDefinition {
  /** TypeScript name, used for the file and the exports (`Gender`, `GenderEnum`…). */
  name: string
  /** Values, in schema order. */
  values: (string | number | boolean)[]
  /** Key of each value in `XxxEnum`, same length as `values`. */
  keys: string[]
  /** IRI of each value, indexed by key — JSON-LD only. */
  iris?: Record<string, string>
  /** Where the enum comes from, for error messages. */
  origin: string
}

export interface PresetContext {
  config: ResolvedConfig
}

export interface Preset {
  name: string
  /** Mutates the document after loading and before any generation. */
  transform?: (document: OpenApiDocument, context: PresetContext) => void | Promise<void>
  /** Completes or replaces the enums found in the document. */
  enums?: (
    document: OpenApiDocument,
    enums: EnumDefinition[],
    context: PresetContext,
  ) => EnumDefinition[] | Promise<EnumDefinition[]>
}

export interface ApiPlatformOptions {
  /**
   * Enum collections to fetch over HTTP (`/api/genders`…), for APIs that
   * expose their enums as resources without publishing their values in the
   * OpenAPI document. Each member must carry `value` and `@id`.
   */
  collections?: {
    paths: string[]
    /** API host. Defaults to the origin of `source` when it is a URL. */
    host?: string
    headers?: Record<string, string>
  }
}

export interface CodegenConfig {
  /** URL or path of the OpenAPI 3.x document, JSON or YAML. */
  source: string
  /** Output directory. */
  outDir: string
  /** `"openapi"` (default), `"api-platform"`, or a custom preset. */
  preset?: "openapi" | "api-platform" | Preset
  /** What to remove from the document before generating anything. */
  strip?: {
    /** Content types to remove everywhere (`"text/csv"`…). */
    contentTypes?: string[]
    /** Paths to remove: strict equality for a string, `test()` for a RegExp. */
    paths?: (string | RegExp)[]
  }
  /** Copy of the cleaned document, relative to `outDir`. `false` to skip it. Default: `openapi.json`. */
  schemaFile?: string | false
  /** openapi-typescript types. `false` to skip them. */
  types?:
    | false
    | {
        /** Default: `api-schema.ts`. */
        fileName?: string
        /** Options passed as-is to openapi-typescript. */
        options?: OpenAPITSOptions
      }
  /** Enum constants. `false` to skip them. */
  enums?:
    | false
    | {
        /** Subdirectory of `outDir`. Default: `enums`. */
        dir?: string
        /** Also generate enums declared inline on a property. Default: `false`. */
        inline?: boolean
        /** Add `as const` to the constants. Default: `true`. */
        asConst?: boolean
      }
  /** Options of the `api-platform` preset. */
  apiPlatform?: ApiPlatformOptions
}

export interface ResolvedConfig extends CodegenConfig {
  /** Directory `source` and `outDir` resolve against. */
  cwd: string
}

export function defineConfig(config: CodegenConfig): CodegenConfig {
  return config
}
