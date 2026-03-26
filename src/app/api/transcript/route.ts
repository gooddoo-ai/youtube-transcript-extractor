// Design Ref: §4 — API Route (자막 추출)
// InnerTube ANDROID API로 자막 추출 + XML 파싱

import { NextRequest, NextResponse } from "next/server";
import type { TranscriptResponse, ErrorResponse } from "@/types";

const ANDROID_VERSION = "20.10.38";
const ANDROID_UA = `com.google.android.youtube/${ANDROID_VERSION} (Linux; U; Android 14)`;

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

  // 새 형식: <p t="..." d="..."><s>text</s></p>
  const newRegex = /<p\s+t="\d+"\s+d="\d+"[^>]*>([\s\S]*?)<\/p>/g;
  let match;
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || !isValidYoutubeUrl(url)) {
      return NextResponse.json<ErrorResponse>(
        {
          error: {
            code: "INVALID_URL",
            message: "유효하지 않은 유튜브 URL입니다",
          },
        },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url)!;

    // Step 1: InnerTube ANDROID API로 자막 트랙 URL 가져오기
    const playerResponse = await fetch(
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

    if (!playerResponse.ok) {
      return NextResponse.json<ErrorResponse>(
        {
          error: {
            code: "EXTRACT_FAILED",
            message: "YouTube API 호출에 실패했습니다",
          },
        },
        { status: 500 }
      );
    }

    const playerData = await playerResponse.json();
    const captionTracks =
      playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!Array.isArray(captionTracks) || captionTracks.length === 0) {
      // 디버그: 왜 자막이 없는지 확인
      const status = playerData?.playabilityStatus?.status;
      return NextResponse.json<ErrorResponse>(
        {
          error: {
            code: "NO_TRANSCRIPT",
            message: `이 영상에는 자막이 없습니다 (status: ${status}, hasCaptions: ${!!playerData?.captions})`,
          },
        },
        { status: 404 }
      );
    }

    const track = captionTracks[0];
    const captionUrl = track.baseUrl;
    const language = track.languageCode || "auto";

    // Step 2: 자막 XML 가져오기
    const captionResponse = await fetch(captionUrl, {
      headers: { "User-Agent": ANDROID_UA },
    });

    if (!captionResponse.ok) {
      return NextResponse.json<ErrorResponse>(
        {
          error: {
            code: "FETCH_FAILED",
            message: "자막 데이터를 가져올 수 없습니다",
          },
        },
        { status: 500 }
      );
    }

    const xml = await captionResponse.text();
    const segments = parseTranscriptXml(xml);

    if (segments.length === 0) {
      return NextResponse.json<ErrorResponse>(
        {
          error: {
            code: "PARSE_FAILED",
            message: "자막 텍스트를 파싱할 수 없습니다",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json<TranscriptResponse>({
      videoId,
      text: segments.join(" "),
      language,
    });
  } catch {
    return NextResponse.json<ErrorResponse>(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요",
        },
      },
      { status: 500 }
    );
  }
}
