// Design Ref: §2.1 — YouTube 자막 추출 (Infrastructure layer)

import { YoutubeTranscript } from "youtube-transcript";

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function isValidYoutubeUrl(url: string): boolean {
  return extractVideoId(url) !== null;
}

export async function fetchTranscript(
  videoId: string
): Promise<{ text: string; language: string }> {
  const segments = await YoutubeTranscript.fetchTranscript(videoId);

  if (!segments || segments.length === 0) {
    throw new Error("NO_TRANSCRIPT");
  }

  const text = segments.map((s) => s.text).join(" ");

  // youtube-transcript doesn't expose language directly; default to "unknown"
  return { text, language: "auto" };
}
