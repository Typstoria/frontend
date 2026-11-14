const formats = {
  png: ['image/png', 'image/apng'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  gif: ['image/gif'],
  webp: ['image/webp'],
  pdf: ['application/pdf'],
  ttf: ['font/ttf'],
  otf: ['font/otf'],
  woff: ['font/woff'],
  woff2: ['font/woff2'],
} as const;

export const resourceAccept = Object.keys(formats)
  .map((ext) => `.${ext}`)
  .join(',');
export const maxResourceBytes = 10 * 1024 * 1024;

function mediaTypes(path: string): readonly string[] {
  const ext = path.split('.').at(-1)?.toLowerCase() ?? '';
  return Object.hasOwn(formats, ext) ? formats[ext as keyof typeof formats] : [];
}

export function matchesResourceType(path: string, mediaType: string) {
  return mediaTypes(path).includes(mediaType);
}

export function compatibleResourcePaths(source: string, target: string) {
  const targetTypes = mediaTypes(target);
  return mediaTypes(source).some((type) => targetTypes.includes(type));
}
