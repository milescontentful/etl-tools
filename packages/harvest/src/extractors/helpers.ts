export function makeAbsolute(src: string, baseUrl: string): string {
  if (!src) return '';
  try {
    const base = new URL(baseUrl);
    if (src.startsWith('//')) return `https:${src}`;
    if (src.startsWith('/')) return `${base.origin}${src}`;
    if (!src.startsWith('http')) return `${base.origin}/${src}`;
    return src;
  } catch {
    return src;
  }
}
