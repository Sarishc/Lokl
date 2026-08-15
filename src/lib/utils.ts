import { clsx } from 'clsx';
import { differenceInHours, differenceInMinutes, format, formatDistanceToNow } from 'date-fns';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: Array<string | false | null | undefined>) {
  return twMerge(clsx(inputs));
}

export function currency(value: number, isFree = false) {
  if (isFree || value === 0) return 'Free';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

export function timeAgo(dateString: string) {
  return formatDistanceToNow(new Date(dateString), { addSuffix: true });
}

export function hoursSince(dateString: string) {
  return differenceInHours(new Date(), new Date(dateString));
}

export function formatChatTime(dateString: string) {
  const date = new Date(dateString);
  const mins = differenceInMinutes(new Date(), date);
  const hrs = differenceInHours(new Date(), date);
  if (mins < 1) return 'now';
  if (hrs < 24) return format(date, 'hh:mm a');
  return format(date, 'dd MMM');
}

export function groupDateLabel(dateString: string) {
  const date = new Date(dateString);
  return format(date, 'EEEE, dd MMM');
}

export function vibrate(pattern: number | number[] = 12) {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function compressImage(file: File, maxSizeKb = 500) {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    if (file.size / 1024 <= maxSizeKb) return file;
    throw new Error('This image format could not be compressed. Try a JPG or PNG under 500KB.');
  }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  let width = bitmap.width;
  let height = bitmap.height;
  const maxSide = 1600;
  if (width > maxSide || height > maxSide) {
    const ratio = Math.min(maxSide / width, maxSide / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(bitmap, 0, 0, width, height);

  let quality = 0.9;
  let blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  while (blob && blob.size / 1024 > maxSizeKb && quality > 0.4) {
    quality -= 0.1;
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  }

  if (!blob) throw new Error('Image compression failed');
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
}

export async function fileToDataUrl(file: File) {
  const compactFile = file.type.startsWith('image/') ? await compressImage(file, 420) : file;
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(compactFile);
  });
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function clamp(num: number, min: number, max: number) {
  return Math.min(max, Math.max(min, num));
}
