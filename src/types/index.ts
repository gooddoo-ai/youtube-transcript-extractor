// Design Ref: §3 — Data Model type definitions

export interface TranscriptRequest {
  url: string;
}

export interface TranscriptResponse {
  videoId: string;
  text: string;
  language: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
