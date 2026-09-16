import { pathToFileURL } from "node:url";

export function isMainModule(metaUrl: string): boolean {
  const entry = process.argv[1];
  return entry !== undefined && metaUrl === pathToFileURL(entry).href;
}

export function installGracefulShutdown(shutdown: () => Promise<void>): void {
  let shuttingDown = false;
  const handleSignal = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    void shutdown().catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
  };
  process.once("SIGTERM", handleSignal);
  process.once("SIGINT", handleSignal);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Event payload requires ${field}`);
  }
  return value;
}
