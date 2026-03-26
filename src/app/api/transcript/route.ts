// Design Ref: §4 — API Route (자막 추출)

import { NextRequest, NextResponse } from "next/server";
import { extractVideoId, isValidYoutubeUrl, fetchTranscript } from "@/lib/youtube";
import type { TranscriptResponse, ErrorResponse } from "@/types";

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

    let transcript: { text: string; language: string };
    try {
      transcript = await fetchTranscript(videoId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "NO_TRANSCRIPT") {
        return NextResponse.json<ErrorResponse>(
          { error: { code: "NO_TRANSCRIPT", message: "이 영상에는 자막이 없습니다" } },
          { status: 404 }
        );
      }
      return NextResponse.json<ErrorResponse>(
        { error: { code: "EXTRACT_FAILED", message: "자막 추출 중 오류가 발생했습니다" } },
        { status: 500 }
      );
    }

    return NextResponse.json<TranscriptResponse>({
      videoId,
      text: transcript.text,
      language: transcript.language,
    });
  } catch {
    return NextResponse.json<ErrorResponse>(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요" } },
      { status: 500 }
    );
  }
}
