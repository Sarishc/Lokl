import { useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { takePhoto, chooseFromLibrary, type ImagePickResult } from './image';

// The one place Capacitor.isNativePlatform() is checked for image capture — pages
// use this component instead of a raw <input type="file">, so the branching never
// scatters across src/pages/*. See the Step 2 report's Task 2 write-up for why a
// single component (not a hook, not per-page checks) is the right shape here: the
// web and native paths render genuinely different UI (a plain file input vs. a
// native action sheet), not just different data-fetching, so the abstraction has
// to own rendering, not just return a value.
export function ImagePicker({
  multiple,
  limit,
  accept = 'image/*',
  className,
  inputClassName = 'hidden',
  children,
  onFiles,
  onDenied,
  onCancelled,
  onError,
}: {
  multiple?: boolean;
  limit?: number;
  accept?: string;
  className?: string;
  inputClassName?: string;
  children: ReactNode;
  onFiles: (files: File[]) => void;
  onDenied?: (source: 'camera' | 'photos') => void;
  onCancelled?: () => void;
  onError?: (message: string) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  function handleResult(result: ImagePickResult) {
    if (result.status === 'ok') onFiles(result.files);
    else if (result.status === 'denied') onDenied?.(result.source);
    else if (result.status === 'cancelled') onCancelled?.();
    else onError?.(result.message);
  }

  if (!Capacitor.isNativePlatform()) {
    // Web: byte-for-byte the same <input type="file"> markup and onChange wiring
    // this replaces, so scripts/smoke-e2e.cjs and scripts/release-e2e.cjs — which
    // locate this element directly via input[type="file"][accept="image/*"] /
    // input[type="file"][multiple] — keep passing without modification.
    return (
      <label className={className}>
        {children}
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          className={inputClassName}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            if (files.length) onFiles(files);
          }}
        />
      </label>
    );
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setSheetOpen(true)}>
        {children}
      </button>
      {sheetOpen ? (
        <PhotoSourceSheet
          onCancel={() => setSheetOpen(false)}
          onTakePhoto={async () => {
            setSheetOpen(false);
            handleResult(await takePhoto());
          }}
          onChooseLibrary={async () => {
            setSheetOpen(false);
            handleResult(await chooseFromLibrary({ multiple, limit }));
          }}
        />
      ) : null}
    </>
  );
}

function PhotoSourceSheet({ onCancel, onTakePhoto, onChooseLibrary }: { onCancel: () => void; onTakePhoto: () => void; onChooseLibrary: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 px-4 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="absolute bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 space-y-3 rounded-t-[28px] border border-white/10 bg-[color:var(--color-ink)] p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left font-medium" onClick={onTakePhoto}>
          Take Photo
        </button>
        <button type="button" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left font-medium" onClick={onChooseLibrary}>
          Choose from Library
        </button>
        <button type="button" className="w-full rounded-2xl px-4 py-3 text-center text-[color:var(--color-text-muted)]" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
