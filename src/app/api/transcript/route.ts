// Design Ref: §4 — API Route (자막 추출)
// 2단계 폴백: InnerTube ANDROID → YouTube 웹 페이지 파싱

import { NextRequest, NextResponse } from "next/server";
import type { TranscriptResponse, ErrorResponse } from "@/types";

export const runtime = "edge";

const ANDROID_VERSION = "20.10.38";
const ANDROID_UA = `com.google.android.youtube/${ANDROID_VERSION} (Linux; U; Android 14)`;
const WEB_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)";

function extractVideoId(url: string): string | null {
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

function isValidYoutubeUrl(url: string): boolean {
  return extractVideoId(url) !== null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(parseInt(dec, 10))
    )
    .replace(/\n/g, " ");
}

function parseTranscriptXml(xml: string): string[] {
  const segments: string[] = [];
  let match;

  // 새 형식: <p t="..." d="..."><s>text</s></p>
  const newRegex = /<p\s+t="\d+"\s+d="\d+"[^>]*>([\s\S]*?)<\/p>/g;
  while ((match = newRegex.exec(xml)) !== null) {
    const inner = match[1];
    const sTexts: string[] = [];
    const sRegex = /<s[^>]*>([^<]*)<\/s>/g;
    let sMatch;
    while ((sMatch = sRegex.exec(inner)) !== null) {
      sTexts.push(sMatch[1]);
    }
    const text =
      sTexts.length > 0 ? sTexts.join("") : inner.replace(/<[^>]+>/g, "");
    if (text.trim()) segments.push(decodeEntities(text.trim()));
  }
  if (segments.length > 0) return segments;

  // 구 형식: <text start="..." dur="...">text</text>
  const oldRegex = /<text[^>]*>(.*?)<\/text>/g;
  while ((match = oldRegex.exec(xml)) !== null) {
    const decoded = decodeEntities(match[1]);
    if (decoded.trim()) segments.push(decoded.trim());
  }
  return segments;
}

// 방법 1: InnerTube ANDROID API
async function fetchViaInnerTube(
  videoId: string
): Promise<{ text: string; language: string } | null> {
  try {
    const res = await fetch(
      "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": ANDROID_UA,
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: "ANDROID",
              clientVersion: ANDROID_VERSION,
            },
          },
          videoId,
        }),
      }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const tracks =
      data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!Array.isArray(tracks) || tracks.length === 0) return null;

    const capRes = await fetch(tracks[0].baseUrl, {
      headers: { "User-Agent": ANDROID_UA },
    });
    const xml = await capRes.text();
    if (!xml) return null;

    const segments = parseTranscriptXml(xml);
    if (segments.length === 0) return null;

    return { text: segments.join(" "), language: tracks[0].languageCode || "auto" };
  } catch {
    return null;
  }
}

// 방법 2: YouTube 웹 페이지에서 ytInitialPlayerResponse 파싱
async function fetchViaWebPage(
  videoId: string
): Promise<{ text: string; language: string } | null> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent": WEB_UA,
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });
    if (!res.ok) return null;

    const html = await res.text();

    // ytInitialPlayerResponse에서 자막 트랙 추출
    const varName = "var ytInitialPlayerResponse = ";
    const varIdx = html.indexOf(varName);
    if (varIdx === -1) return null;

    const jsonStart = varIdx + varName.length;
    let depth = 0;
    let jsonEnd = -1;
    for (let i = jsonStart; i < html.length; i++) {
      if (html[i] === "{") depth++;
      if (html[i] === "}") {
        depth--;
        if (depth === 0) {
          jsonEnd = i;
          break;
        }
      }
    }
    if (jsonEnd === -1) return null;

    const playerData = JSON.parse(html.slice(jsonStart, jsonEnd + 1));
    const tracks =
      playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!Array.isArray(tracks) || tracks.length === 0) return null;

    // 자막 XML 가져오기 — 웹 UA 사용
    const capRes = await fetch(tracks[0].baseUrl, {
      headers: { "User-Agent": WEB_UA },
    });
    const xml = await capRes.text();
    if (!xml) return null;

    const segments = parseTranscriptXml(xml);
    if (segments.length === 0) return null;

    return { text: segments.join(" "), language: tracks[0].languageCode || "auto" };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || !isValidYoutubeUrl(url)) {
      return NextResponse.json<ErrorResponse>(
        { error: { code: "INVALID_URL", message: "유효하지 않은 유튜브 URL입니다" } },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url)!;

    // 방법 1 시도: InnerTube ANDROID
    const result1 = await fetchViaInnerTube(videoId);
    if (result1) {
      return NextResponse.json<TranscriptResponse>({
        videoId,
        text: result1.text,
        language: result1.language,
      });
    }

    // 방법 2 시도: 웹 페이지 파싱
    const result2 = await fetchViaWebPage(videoId);
    if (result2) {
      return NextResponse.json<TranscriptResponse>({
        videoId,
        text: result2.text,
        language: result2.language,
      });
    }

    return NextResponse.json<ErrorResponse>(
      { error: { code: "NO_TRANSCRIPT", message: "이 영상에서 자막을 추출할 수 없습니다. 자막이 없거나 접근이 제한되었습니다." } },
      { status: 404 }
    );
  } catch {
    return NextResponse.json<ErrorResponse>(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요" } },
      { status: 500 }
    );
  }
}
