import test from 'node:test';
import assert from 'node:assert/strict';

import { RESUME_TEMPLATES, getTemplateClassName } from '../src/lib/templates';

test('RESUME_TEMPLATES contains default templates', () => {
  const ids = RESUME_TEMPLATES.map((t) => t.id);
  assert.deepEqual(ids, ['classic', 'compact', 'modern']);
});

test('getTemplateClassName returns expected class name', () => {
  assert.equal(getTemplateClassName('classic'), 'template-classic');
  assert.equal(getTemplateClassName('compact'), 'template-compact');
  assert.equal(getTemplateClassName('modern'), 'template-modern');
});

