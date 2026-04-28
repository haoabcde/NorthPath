import test from 'node:test';
import assert from 'node:assert/strict';

import { estimatePdfPages } from '../src/lib/pageEstimate';

test('estimatePdfPages returns 1 for single page', () => {
  const pages = estimatePdfPages({
    canvasWidth: 1000,
    canvasHeight: 1200,
    pdfWidth: 210,
    pageHeight: 297,
  });
  assert.equal(pages, 1);
});

test('estimatePdfPages returns 2 for overflow', () => {
  const pages = estimatePdfPages({
    canvasWidth: 1000,
    canvasHeight: 2000,
    pdfWidth: 210,
    pageHeight: 297,
  });
  assert.equal(pages, 2);
});

