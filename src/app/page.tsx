// Design Ref: §5.1 — 메인 페이지 (URL 입력 → 결과 표시)
"use client";

import { useState } from "react";
import UrlInput from "@/components/url-input";
import TranscriptViewer from "@/components/transcript-viewer";
import LoadingSpinner from "@/components/loading-spinner";
import type { TranscriptResponse } from "@/types";

export default function Home() {
  const [result, setResult] = useState<TranscriptResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (url: string) => {
    setIsLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || "알 수 없는 오류가 발생했습니다");
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
