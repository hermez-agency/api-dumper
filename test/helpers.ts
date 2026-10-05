import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures")

export async function tempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "api-dumper-"))
}

export async function read(file: string): Promise<string> {
  return fs.readFile(file, "utf8")
}
