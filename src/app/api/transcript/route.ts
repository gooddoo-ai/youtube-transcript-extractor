// Design Ref: §4 — API Route (자막 추출 - YouTube 페이지 직접 파싱)

import { NextRequest, NextResponse } from "next/server";
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

async function fetchTranscriptFromYoutube(
  videoId: string
): Promise<{ text: string; language: string }> {
  // YouTube 영상 페이지 가져오기
  const response = await fetch(
    `https://www.youtube.com/watch?v=${videoId}`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    }
  );

  if (!response.ok) {
    throw new Error("EXTRACT_FAILED");
  }

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

    let transcript: { text: string; language: string };
    try {
      transcript = await fetchTranscriptFromYoutube(videoId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "NO_TRANSCRIPT") {
        return NextResponse.json<ErrorResponse>(
          {
            error: {
              code: "NO_TRANSCRIPT",
              message: "이 영상에는 자막이 없습니다",
            },
          },
          { status: 404 }
        );
      }
      return NextResponse.json<ErrorResponse>(
        {
          error: {
            code: "EXTRACT_FAILED",
            message: "자막 추출 중 오류가 발생했습니다",
          },
        },
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
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요",
        },
      },
      { status: 500 }
    );
  }
}
