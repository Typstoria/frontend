import { Language, Parser, type Node } from 'web-tree-sitter';
import runtimeWasm from 'web-tree-sitter/web-tree-sitter.wasm?url';
import grammarWasm from '@lumis-sh/wasm-typst/tree-sitter-typst.wasm?url';
import { inFolder, parentFolder } from './file-path';
import type { Snapshot, StructureChange } from './workspace-api';

type PathMove = Extract<StructureChange, { type: 'renameFile' | 'renameDirectory' }>;
const pathFunctions = new Set([
  'bibliography',
  'cbor',
  'csv',
  'image',
  'json',
  'path',
  'plugin',
  'read',
  'toml',
  'xml',
  'yaml',
]);
const typstKeyword =
  /^(?:and|as|auto|break|context|continue|else|false|for|if|import|in|include|let|none|not|or|return|set|show|true|while)$/u;

let language: Promise<Language> | undefined;
async function loadLanguage() {
  if (import.meta.env.SSR) {
    const { typst } = await import('@lumis-sh/wasm-typst');
    const { fileURLToPath } = await import('node:url');
    await Parser.init();
    return Language.load(fileURLToPath(typst.wasm as URL));
  }
  await Parser.init({ locateFile: () => runtimeWasm });
  return Language.load(grammarWasm);
}

export async function createReferenceParser() {
  language ??= loadLanguage().catch((error: unknown) => {
    language = undefined;
    throw error;
  });
  const grammar = await language;
  const parser = new Parser();
  parser.setLanguage(grammar);
  return parser;
}

export function movedProjectPaths(tree: Snapshot['tree'], moves: readonly PathMove[]) {
  const paths = new Map<string, string>();
  for (const file of tree) {
    let path = file.path;
    for (const move of moves) {
      if (move.type === 'renameFile' && move.fileId === file.fileId) path = move.path;
      if (move.type === 'renameDirectory' && inFolder(path, move.path))
        path = move.newPath + path.slice(move.path.length);
    }
    paths.set(file.path, path.normalize('NFC'));
  }
  return paths;
}

function resolvePath(source: string, path: string): string | undefined {
  const parts = path.startsWith('/') ? [] : parentFolder(source).split('/').filter(Boolean);
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) return;
      parts.pop();
    } else parts.push(part);
  }
  return parts.join('/');
}

function relativePath(source: string, target: string) {
  const directory = parentFolder(source).split('/').filter(Boolean);
  const parts = target.split('/');
  let shared = 0;
  while (shared < directory.length && directory[shared] === parts[shared]) shared++;
  return [...Array<string>(directory.length - shared).fill('..'), ...parts.slice(shared)].join('/');
}

