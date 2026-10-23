// /dev is hidden on the production deploy (VERCEL_ENV=production): the page calls notFound() before
// rendering anything. The values below are fake placeholders, only there so production startup passes.

import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  Object.assign(process.env, {
    VERCEL_ENV: 'production',
    RULEBOOK_ALLOW_UNREVIEWED: 'false',
    NEXT_PUBLIC_SUPABASE_URL: 'https://fake-project.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fake-anon-key-not-real-0000',
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'fake-site-key-0000',
    SUPABASE_SERVICE_ROLE_KEY: 'fake-service-key-not-real-0000',
    AZURE_VISION_ENDPOINT: 'https://fake.cognitiveservices.azure.com/',
    AZURE_VISION_KEY: 'fake-azure-key-0000',
    CRON_SECRET: 'c'.repeat(40),
    HEALTH_SECRET: 'h'.repeat(40),
  });
});

const notFound = vi.hoisted(() => vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }));
vi.mock('next/navigation', () => ({ notFound }));
vi.mock('next/server', () => ({ connection: async () => {} }));
vi.mock('../../app/dev/DevConsole', () => ({ default: () => null }));

describe('/dev in production', () => {
  it('isProduction is true and the page is a 404', async () => {
    const { isProduction } = await import('../../lib/config/env.js');
    expect(isProduction).toBe(true);
    const { default: DevPage } = await import('../../app/dev/page.jsx');
    await expect(DevPage()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
