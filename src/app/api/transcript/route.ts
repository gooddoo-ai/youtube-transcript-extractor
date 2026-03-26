// Design Ref: §4 — API Route (자막 추출)

import { NextRequest, NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";
import type { TranscriptResponse, ErrorResponse } from "@/types";

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

// youtube-transcript 라이브러리 실패 시 직접 파싱하는 폴백
async function fetchTranscriptDirect(
  videoId: string
): Promise<{ text: string; lang: string }> {
  // InnerTube API 직접 호출 (Android 클라이언트)
  const response = await fetch(
    "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "com.google.android.youtube/19.29.37 (Linux; U; Android 14)",
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: "19.29.37",
          },
        },
        videoId,
      }),
    }
  );

  if (!response.ok) {
    throw new Error("InnerTube API 호출 실패");
  }

  const data = await response.json();
  const captionTracks =
    data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!Array.isArray(captionTracks) || captionTracks.length === 0) {
    throw new Error("자막 트랙을 찾을 수 없습니다");
  }

  const track = captionTracks[0];
  const captionUrl = track.baseUrl;
  const lang = track.languageCode || "auto";

  // 자막 XML 가져오기
  const captionResponse = await fetch(captionUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)",
    },
  });

  const xml = await captionResponse.text();

  // 새 형식 (<p t="..." d="..."><s>...</s></p>) 먼저 시도
  const newFormatSegments: string[] = [];
  const newRegex = /<p\s+t="\d+"\s+d="\d+"[^>]*>([\s\S]*?)<\/p>/g;
  let match;
  while ((match = newRegex.exec(xml)) !== null) {
    const inner = match[1];
    // <s> 태그에서 텍스트 추출
    const sTexts: string[] = [];
    const sRegex = /<s[^>]*>([^<]*)<\/s>/g;
    let sMatch;
    while ((sMatch = sRegex.exec(inner)) !== null) {
      sTexts.push(sMatch[1]);
    }
    const segText = sTexts.length > 0 ? sTexts.join("") : inner.replace(/<[^>]+>/g, "");
    if (segText.trim()) {
      newFormatSegments.push(decodeEntities(segText.trim()));
    }
  }

  if (newFormatSegments.length > 0) {
    return { text: newFormatSegments.join(" "), lang };
  }

  // 구 형식 (<text start="..." dur="...">...</text>) 폴백
  const oldSegments: string[] = [];
  const oldRegex = /<text[^>]*>(.*?)<\/text>/g;
  while ((match = oldRegex.exec(xml)) !== null) {
    const decoded = decodeEntities(match[1]);
    if (decoded.trim()) oldSegments.push(decoded.trim());
  }

  if (oldSegments.length > 0) {
    return { text: oldSegments.join(" "), lang };
  }

  throw new Error("자막 텍스트를 파싱할 수 없습니다");
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) =>
      String.fromCodePoint(parseInt(dec, 10))
    )
    .replace(/\n/g, " ");
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

    // 방법 1: youtube-transcript 라이브러리
    try {
      const segments = await YoutubeTranscript.fetchTranscript(videoId);
      if (segments && segments.length > 0) {
        const text = segments.map((s) => s.text).join(" ");
        return NextResponse.json<TranscriptResponse>({
          videoId,
          text,
          language: segments[0].lang || "auto",
        });
      }
    } catch {
      // 라이브러리 실패 시 폴백으로 진행
    }

    // 방법 2: 직접 InnerTube API 호출 (폴백)
    try {
      const result = await fetchTranscriptDirect(videoId);
      return NextResponse.json<TranscriptResponse>({
        videoId,
        text: result.text,
        language: result.lang,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("자막 트랙을 찾을 수 없습니다")) {
        return NextResponse.json<ErrorResponse>(
          { error: { code: "NO_TRANSCRIPT", message: "이 영상에는 자막이 없습니다" } },
          { status: 404 }
        );
      }
      return NextResponse.json<ErrorResponse>(
        { error: { code: "EXTRACT_FAILED", message: "자막 추출 실패: " + message } },
        { status: 500 }
      );
    }
  } catch {
    return NextResponse.json<ErrorResponse>(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요" } },
      { status: 500 }
    );
  }
}
