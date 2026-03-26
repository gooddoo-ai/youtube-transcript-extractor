// Design Ref: §4 — API Route (프록시: 브라우저에서 받은 자막 URL로 XML 가져오기)
// YouTube가 Vercel IP를 차단하므로 InnerTube 호출은 클라이언트에서 수행

import { NextRequest, NextResponse } from "next/server";
import type { ErrorResponse } from "@/types";

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

// 클라이언트가 보낸 captionUrl에서 자막 XML을 가져와 텍스트 파싱
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { captionUrl, videoId } = body;

    if (!captionUrl || !videoId) {
      return NextResponse.json<ErrorResponse>(
        { error: { code: "INVALID_REQUEST", message: "captionUrl과 videoId가 필요합니다" } },
        { status: 400 }
      );
    }

    // 안전 검증: YouTube 도메인만 허용
    try {
      const url = new URL(captionUrl);
      if (!url.hostname.endsWith(".youtube.com")) {
        return NextResponse.json<ErrorResponse>(
          { error: { code: "INVALID_URL", message: "유효하지 않은 자막 URL입니다" } },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json<ErrorResponse>(
        { error: { code: "INVALID_URL", message: "유효하지 않은 URL 형식입니다" } },
        { status: 400 }
      );
    }

    const captionResponse = await fetch(captionUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36",
      },
    });

    if (!captionResponse.ok) {
      return NextResponse.json<ErrorResponse>(
        { error: { code: "FETCH_FAILED", message: "자막 데이터를 가져올 수 없습니다" } },
        { status: 500 }
      );
    }

    const xml = await captionResponse.text();

    // 새 형식 파싱 (<p t="..." d="..."><s>...</s></p>)
    const segments: string[] = [];
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
      const text = sTexts.length > 0 ? sTexts.join("") : inner.replace(/<[^>]+>/g, "");
      if (text.trim()) segments.push(decodeEntities(text.trim()));
    }

    // 구 형식 폴백 (<text start="..." dur="...">...</text>)
    if (segments.length === 0) {
      const oldRegex = /<text[^>]*>(.*?)<\/text>/g;
      while ((match = oldRegex.exec(xml)) !== null) {
        const decoded = decodeEntities(match[1]);
        if (decoded.trim()) segments.push(decoded.trim());
      }
    }

    if (segments.length === 0) {
      return NextResponse.json<ErrorResponse>(
        { error: { code: "PARSE_FAILED", message: "자막 텍스트를 파싱할 수 없습니다" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      videoId,
      text: segments.join(" "),
      language: "auto",
    });
  } catch {
    return NextResponse.json<ErrorResponse>(
      { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
