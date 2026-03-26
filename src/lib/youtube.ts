// Design Ref: §2.1 — YouTube 자막 추출 (클라이언트 사이드)

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
  // YouTube 영상 페이지에서 자막 데이터를 가져옴
  const response = await fetch(
    `https://www.youtube.com/watch?v=${videoId}`
  );
  const html = await response.text();

  // captionTracks에서 자막 URL 추출
  const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
  if (!captionMatch) {
    throw new Error("NO_TRANSCRIPT");
  }

  let captionTracks;
  try {
    captionTracks = JSON.parse(captionMatch[1]);
  } catch {
    throw new Error("NO_TRANSCRIPT");
  }

  if (!captionTracks || captionTracks.length === 0) {
    throw new Error("NO_TRANSCRIPT");
  }

  const track = captionTracks[0];
  const captionUrl = track.baseUrl;
  const language = track.languageCode || "auto";

  // 자막 XML 가져오기
  const captionResponse = await fetch(captionUrl);
  const captionXml = await captionResponse.text();

  // XML에서 텍스트 추출
  const textSegments: string[] = [];
  const regex = /<text[^>]*>(.*?)<\/text>/g;
  let match;
  while ((match = regex.exec(captionXml)) !== null) {
    const decoded = match[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, " ");
    textSegments.push(decoded);
  }

  if (textSegments.length === 0) {
    throw new Error("NO_TRANSCRIPT");
  }

  return { text: textSegments.join(" "), language };
}
