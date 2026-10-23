// lib/health/checks.js with fake database, OCR and Gemini: every check reports ok / fail / busy /
// skipped and never throws. The bundled label is a real PNG that the image pipeline accepts.

import { describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
import { checkDb, runRetention, checkOcr, checkLlm } from '../../lib/health/checks.js';
import { SAMPLE_LABEL_PNG, EXPECTED_TEXT } from '../../lib/health/sampleLabel.js';

const query = (result) => ({ from: () => ({ select: () => ({ limit: async () => result }) }), rpc: vi.fn(async () => result) });

describe('database checks', () => {
  it('ping ok / error / throws', async () => {
    expect(await checkDb({ db: query({ error: null }) })).toMatchObject({ status: 'ok' });
    expect(await checkDb({ db: query({ error: { message: 'relation missing' } }) })).toMatchObject({ status: 'fail', detail: 'relation missing' });
    expect(await checkDb({ db: { from: () => { throw new Error('boom'); } } })).toMatchObject({ status: 'fail', detail: 'boom' });
  });

  it('no Supabase keys: skipped', async () => {
    expect(await checkDb()).toMatchObject({ status: 'skipped' });
    expect(await runRetention()).toMatchObject({ status: 'skipped' });
  });

  it('retention calls apply_retention with SCAN_RETENTION_DAYS', async () => {
    const db = query({ error: null });
    expect(await runRetention({ db })).toMatchObject({ status: 'ok' });
    expect(db.rpc).toHaveBeenCalledWith('apply_retention', { scan_days: 90 });
  });
});

describe('OCR check', () => {
  const open = async () => ({ allowed: true });
  it('reads the bundled label', async () => {
    const readLabel = vi.fn(async () => ({ ok: true, raw: '原材料名：砂糖、小麦粉\n内容量：100g' }));
    expect(await checkOcr({ readLabel, reserveOcr: open })).toMatchObject({ status: 'ok' });
    expect(readLabel).toHaveBeenCalledWith(SAMPLE_LABEL_PNG);
  });

  it('wrong text, failure, Azure busy, our own budget full', async () => {
    expect(await checkOcr({ readLabel: async () => ({ ok: true, raw: 'abc' }), reserveOcr: open })).toMatchObject({ status: 'fail', detail: 'expected_text_missing' });
    expect(await checkOcr({ readLabel: async () => ({ ok: false, status: 'unavailable', detail: 'auth' }), reserveOcr: open })).toMatchObject({ status: 'fail', detail: 'auth' });
    expect(await checkOcr({ readLabel: async () => ({ ok: false, status: 'busy', detail: 'busy' }), reserveOcr: open })).toMatchObject({ status: 'busy' });
    const readLabel = vi.fn();
    expect(await checkOcr({ readLabel, reserveOcr: async () => ({ allowed: false }) })).toMatchObject({ status: 'busy', detail: 'local_limit' });
    expect(readLabel).not.toHaveBeenCalled();
  });

  it('no Azure keys: skipped', async () => {
    expect(await checkOcr()).toMatchObject({ status: 'skipped' });
  });

  it('the bundled label is a real, readable-size PNG', async () => {
    const m = await sharp(SAMPLE_LABEL_PNG).metadata();
    expect(m.format).toBe('png');
    expect(m.width).toBeGreaterThanOrEqual(50);
    expect(m.height).toBeGreaterThanOrEqual(50);
    expect(EXPECTED_TEXT).toBe('原材料');
  });
});

describe('LLM check', () => {
  it('fixed reply ok / bad reply / error; sends no user data', async () => {
    const generate = vi.fn(async () => ({ ok: true, text: '{"ok": true}' }));
    // LLM_API_KEY is not set in tests, so the check is skipped unless a generator is injected.
    expect(await checkLlm({ generate })).toMatchObject({ status: 'ok' });
    expect(generate.mock.calls[0][0].input).toEqual({ ping: true });
    expect(await checkLlm({ generate: async () => ({ ok: true, text: 'hello' }) })).toMatchObject({ status: 'fail', detail: 'bad_reply' });
    expect(await checkLlm({ generate: async () => ({ ok: true, text: '{"ok": false}' }) })).toMatchObject({ status: 'fail' });
    expect(await checkLlm({ generate: async () => ({ ok: false, status: 'busy', detail: 'busy' }) })).toMatchObject({ status: 'busy' });
    expect(await checkLlm({ generate: async () => { throw new Error('x'); } })).toMatchObject({ status: 'fail' });
  });

  it('no key: skipped', async () => {
    expect(await checkLlm()).toMatchObject({ status: 'skipped' });
  });
});
