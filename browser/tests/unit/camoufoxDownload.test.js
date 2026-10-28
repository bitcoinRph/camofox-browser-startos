import { describe, expect, test, jest, afterEach } from '@jest/globals';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { OS_NAME, CamoufoxFetcher } from 'camoufox-js/dist/pkgman.js';
import { BUNDLED_CAMOUFOX_RELEASE, CompatibleCamoufoxFetcher } from '../../lib/camoufox-download.js';
import { CAMOUFOX_ASSET_SHA256 } from '../../lib/camoufox-integrity.js';

test('pins exactly the six official beta.30 archive asset names', () => {
  expect(Object.keys(CAMOUFOX_ASSET_SHA256).sort()).toEqual([
    'camoufox-152.0.4-beta.30-lin.arm64.zip',
    'camoufox-152.0.4-beta.30-lin.x86_64.zip',
    'camoufox-152.0.4-beta.30-mac.arm64.zip',
    'camoufox-152.0.4-beta.30-mac.x86_64.zip',
    'camoufox-152.0.4-beta.30-win.i686.zip',
    'camoufox-152.0.4-beta.30-win.x86_64.zip',
  ]);
});

describe('bundled Camoufox release selection', () => {
  test('accepts the pinned binary and rejects newer incompatible releases', () => {
    const fetcher = new CompatibleCamoufoxFetcher();
    const asset = (release) => ({
      name: `camoufox-${release}-${OS_NAME}.${fetcher.arch}.zip`,
      browser_download_url: `https://example.invalid/${release}`,
    });

    expect(fetcher.checkAsset(asset(BUNDLED_CAMOUFOX_RELEASE))?.[0].fullString)
      .toBe(BUNDLED_CAMOUFOX_RELEASE);
    expect(fetcher.checkAsset(asset('156.0.1-beta.34'))).toBeNull();
  });
});

describe.each(['Dockerfile', 'Dockerfile.ci'])('%s archive integrity', file => {
  test('verifies the downloaded asset before extraction and ships the npm verifier', () => {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
    const verification = 'node /tmp/camoufox-integrity.mjs /tmp/camoufox.zip "camoufox-${CAMOUFOX_VERSION}-${CAMOUFOX_RELEASE}-lin.${CAMOUFOX_ARCH}.zip"';
    expect(source).toContain(verification);
    expect(source.indexOf(verification)).toBeLessThan(source.indexOf('unzip -q'));
    expect(source).toContain('COPY lib/camoufox-integrity.js /tmp/camoufox-integrity.mjs');
    expect(source).toContain('COPY lib/camoufox-download.js lib/camoufox-integrity.js ./lib/');
  });
});

describe('bundled archive integrity before extraction', () => {
  const directories = [];
  afterEach(() => {
    jest.restoreAllMocks();
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  });

  function fixture(asset) {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'camofox-integrity-test-'));
    directories.push(directory);
    const archive = path.join(directory, 'camoufox.zip');
    writeFileSync(archive, 'corrupted archive');
    const fetcher = new CompatibleCamoufoxFetcher();
    fetcher._url = `https://github.com/daijro/camoufox/releases/download/v${BUNDLED_CAMOUFOX_RELEASE}/${asset}`;
    const extract = jest.spyOn(CamoufoxFetcher.prototype, 'extractZip').mockResolvedValue();
    return { archive, fetcher, extract };
  }

  test('rejects modified bytes before passing the archive to the extractor', async () => {
    const { archive, fetcher, extract } = fixture(`camoufox-${BUNDLED_CAMOUFOX_RELEASE}-lin.x86_64.zip`);
    await expect(fetcher.extractZip(archive)).rejects.toThrow(/SHA-256 mismatch/);
    expect(extract).not.toHaveBeenCalled();
  });

  test('fails closed when no published digest is pinned for the asset', async () => {
    const { archive, fetcher, extract } = fixture('camoufox-unreviewed.zip');
    await expect(fetcher.extractZip(archive)).rejects.toThrow(/No pinned SHA-256/);
    expect(extract).not.toHaveBeenCalled();
  });
});
