# YouTube Transcript Extractor Design Document

> **Summary**: 유튜브 URL 입력 → 자막 추출 → Claude API 한글 번역 → 텍스트 표시/복사 웹앱
>
> **Project**: bkit - Starter
> **Author**: David Jung
> **Date**: 2026-03-26
> **Status**: Draft
> **Planning Doc**: [youtube-transcript-extractor.plan.md](../01-plan/features/youtube-transcript-extractor.plan.md)

---

## Context Anchor

> Copied from Plan document. Ensures strategic context survives Design→Do handoff.

| Key | Value |
|-----|-------|
| **WHY** | 유튜브 외국어 영상의 스크립트를 한글로 쉽게 얻을 수 없는 불편함 해소 |
| **WHO** | 외국어 유튜브 콘텐츠를 한글로 소비하려는 사용자 (학습자, 리서처, 콘텐츠 크리에이터) |
| **RISK** | YouTube 자막 API 의존성 — 자막이 없는 영상은 지원 불가 |
| **SUCCESS** | URL 입력 후 30초 이내 한글 번역 스크립트 제공, 자막 없는 영상 시 명확한 에러 안내 |
| **SCOPE** | Phase 1: 자막 추출 + 한글 번역 + 화면 표시/복사 (MVP) |

---

## 1. Overview

### 1.1 Design Goals

- 사용자가 URL만 입력하면 한글 번역 스크립트를 한 번의 API 호출로 얻을 수 있는 간결한 구조
- Starter 레벨에 적합한 최소한의 파일 구조로 유지보수성 확보
- 서버사이드에서 YouTube 자막 추출 + Claude API 번역을 통합 처리

### 1.2 Design Principles

- **단일 API 엔드포인트**: 프론트에서 1회 호출로 자막 추출 + 번역 완료
- **관심사 분리**: lib 레이어에서 youtube/translate 로직 분리
- **점진적 UX**: 로딩 → 결과 → 복사의 명확한 상태 전환

---

## 2. Architecture Options

### 2.0 Architecture Comparison

| Criteria | Option A: Minimal | Option B: Clean | Option C: Pragmatic |
|----------|:-:|:-:|:-:|
| **Approach** | page.tsx에 모든 UI inline | API 2개 + hooks + 5컴포넌트 | API 1개 통합 + 4컴포넌트 |
| **New Files** | 4 | 14 | 9 |
| **Complexity** | Low | High | Medium |
| **Maintainability** | Low | High | High |
| **Effort** | Low | High | Medium |
| **Risk** | Low (coupled) | Low (over-engineered) | Low (balanced) |
| **Recommendation** | Quick prototype | Long-term project | **Default choice** |

**Selected**: Option C — **Rationale**: Starter 레벨에 적합한 파일 수(9개)로 관심사를 적절히 분리하면서도 과도한 구조를 피함. API 1회 호출로 UX 단순화.

---

### 2.1 Component Diagram

```
┌──────────────────────────────────────────────────────────┐
│                     Browser (Client)                      │
│                                                          │
│  ┌──────────┐   ┌───────────────────┐   ┌────────────┐  │
│  │ UrlInput │──▶│ TranscriptViewer  │──▶│ CopyButton │  │
│  └──────────┘   └───────────────────┘   └────────────┘  │
│       │              ▲                                   │
│       │              │                                   │
│       ▼              │                                   │
│  ┌──────────────────────┐                                │
│  │   LoadingSpinner     │                                │
│  └──────────────────────┘                                │
└─────────────────┬────────────────────────────────────────┘
                  │ POST /api/transcript
                  ▼
┌──────────────────────────────────────────────────────────┐
│                  Next.js API Route                        │
│                                                          │
│  ┌─────────────────┐     ┌─────────────────────┐        │
│  │   youtube.ts    │────▶│   translate.ts       │        │
│  │ (자막 추출)      │     │ (Claude API 번역)    │        │
│  └─────────────────┘     └─────────────────────┘        │
└──────────────────────────────────────────────────────────┘
                  │                    │
                  ▼                    ▼
           YouTube 서버          Anthropic API
```

### 2.2 Data Flow

```
1. 사용자가 YouTube URL 입력
2. 프론트엔드에서 URL 유효성 검증 (클라이언트)
3. POST /api/transcript 호출 (URL 전달)
4. API Route에서:
   a. youtube.ts → YouTube 자막 추출
   b. translate.ts → Claude API로 한글 번역
5. 번역된 텍스트 + 원본 텍스트 응답
6. TranscriptViewer에 결과 표시
7. CopyButton으로 클립보드 복사
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| `page.tsx` | UrlInput, TranscriptViewer, LoadingSpinner | 메인 페이지 조합 |
| `TranscriptViewer` | CopyButton | 결과 표시 + 복사 기능 |
| `API Route` | youtube.ts, translate.ts | 자막 추출 및 번역 처리 |
| `youtube.ts` | youtube-transcript 패키지 | YouTube 자막 API 접근 |
| `translate.ts` | @anthropic-ai/sdk 패키지 | Claude API 호출 |

---

## 3. Data Model

### 3.1 Type Definitions

```typescript
// 요청 타입
interface TranscriptRequest {
  url: string;  // YouTube URL
}

