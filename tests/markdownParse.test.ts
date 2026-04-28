import test from 'node:test';
import assert from 'node:assert/strict';

import { parseMarkdownBlocks } from '../src/lib/markdownParse';

test('parseMarkdownBlocks parses headings and bullets', () => {
  const md = `# 个人简历

## 项目经历
- 做了 A
- 做了 B

一段正文`;

  const blocks = parseMarkdownBlocks(md);
  assert.deepEqual(blocks, [
    { type: 'heading', level: 1, text: '个人简历' },
    { type: 'heading', level: 2, text: '项目经历' },
    { type: 'bullet', text: '做了 A' },
    { type: 'bullet', text: '做了 B' },
    { type: 'paragraph', text: '一段正文' },
  ]);
});

