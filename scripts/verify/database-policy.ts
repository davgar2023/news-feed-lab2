import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

export interface PolicyViolation {
  file: string;
  line: number;
  rule: "direct-business-sql" | "pool-construction" | "controller-infrastructure-access";
  message: string;
}

const BUSINESS_TABLES =
  '(?:"?public"?\\s*\\.\\s*)?"?(?:users|posts|follows|outbox_events|processed_events)"?';
const DIRECT_SQL = new RegExp(
  `\\b(?:from|join|insert\\s+into|update|delete\\s+from|merge\\s+into)\\s+${BUSINESS_TABLES}(?=\\s|$|[,;)])`,
  "i",
);

function isIgnored(relativePath: string): boolean {
  const segments = relativePath.split(path.sep);
  return (
    segments.includes("tests") ||
    segments.includes("database") ||
    segments.includes("generated") ||
    relativePath.endsWith(".test.ts") ||
    relativePath.endsWith(".spec.ts") ||
    relativePath.includes(`${path.sep}__generated__${path.sep}`)
  );
}

async function runtimeTypeScriptFiles(root: string): Promise<string[]> {
  const sourceRoot = path.join(root, "src");
  const files: string[] = [];
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute);
      if (isIgnored(relative)) continue;
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(absolute);
    }
  }
  try {
    await visit(sourceRoot);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return files.sort();
}

function literalText(node: ts.Node): string | undefined {
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(" ");
  }
  return undefined;
}

function lineOf(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function add(
  violations: PolicyViolation[],
  root: string,
  file: string,
  source: ts.SourceFile,
  node: ts.Node,
  rule: PolicyViolation["rule"],
  message: string,
): void {
  violations.push({
    file: path.relative(root, file),
    line: lineOf(source, node),
    rule,
    message,
  });
}

export async function scanDatabasePolicy(root: string): Promise<PolicyViolation[]> {
  const violations: PolicyViolation[] = [];
  for (const file of await runtimeTypeScriptFiles(root)) {
    const relative = path.relative(root, file);
    const databaseInfrastructure =
      relative === path.join("src", "infrastructure", "database", "Database.ts");
    const controller = /Controller\.ts$/i.test(relative);
    const text = await readFile(file, "utf8");
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const poolIdentifiers = new Set(["Pool"]);
    const pgNamespaces = new Set<string>();
    for (const statement of source.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        statement.moduleSpecifier.text !== "pg"
      ) {
        continue;
      }
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) pgNamespaces.add(bindings.name.text);
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          if ((element.propertyName ?? element.name).text === "Pool") {
            poolIdentifiers.add(element.name.text);
          }
        }
      }
    }

    const visit = (node: ts.Node): void => {
      const literal = literalText(node);
      if (literal && DIRECT_SQL.test(literal)) {
        add(
          violations,
          root,
          file,
          source,
          node,
          "direct-business-sql",
          "runtime code must invoke an approved pkg_* routine instead of business-table SQL",
        );
      }

      if (
        !databaseInfrastructure &&
        ts.isNewExpression(node) &&
        ((ts.isIdentifier(node.expression) && poolIdentifiers.has(node.expression.text)) ||
          (ts.isPropertyAccessExpression(node.expression) &&
            ts.isIdentifier(node.expression.expression) &&
            pgNamespaces.has(node.expression.expression.text) &&
            node.expression.name.text === "Pool"))
      ) {
        add(
          violations,
          root,
          file,
          source,
          node,
          "pool-construction",
          "pg.Pool may only be constructed in src/infrastructure/database/Database.ts",
        );
      }

      if (controller && ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const moduleName = node.moduleSpecifier.text.toLowerCase();
        if (
          moduleName === "pg" ||
          moduleName === "ioredis" ||
          moduleName === "amqplib" ||
          moduleName.includes("infrastructure/redis") ||
          moduleName.includes("infrastructure/messaging")
        ) {
          add(
            violations,
            root,
            file,
            source,
            node,
            "controller-infrastructure-access",
            "controllers cannot import PostgreSQL, Redis, or RabbitMQ infrastructure",
          );
        }
      }

      if (
        controller &&
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression)
      ) {
        const method = node.expression.name.text;
        if (
          /^(?:query|publish|consume|zadd|zrange|zrevrange|zrem|zremrangebyrank)$/i.test(method)
        ) {
          add(
            violations,
            root,
            file,
            source,
            node,
            "controller-infrastructure-access",
            `controllers cannot call infrastructure method ${method}() directly`,
          );
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return violations;
}

async function main(): Promise<void> {
  const root = path.resolve(process.argv[2] ?? process.cwd());
  const violations = await scanDatabasePolicy(root);
  if (violations.length === 0) {
    console.log(
      "Database policy verified: runtime TypeScript uses approved infrastructure boundaries.",
    );
    return;
  }
  console.error("Database policy violations:");
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} [${violation.rule}] ${violation.message}`);
  }
  process.exitCode = 1;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) await main();