// 응답 타입
interface TranscriptResponse {
  videoId: string;        // YouTube 영상 ID
  title: string;          // 영상 제목 (추출 가능한 경우)
  originalText: string;   // 원본 자막 텍스트
  translatedText: string; // 한글 번역 텍스트
  language: string;       // 원본 자막 언어
}

// 에러 응답 타입
interface ErrorResponse {
  error: {
    code: string;
    message: string;  // 한글 에러 메시지
  };
}

// YouTube 자막 세그먼트 (라이브러리 반환값)
interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}
```

---

## 4. API Specification

### 4.1 Endpoint List

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | /api/transcript | 유튜브 자막 추출 + 한글 번역 | 없음 (API Key는 서버사이드) |

### 4.2 Detailed Specification

#### `POST /api/transcript`

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response (200 OK):**
```json
{
  "videoId": "dQw4w9WgXcQ",
  "title": "Video Title",
  "originalText": "Never gonna give you up...",
  "translatedText": "절대 널 포기하지 않을 거야...",
  "language": "en"
}
```

**Error Responses:**

| Status | Code | Message |
|--------|------|---------|
| 400 | `INVALID_URL` | 유효하지 않은 유튜브 URL입니다 |
| 404 | `NO_TRANSCRIPT` | 이 영상에는 자막이 없습니다 |
| 500 | `EXTRACT_FAILED` | 자막 추출 중 오류가 발생했습니다 |
| 500 | `TRANSLATE_FAILED` | 번역 중 오류가 발생했습니다 |
| 500 | `INTERNAL_ERROR` | 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요 |

---

## 5. UI/UX Design

### 5.1 Screen Layout

```
┌──────────────────────────────────────────────────┐
│  🎬 YouTube 스크립트 추출기                        │
│  유튜브 영상의 자막을 한글로 번역해드립니다            │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────────────────────────┐ ┌───────┐ │
│  │ 유튜브 URL을 입력하세요...         │ │ 추출  │ │
│  └──────────────────────────────────┘ └───────┘ │
│                                                  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                                  │
│  [원본] [번역]                        [📋 복사]  │
│  ┌──────────────────────────────────────────┐   │
│  │                                          │   │
│  │  번역된 스크립트 텍스트가 여기에 표시됩니다   │   │
│  │  ...                                     │   │
│  │                                          │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
└──────────────────────────────────────────────────┘
```

### 5.2 User Flow

```
URL 입력 → [추출] 클릭 → 로딩 스피너 표시 → 결과 표시 → [복사] 또는 [원본/번역] 토글
                              ↓ (에러 시)
                        에러 메시지 표시
