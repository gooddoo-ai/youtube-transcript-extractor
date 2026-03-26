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

    let segments;
    try {
      segments = await YoutubeTranscript.fetchTranscript(videoId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("disabled") || message.includes("No transcripts")) {
        return NextResponse.json<ErrorResponse>(
          { error: { code: "NO_TRANSCRIPT", message: "이 영상에는 자막이 없습니다" } },
          { status: 404 }
        );
      }
      if (message.includes("too many requests") || message.includes("captcha")) {
        return NextResponse.json<ErrorResponse>(
          { error: { code: "RATE_LIMITED", message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요" } },
          { status: 429 }
        );
      }
      return NextResponse.json<ErrorResponse>(
        { error: { code: "EXTRACT_FAILED", message: "자막 추출 중 오류가 발생했습니다: " + message } },
        { status: 500 }
      );
    }

    if (!segments || segments.length === 0) {
      return NextResponse.json<ErrorResponse>(
        { error: { code: "NO_TRANSCRIPT", message: "이 영상에는 자막이 없습니다" } },
        { status: 404 }
      );
    }

    const text = segments.map((s) => s.text).join(" ");

    return NextResponse.json<TranscriptResponse>({
      videoId,
      text,
      language: segments[0].lang || "auto",
    });
  } catch {
    return NextResponse.json<ErrorResponse>(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요" } },
      { status: 500 }
    );
  }
}
