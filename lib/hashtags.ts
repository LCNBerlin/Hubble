import type { SupabaseClient } from "@supabase/supabase-js";

/** Matches #word (letters, numbers, underscore). Use for parsing and display. */
export const HASHTAG_REGEX = /#([a-zA-Z0-9_]+)/g;

/**
 * Extract unique hashtag names from text (title/body), normalized to lowercase.
 */
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

/**
 * Parse title and body together and return unique lowercase tag names.
 */
export function getHashtagsFromPostContent(title: string | null | undefined, body: string | null | undefined): string[] {
  const combined = [title, body].filter(Boolean).join(" ");
  return getHashtagsFromText(combined);
}

export type HashtagSegment = { type: "text"; value: string } | { type: "hashtag"; value: string };

/**
 * Split text into segments of plain text and hashtags (for rendering tappable hashtags).
 */
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

/**
 * Upsert hashtags by name (lowercase), then replace post_hashtags for this post with the new set.
 * Call after inserting or updating a post.
 */
export async function syncPostHashtags(
  client: SupabaseClient | null,
  postId: string,
  tagNames: string[]
): Promise<void> {
  if (!client || tagNames.length === 0) {
    if (client && postId) {
      await client.from("post_hashtags").delete().eq("post_id", postId);
    }
    return;
  }

  const uniqueNames = [...new Set(tagNames.map((n) => n.toLowerCase()).filter(Boolean))];
  if (uniqueNames.length === 0) {
    await client.from("post_hashtags").delete().eq("post_id", postId);
    return;
  }

  const ids: string[] = [];
  for (const name of uniqueNames) {
    const { data: existing } = await client.from("hashtags").select("id").eq("name", name).maybeSingle();
    if (existing?.id) {
      ids.push(existing.id);
    } else {
      const { data: inserted, error } = await client.from("hashtags").insert({ name }).select("id").single();
      if (!error && inserted?.id) ids.push(inserted.id);
    }
  }

  await client.from("post_hashtags").delete().eq("post_id", postId);
  if (ids.length > 0) {
    await client.from("post_hashtags").insert(ids.map((hashtag_id) => ({ post_id: postId, hashtag_id })));
  }
}
