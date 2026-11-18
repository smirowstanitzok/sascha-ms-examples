// scripts/find-shared-state.ts
// Searches TypeScript files for spots that become dangerous under multi-concurrency:
// mutable module variables, writes to them from inside functions,
// fixed paths in /tmp, process.on(...) and _X_AMZN_TRACE_ID.
// Usage: npx tsx scripts/find-shared-state.ts src
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

interface Finding { file: string; line: number; kind: string; message: string }

const MUTATING_METHODS = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'set', 'delete', 'clear', 'add']);

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : listFiles(path);
    return /\.(ts|mts|cts)$/.test(name) && !name.endsWith('.d.ts') ? [path] : [];
  });
}

// Returns the leftmost name in expressions like cache.items[0].name
function rootIdentifier(expr: ts.Expression): string | undefined {
  let current: ts.Expression = expr;
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    current = current.expression;
  }
  return ts.isIdentifier(current) ? current.text : undefined;
}

function isInsideFunction(node: ts.Node): boolean {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isFunctionLike(p)) return true;
  }
  return false;
}

export function analyze(file: string, source: string): Finding[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const findings: Finding[] = [];
  const moduleBindings = new Map<string, 'let' | 'const'>();
  const at = (node: ts.Node) => sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  const add = (node: ts.Node, kind: string, message: string) => findings.push({ file, line: at(node), kind, message });

  // 1. Collect bindings in module scope
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    const isConst = (stmt.declarationList.flags & ts.NodeFlags.Const) !== 0;
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name)) continue;
      moduleBindings.set(decl.name.text, isConst ? 'const' : 'let');
      if (!isConst) add(decl, 'module-variable', `"${decl.name.text}" is mutable in module scope (let/var)`);
    }
  }

  // 2. Search the whole tree for writes and special cases
  const visit = (node: ts.Node): void => {
    const insideFn = isInsideFunction(node);

    if (insideFn && ts.isBinaryExpression(node) &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
      const name = rootIdentifier(node.left);
      if (name && moduleBindings.has(name)) add(node, 'write', `function writes to module variable "${name}"`);
    }

    if (insideFn && (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
        (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken)) {
      const name = rootIdentifier(node.operand);
      if (name && moduleBindings.has(name)) add(node, 'write', `function increments/decrements module variable "${name}"`);
    }

    if (insideFn && ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        MUTATING_METHODS.has(node.expression.name.text)) {
      const name = rootIdentifier(node.expression.expression);
      if (name && moduleBindings.has(name)) {
        add(node, 'write', `function changes "${name}" via .${node.expression.name.text}() – intended cache?`);
      }
    }

    if (ts.isStringLiteral(node) && node.text.startsWith('/tmp/')) {
      add(node, 'tmp-file', `fixed path "${node.text}" – all invocations share /tmp`);
    }

    // join(tmpdir(), 'receipt.txt') – fixed parts only, so the same path for every invocation
    if (ts.isCallExpression(node) && node.arguments.some((a) => ts.isCallExpression(a) && a.expression.getText(sf) === 'tmpdir') &&
        node.arguments.every((a) => ts.isStringLiteral(a) || (ts.isCallExpression(a) && a.expression.getText(sf) === 'tmpdir'))) {
      add(node, 'tmp-file', 'fixed file name under tmpdir() – all invocations share /tmp');
    }

    if (ts.isCallExpression(node) && node.expression.getText(sf) === 'process.on') {
      add(node, 'signal', 'process.on(...) is not supported on Lambda Managed Instances');
    }

    if ((ts.isStringLiteral(node) || ts.isIdentifier(node)) && node.text === '_X_AMZN_TRACE_ID') {
      add(node, 'trace-id', '_X_AMZN_TRACE_ID is not supported – use context.xRayTraceId');
    }

    ts.forEachChild(node, visit);
  };
  visit(sf);
  return findings.sort((a, b) => a.line - b.line);
}

function main(): void {
  const dir = process.argv[2] ?? 'src';
  const findings = listFiles(dir).flatMap((file) => analyze(file, readFileSync(file, 'utf8')));
  for (const f of findings) console.log(`${f.file}:${f.line}  [${f.kind}] ${f.message}`);
  console.log(findings.length === 0 ? 'Nothing suspicious found.' : `\n${findings.length} spot(s) to check.`);
  process.exitCode = findings.length === 0 ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
