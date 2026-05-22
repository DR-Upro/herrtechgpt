// Unicode-safe string truncation: splits by code points, not UTF-16 units,
// so it never cuts through an emoji's surrogate pair.
export function safeTruncate(input: string, maxCodePoints: number): string {
  const points = Array.from(input);
  if (points.length <= maxCodePoints) return stripLoneSurrogates(input);
  return stripLoneSurrogates(points.slice(0, maxCodePoints).join(""));
}

// Belt-and-braces: strip any lone high/low surrogates that slipped through
// upstream (e.g. truncated TikTok captions from the scraper).
export function stripLoneSurrogates(input: string): string {
  return input.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    "",
  );
}
