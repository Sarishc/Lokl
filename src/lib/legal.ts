export const LEGAL_CONSENT_VERSION = '2026-07-01';
export const LEGAL_CONSENT_KEY = `lokl-legal-consent-${LEGAL_CONSENT_VERSION}`;

export type LegalConsentRecord = {
  version: string;
  acceptedAt: string;
};

export function recordLegalConsent() {
  const record: LegalConsentRecord = {
    version: LEGAL_CONSENT_VERSION,
    acceptedAt: new Date().toISOString(),
  };
  localStorage.setItem(LEGAL_CONSENT_KEY, JSON.stringify(record));
  return record;
}

export function getLegalConsent(): LegalConsentRecord | null {
  try {
    const raw = localStorage.getItem(LEGAL_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LegalConsentRecord>;
    if (parsed.version !== LEGAL_CONSENT_VERSION || !parsed.acceptedAt) return null;
    return { version: parsed.version, acceptedAt: parsed.acceptedAt };
  } catch {
    return null;
  }
}