function stringValue(node: Node) {
  return node.text
    .slice(1, -1)
    .replace(/\\(?:u\{([0-9a-fA-F]{1,6})\}|["\\])/gu, (escape, hex?: string) => {
      if (!hex) return escape.slice(1);
      const point = Number.parseInt(hex, 16);
      return point <= 0x10ffff ? String.fromCodePoint(point) : escape;
    });
}

function expressions(node: Node) {
  return node.namedChildren.filter((child) => child.type !== 'comment');
}

function* literalPaths(node: Node, bibliography = false): Generator<Node> {
  if (node.type === 'string' && !node.hasError) yield node;
  if (node.type === 'group' && !node.hasError) {
    const children = expressions(node);
    if (bibliography || (children.length === 1 && !node.children.some((c) => c.type === ','))) {
      for (const child of children) yield* literalPaths(child, bibliography);
    }
  }
}

function moduleName(path: string) {
  const name = path.split('/').at(-1) ?? '';
  const extension = name.lastIndexOf('.');
  return extension > 0 ? name.slice(0, extension) : name;
}

function locallyBoundNames(nodes: readonly Node[]) {
  const names = new Set<string>();
  function addPattern(pattern: Node) {
    if (pattern.type === 'ident') names.add(pattern.text);
    for (const child of pattern.namedChildren) addPattern(child);
  }
  for (const node of nodes) {
    const pattern = node.childForFieldName('pattern');
    if (pattern) addPattern(pattern);
    if (node.type !== 'import') continue;
    const [source, ...bindings] = expressions(node);
    if (!bindings.length && source?.type === 'string') {
      const path = stringValue(source);
      names.add(
        path.startsWith('@') ? (path.split('/').at(-1)?.split(':')[0] ?? '') : moduleName(path),
      );
    }
    for (const binding of bindings) {
      if (binding.type === 'wildcard') names.add('*');
      else addPattern(binding);
    }
  }
  return names;
}

export function rewriteTypstReferences(
  parser: Parser,
  content: string,
  source: string,
  paths: ReadonlyMap<string, string>,
) {
  const destination = paths.get(source) ?? source;
  const tree = parser.parse(content);
  if (!tree) throw new Error('Не вдалося прочитати посилання Typst.');
  try {
    const edits: { from: number; to: number; text: string }[] = [];
    function record(literal: Node, packageAllowed: boolean, implicitImport?: Node) {
      const path = stringValue(literal);
      if (!path || (packageAllowed && path.startsWith('@'))) return;
      const target = resolvePath(source, path);
      const nextTarget = target === undefined ? undefined : paths.get(target);
      if (!nextTarget || resolvePath(destination, path) === nextTarget) return;
      let replacement = path.startsWith('/')
        ? `/${nextTarget}`
        : relativePath(destination, nextTarget);
      if (packageAllowed && replacement.startsWith('@')) replacement = `./${replacement}`;
      edits.push({
        from: literal.startIndex,
        to: literal.endIndex,
        text: JSON.stringify(replacement),
      });
      if (implicitImport && target) {
        const oldName = moduleName(target);
        if (
          oldName !== moduleName(nextTarget) &&
          !typstKeyword.test(oldName) &&
          /^(?:\p{ID_Start}|_)[\p{ID_Continue}_-]*$/u.test(oldName)
        ) {
          edits.push({
            from: implicitImport.endIndex,
            to: implicitImport.endIndex,
            text: ` as ${oldName}`,
          });
        }
      }
    }

    const syntax: Node[] = [];
    const nodes = [tree.rootNode];
    while (nodes.length) {
      const node = nodes.pop()!;
      if (node.isError) continue;
      const children = node.namedChildren;
      for (let i = children.length - 1; i >= 0; i--) nodes.push(children[i]!);
      if (
        ['call', 'for', 'import', 'include', 'lambda', 'let'].includes(node.type) &&
        !node.hasError
      )
        syntax.push(node);
    }
    const bindings = locallyBoundNames(syntax);
    const implicitImports = new Set<number>();
    for (const node of syntax) {
      if (node.type === 'include' || node.type === 'import') {
        const [source, ...items] = expressions(node);
        if (!source) continue;
        const implicit = node.type === 'import' && !items.length ? source : undefined;
        for (const literal of literalPaths(source)) record(literal, true, implicit);
        if (implicit) implicitImports.add(implicit.id);
      } else if (node.type === 'call') {
        const [callee, group] = expressions(node);
        if (!callee || group?.type !== 'group') continue;
        const qualified = callee.type === 'field' && callee.text.startsWith('std.');
        if (!qualified && callee.type !== 'ident') continue;
        const name = qualified ? callee.text.slice(4) : callee.text;
        if (!pathFunctions.has(name) || bindings.has('*') || bindings.has(qualified ? 'std' : name))
          continue;
        const argument = expressions(group).find((child) => child.type !== 'tagged');
        if (argument)
          for (const literal of literalPaths(argument, name === 'bibliography'))
            record(
              literal,
              false,
              name === 'path' && implicitImports.has(node.id) ? node : undefined,
            );
      }
    }
    let result = '';
    let from = 0;
    for (const edit of edits.sort((a, b) => a.from - b.from)) {
      if (edit.from < from) continue;
      result += content.slice(from, edit.from) + edit.text;
      from = edit.to;
    }
    return result + content.slice(from);
  } finally {
    tree.delete();
  }
}
