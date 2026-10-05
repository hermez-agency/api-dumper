export { defineConfig } from "./config.js"
export type {
  ApiPlatformOptions,
  CodegenConfig,
  EnumDefinition,
  OpenApiDocument,
  Preset,
  PresetContext,
} from "./config.js"
export { generate, run, writeResult } from "./generate.js"
export type { GeneratedFile, GenerateResult, RunResult } from "./generate.js"
export { buildEnum, collectEnums, mergeEnums, renderEnum, toTypeName } from "./core/enums.js"
export { loadDocument } from "./core/load.js"
export { findDanglingRefs, stripContentTypes, stripPaths } from "./core/strip.js"
export { generateTypes } from "./core/types.js"
export { apiPlatformPreset } from "./presets/apiPlatform.js"
export { openapiPreset } from "./presets/openapi.js"
