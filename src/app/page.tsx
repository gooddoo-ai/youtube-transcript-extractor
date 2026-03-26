// Design Ref: §5.1 — 메인 페이지 (URL 입력 → 결과 표시)
// 클라이언트에서 InnerTube API 호출 → 자막 URL을 서버 프록시로 전달
"use client";

import { useState } from "react";
import UrlInput from "@/components/url-input";
import TranscriptViewer from "@/components/transcript-viewer";
import LoadingSpinner from "@/components/loading-spinner";
import type { TranscriptResponse } from "@/types";

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

async function getCaptionUrl(videoId: string): Promise<{ captionUrl: string; lang: string }> {
  // 브라우저에서 InnerTube API 직접 호출 (CORS 허용됨)
  const response = await fetch(
    "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "WEB",
            clientVersion: "2.20240313",
          },
        },
        videoId,
      }),
    }
  );

  if (!response.ok) throw new Error("YouTube API 호출에 실패했습니다");

  const data = await response.json();
  const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!Array.isArray(tracks) || tracks.length === 0) {
    throw new Error("이 영상에는 자막이 없습니다");
  }

  return {
    captionUrl: tracks[0].baseUrl,
    lang: tracks[0].languageCode || "auto",
  };
}

export default function Home() {
  const [result, setResult] = useState<TranscriptResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (url: string) => {
    setIsLoading(true);
    setError("");
    setResult(null);

    try {
      const videoId = extractVideoId(url);
      if (!videoId) {
        setError("유효하지 않은 유튜브 URL입니다");
        return;
      }

      // Step 1: 브라우저에서 InnerTube API로 자막 URL 가져오기
      let captionInfo;
      try {
        captionInfo = await getCaptionUrl(videoId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "자막 정보를 가져올 수 없습니다");
        return;
      }

      // Step 2: 서버 프록시로 자막 XML 파싱 요청
      const response = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          captionUrl: captionInfo.captionUrl,
          videoId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || "자막 추출에 실패했습니다");
        return;
      }

      setResult(data);
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            YouTube 스크립트 추출기
          </h1>
          <p className="text-gray-500">
            유튜브 영상의 자막을 텍스트로 추출해드립니다
          </p>
        </div>

        <UrlInput onSubmit={handleSubmit} isLoading={isLoading} />

        {isLoading && (
          <LoadingSpinner message="자막을 추출하고 있습니다..." />
        )}

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {result && <TranscriptViewer data={result} />}
      </div>
    </main>
  );
}