```

### 5.3 Component List

| Component | File | Responsibility |
|-----------|------|----------------|
| `UrlInput` | `src/components/url-input.tsx` | URL 입력 필드 + 추출 버튼, 클라이언트 유효성 검증 |
| `TranscriptViewer` | `src/components/transcript-viewer.tsx` | 번역 결과 표시, 원본/번역 토글 |
| `CopyButton` | `src/components/copy-button.tsx` | 클립보드 복사 + "복사됨" 피드백 |
| `LoadingSpinner` | `src/components/loading-spinner.tsx` | 로딩 상태 (추출 중 / 번역 중) 표시 |

---

## 6. Error Handling

### 6.1 Error Strategy

| Layer | Error Type | Handling |
|-------|-----------|----------|
| Client | 잘못된 URL 형식 | 입력 필드 아래 인라인 에러 메시지 |
| API Route | 자막 없음 | 404 + 한글 안내 메시지 |
| API Route | YouTube API 실패 | 500 + 재시도 안내 |
| API Route | Claude API 실패 | 500 + 원본 텍스트만 표시 제안 |
| Client | 네트워크 오류 | 화면에 재시도 안내 |

### 6.2 Error Response Format

```json
{
  "error": {
    "code": "NO_TRANSCRIPT",
    "message": "이 영상에는 자막이 없습니다. 자막이 있는 영상의 URL을 입력해주세요."
  }
}
```

---

## 7. Security Considerations

- [x] URL 입력 유효성 검증 (유튜브 URL 패턴만 허용)
- [x] ANTHROPIC_API_KEY는 서버사이드에서만 사용 (클라이언트 노출 없음)
- [ ] Rate Limiting (향후 고려 — MVP에서는 제외)
- [x] 사용자 입력 sanitization (URL만 허용, 임의 코드 실행 방지)

---

## 8. Test Plan

### 8.1 Test Scope

| Type | Target | Method |
|------|--------|--------|
| 수동 테스트 | 전체 플로우 | 브라우저에서 직접 테스트 |
| URL 검증 | 유효/무효 URL 패턴 | 수동 테스트 |
| 에러 처리 | 자막 없는 영상, 잘못된 URL | 수동 테스트 |

### 8.2 Test Cases (Key)

- [ ] Happy path: 자막 있는 영어 유튜브 URL → 한글 번역 텍스트 출력
- [ ] Error: 자막 없는 영상 → "이 영상에는 자막이 없습니다" 메시지
- [ ] Error: 잘못된 URL → "유효하지 않은 유튜브 URL입니다" 메시지
- [ ] Edge case: 매우 긴 영상 (1시간+) → 정상 처리 또는 시간 초과 안내
- [ ] 복사 버튼 → 클립보드에 텍스트 복사 확인

---

## 9. Clean Architecture

### 9.1 Layer Structure (Starter Level)

| Layer | Responsibility | Location |
|-------|---------------|----------|
| **Presentation** | UI 컴포넌트, 페이지 | `src/app/`, `src/components/` |
| **Infrastructure** | YouTube API, Claude API 호출 | `src/lib/` |
| **Types** | 타입 정의 | `src/types/` |

### 9.2 This Feature's Layer Assignment

| Component | Layer | Location |
|-----------|-------|----------|
| `page.tsx` | Presentation | `src/app/page.tsx` |
| `UrlInput` | Presentation | `src/components/url-input.tsx` |
| `TranscriptViewer` | Presentation | `src/components/transcript-viewer.tsx` |
| `CopyButton` | Presentation | `src/components/copy-button.tsx` |
| `LoadingSpinner` | Presentation | `src/components/loading-spinner.tsx` |
| `route.ts` | API (Application) | `src/app/api/transcript/route.ts` |
| `youtube.ts` | Infrastructure | `src/lib/youtube.ts` |
| `translate.ts` | Infrastructure | `src/lib/translate.ts` |
| Type definitions | Types | `src/types/index.ts` |

---

## 10. Coding Convention Reference

### 10.1 This Feature's Conventions

| Item | Convention Applied |
|------|-------------------|
| Component naming | PascalCase (`UrlInput`, `TranscriptViewer`) |
| File naming | kebab-case (`url-input.tsx`, `copy-button.tsx`) |
| 변수/함수 | camelCase (`handleSubmit`, `extractTranscript`) |
| 에러 메시지 | 모두 한글, 사용자 친화적 톤 |
| 환경변수 | `ANTHROPIC_API_KEY` (서버 전용) |

---

## 11. Implementation Guide

### 11.1 File Structure

```
src/
├── app/
│   ├── layout.tsx              # 공통 레이아웃
│   ├── page.tsx                # 메인 페이지
│   ├── globals.css             # 전역 스타일
│   └── api/
│       └── transcript/
│           └── route.ts        # 자막 추출 + 번역 API
├── components/
│   ├── url-input.tsx           # URL 입력 컴포넌트
│   ├── transcript-viewer.tsx   # 결과 표시 컴포넌트
│   ├── copy-button.tsx         # 복사 버튼
│   └── loading-spinner.tsx     # 로딩 스피너
├── lib/
│   ├── youtube.ts              # YouTube 자막 추출
│   └── translate.ts            # Claude API 번역
└── types/
    └── index.ts                # 타입 정의
```

### 11.2 Implementation Order

1. [ ] 타입 정의 (`types/index.ts`)
2. [ ] YouTube 자막 추출 로직 (`lib/youtube.ts`)
3. [ ] Claude API 번역 로직 (`lib/translate.ts`)
4. [ ] API Route 구현 (`api/transcript/route.ts`)
5. [ ] UI 컴포넌트 구현 (UrlInput → LoadingSpinner → TranscriptViewer → CopyButton)
6. [ ] 메인 페이지 조합 (`page.tsx`)
7. [ ] 스타일링 및 반응형 처리

### 11.3 Session Guide

> Auto-generated from Design structure. Session split is recommended, not required.
> Use `/pdca do youtube-transcript-extractor --scope module-N` to implement one module per session.

#### Module Map

| Module | Scope Key | Description | Estimated Turns |
|--------|-----------|-------------|:---------------:|
| Types + Lib | `module-1` | 타입 정의, youtube.ts, translate.ts | 10-15 |
| API Route | `module-2` | /api/transcript route.ts | 8-10 |
| UI Components | `module-3` | 4개 컴포넌트 + page.tsx + 스타일링 | 15-20 |

#### Recommended Session Plan

| Session | Phase | Scope | Turns |
|---------|-------|-------|:-----:|
| Session 1 | Plan + Design | 전체 | 30-35 |
| Session 2 | Do | `--scope module-1,module-2,module-3` (전체) | 30-40 |
| Session 3 | Check + Report | 전체 | 20-30 |

> Starter 레벨이고 파일 수가 적어 Do를 한 세션에서 완료 가능

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-03-26 | Initial draft — Option C (Pragmatic) 선택 | David Jung |
