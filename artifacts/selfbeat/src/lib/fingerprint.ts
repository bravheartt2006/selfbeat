export async function getFingerprint(): Promise<string> {
  const FingerprintJS = await import("@fingerprintjs/fingerprintjs");
  const fp = await FingerprintJS.default.load();
  const result = await fp.get();
  return result.visitorId;
}
