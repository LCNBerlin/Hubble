import { apiPost } from "./api";

export const HASHTAG_REGEX = /#([a-zA-Z0-9_]+)/g;

export function getHashtagsFromText(text: string | null | undefined): string[] {
  if (!text || typeof text !== "string") return [];
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(HASHTAG_REGEX.source, "g");
  while ((m = re.exec(text)) !== null) {
    names.add(m[1].toLowerCase());
  }
  return [...names];
}

export function getHashtagsFromPostContent(title: string | null | undefined, body: string | null | undefined): string[] {
  const combined = [title, body].filter(Boolean).join(" ");
  return getHashtagsFromText(combined);
}

export type HashtagSegment = { type: "text"; value: string } | { type: "hashtag"; value: string };

export function parseHashtagSegments(text: string | null | undefined): HashtagSegment[] {
  if (!text || typeof text !== "string") return [];
  const segments: HashtagSegment[] = [];
  const re = new RegExp(HASHTAG_REGEX.source, "g");
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, m.index) });
    }
    segments.push({ type: "hashtag", value: m[1] });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }
  return segments;
}

/** Sync post hashtags via NestJS API. Call after inserting or updating a post. */
export async function syncPostHashtags(_client: unknown, postId: string, tagNames: string[]): Promise<void> {
  apiPost(`/posts/${postId}/hashtags`, { tagNames }).catch(() => {});
}
