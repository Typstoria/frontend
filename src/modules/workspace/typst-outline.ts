import { createTypstParser } from './typst-references';
import type { OutlineItem } from './workspace-outline';

export async function createTypstOutlineParser() {
  const parser = await createTypstParser();
  return {
    parse(source: string): OutlineItem[] {
      const tree = parser.parse(source);
      if (!tree) return [];
      const cursor = tree.walk();
      try {
        const items: OutlineItem[] = [];
        do {
          if (cursor.nodeType === 'heading') {
            const node = cursor.currentNode;
            const marker = /^(=+)\s*/u.exec(node.text);
            const label = node.text
              .slice(marker?.[0].length ?? 0)
              .replace(/\s+<[^<>]+>\s*$/u, '')
              .trim();
            if (marker && label) {
              const { row, column } = node.startPosition;
              items.push({
                label: label.slice(0, 300),
                position: { line: row, character: column },
                depth: marker[1]!.length - 1,
              });
            }
          } else if (cursor.gotoFirstChild()) continue;
          while (!cursor.gotoNextSibling()) {
            if (!cursor.gotoParent()) return items;
          }
        } while (items.length < 500);
        return items;
      } finally {
        cursor.delete();
        tree.delete();
      }
    },
    close: () => parser.delete(),
  };
}
