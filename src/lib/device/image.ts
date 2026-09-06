import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

// Structural, not Camera's own `Photo` type — getPhoto() returns `Photo`,
// pickImages() returns `GalleryPhoto[]`, and this is the subset both share.
type CapturedPhoto = { webPath?: string; format?: string };

// Single call site for "get me an image file" across web and native, used for
// avatar capture/edit and listing photos. Returns a plain File[] on success so
// every existing call site's compression/upload code (compressImage, api.uploadImage
// in src/lib/utils.ts / src/services/api.ts) keeps working completely unchanged —
// this module only replaces where the File comes from, never what happens to it
// after. See docs/audit/FINDINGS.md LOKL-001/004 and the Step 2 report's Task 4.
export type ImagePickResult =
  | { status: 'ok'; files: File[] }
  | { status: 'cancelled' }
  | { status: 'denied'; source: 'camera' | 'photos' }
  | { status: 'error'; message: string };

// Capacitor's documented native error codes (README.md "Error Codes" table).
const CAMERA_DENIED = 'OS-PLUG-CAMR-0003';
const PHOTOS_DENIED = 'OS-PLUG-CAMR-0005';
const CAMERA_CANCELLED = 'OS-PLUG-CAMR-0006';
const PHOTOS_CANCELLED = 'OS-PLUG-CAMR-0020';

function classifyError(error: unknown, source: 'camera' | 'photos'): ImagePickResult {
  const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code: unknown }).code : undefined;
  if (code === CAMERA_DENIED || code === PHOTOS_DENIED) return { status: 'denied', source };
  if (code === CAMERA_CANCELLED || code === PHOTOS_CANCELLED) return { status: 'cancelled' };
  const message = error instanceof Error ? error.message : String(error);
  // Web's file-input fallback (no native bridge) rejects with a plain
  // CapacitorException("User cancelled photos app") — no structured code.
  if (/cancel/i.test(message)) return { status: 'cancelled' };
  return { status: 'error', message };
}

async function photoToFile(photo: CapturedPhoto, index: number): Promise<File> {
  if (!photo.webPath) throw new Error('No image data was returned.');
  const response = await fetch(photo.webPath);
  const blob = await response.blob();
  const ext = photo.format || 'jpeg';
  return new File([blob], `photo-${Date.now()}-${index}.${ext}`, { type: blob.type || `image/${ext}` });
}

export async function takePhoto(): Promise<ImagePickResult> {
  try {
    const photo = await Camera.getPhoto({ source: CameraSource.Camera, resultType: CameraResultType.Uri, quality: 90 });
    return { status: 'ok', files: [await photoToFile(photo, 0)] };
  } catch (error) {
    return classifyError(error, 'camera');
  }
}

export async function chooseFromLibrary(options: { multiple?: boolean; limit?: number } = {}): Promise<ImagePickResult> {
  try {
    if (options.multiple) {
      const result = await Camera.pickImages({ quality: 90, limit: options.limit });
      const files = await Promise.all(result.photos.map((photo, index) => photoToFile(photo, index)));
      return { status: 'ok', files };
    }
    const photo = await Camera.getPhoto({ source: CameraSource.Photos, resultType: CameraResultType.Uri, quality: 90 });
    return { status: 'ok', files: [await photoToFile(photo, 0)] };
  } catch (error) {
    return classifyError(error, 'photos');
  }
}
