/// <reference types="vite/client" />

// Injected by vite.config.ts's `define`, from the same validated VITE_APP_MODE that
// src/lib/app-mode.ts checks at runtime. A true compile-time literal (not an imported
// const) so that `if (__IS_MOCK_MODE__)` branches are statically eliminable — see
// docs/audit/FINDINGS.md LOKL-004/017 and Step 1 Task 2.
declare const __IS_MOCK_MODE__: boolean;
