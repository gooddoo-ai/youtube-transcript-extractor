// Design Ref: §4 — API Route (자막 추출)
// 서버에서 youtube-transcript 라이브러리로 자막 추출

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

    // 최대 3회 재시도
    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
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
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        // captcha/rate limit 에러면 재시도 의미 없음
        if (lastError.includes("captcha") || lastError.includes("too many")) {
          break;
        }
        // 그 외에는 잠깐 대기 후 재시도
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    // 모든 시도 실패
    if (lastError.includes("disabled") || lastError.includes("Transcript is disabled")) {
      return NextResponse.json<ErrorResponse>(
        { error: { code: "NO_TRANSCRIPT", message: "이 영상의 자막이 비활성화되어 있습니다" } },
        { status: 404 }
      );
    }
    if (lastError.includes("No transcripts") || lastError.includes("not available")) {
      return NextResponse.json<ErrorResponse>(
        { error: { code: "NO_TRANSCRIPT", message: "이 영상에는 자막이 없습니다" } },
        { status: 404 }
      );
    }
    if (lastError.includes("captcha") || lastError.includes("too many")) {
      return NextResponse.json<ErrorResponse>(
        { error: { code: "RATE_LIMITED", message: "YouTube 요청이 제한되었습니다. 잠시 후 다시 시도해주세요" } },
        { status: 429 }
      );
    }

    return NextResponse.json<ErrorResponse>(
      { error: { code: "EXTRACT_FAILED", message: "자막 추출 실패: " + lastError } },
      { status: 500 }
    );
  } catch {
    return NextResponse.json<ErrorResponse>(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요" } },
      { status: 500 }
    );
  }
}
