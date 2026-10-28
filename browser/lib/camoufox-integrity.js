import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { pathToFileURL } from 'node:url';

// GitHub-published release asset digests, not locally invented checksums.
// Source and update procedure: .github/browser-tests-provenance.md.
export const CAMOUFOX_ASSET_SHA256 = Object.freeze({
  'camoufox-152.0.4-beta.30-lin.arm64.zip': '60447260af8bebdb0ec3f2aa72f687b879e5598367303de2e3fdbc7a5be8c124',
  'camoufox-152.0.4-beta.30-lin.x86_64.zip': '5720d45b894ce1770543de024c6f10d514b38be560fa2dc3226b3d8586caf672',
  'camoufox-152.0.4-beta.30-mac.arm64.zip': '3b43e766574f286a6a63296cf58b660b7a3120952086c869b4df4c9a71604bc3',
  'camoufox-152.0.4-beta.30-mac.x86_64.zip': 'f12f90a3650478e670064a2f071c13b998fdd1125f79dc9f6cad5a9b9395b4bc',
  'camoufox-152.0.4-beta.30-win.i686.zip': '01bd3383af3707f7f44f39f91f060a40e0d5909146ec6fdb439687bf4d4e4fac',
  'camoufox-152.0.4-beta.30-win.x86_64.zip': 'ea52a02fb1cfb1813ef6a326bea03fb2b650c9774143d953a94a27bfc8f10072',
});

export async function verifyCamoufoxArchive(file, assetName) {
  const expected = Object.hasOwn(CAMOUFOX_ASSET_SHA256, assetName) ? CAMOUFOX_ASSET_SHA256[assetName] : null;
  if (!expected) throw new Error(`No pinned SHA-256 for Camoufox asset: ${assetName}`);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  if (hash.digest('hex') !== expected) throw new Error(`SHA-256 mismatch for Camoufox asset: ${assetName}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyCamoufoxArchive(process.argv[2], process.argv[3]).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
