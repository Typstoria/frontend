import { expect, it } from 'vitest';
import { createReferenceParser, rewriteTypstReferences } from './typst-references';

it('updates literal references while preserving import bindings and unrelated text', async () => {
  const parser = await createReferenceParser();
  try {
    const paths = new Map([
      ['main.typ', 'main.typ'],
      ['old.typ', 'lib/new.typ'],
      ['foo.png', 'assets/foo.png'],
      ['book.bib', 'data/book.bib'],
    ]);
    const content = [
      '= 💡 Document',
      '#import "old.typ"',
      '#import "old.typ": chapter as selected',
      '#include /* comment */ "old.typ"',
      '#let image(x) = x',
      '#image("foo.png")',
      '#std.image("/foo.png", alt: "foo.png")',
      '#bibliography(("book.bib", "other.bib"))',
      '// #include "old.typ"',
      '`#include "old.typ"`',
      '#include "old" + ".typ"',
    ].join('\n');
    expect(rewriteTypstReferences(parser, content, 'main.typ', paths)).toBe(
      [
        '= 💡 Document',
        '#import "lib/new.typ" as old',
        '#import "lib/new.typ": chapter as selected',
        '#include /* comment */ "lib/new.typ"',
        '#let image(x) = x',
        '#image("foo.png")',
        '#std.image("/assets/foo.png", alt: "foo.png")',
        '#bibliography(("data/book.bib", "other.bib"))',
        '// #include "old.typ"',
        '`#include "old.typ"`',
        '#include "old" + ".typ"',
      ].join('\n'),
    );
  } finally {
    parser.delete();
  }
});
