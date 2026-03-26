# YouTube Transcript Extractor Planning Document

> **Summary**: 유튜브 링크를 입력하면 자막을 추출하고 Claude API로 한글 번역하여 텍스트로 제공하는 웹앱
>
> **Project**: bkit - Starter
> **Author**: David Jung
> **Date**: 2026-03-26
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 유튜브 영상의 자막/스크립트를 텍스트로 얻으려면 수동으로 복사하거나 별도 도구를 사용해야 하며, 외국어 영상은 한글 번역까지 추가 작업이 필요하다 |
| **Solution** | 유튜브 URL 입력만으로 자막 추출 + Claude API 한글 번역을 원스텝으로 제공하는 Next.js 웹앱 |
| **Function/UX Effect** | URL 붙여넣기 → 버튼 클릭 → 한글 번역된 전체 스크립트 즉시 확인 및 복사 |
| **Core Value** | 외국어 유튜브 콘텐츠를 한글 텍스트로 빠르게 소비할 수 있는 생산성 도구 |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 유튜브 외국어 영상의 스크립트를 한글로 쉽게 얻을 수 없는 불편함 해소 |
| **WHO** | 외국어 유튜브 콘텐츠를 한글로 소비하려는 사용자 (학습자, 리서처, 콘텐츠 크리에이터) |
| **RISK** | YouTube 자막 API 의존성 — 자막이 없는 영상은 지원 불가 |
| **SUCCESS** | URL 입력 후 30초 이내 한글 번역 스크립트 제공, 자막 없는 영상 시 명확한 에러 안내 |
| **SCOPE** | Phase 1: 자막 추출 + 한글 번역 + 화면 표시/복사 (MVP) |

---

## 1. Overview

### 1.1 Purpose

유튜브 영상의 자막(transcript)을 자동 추출하고, Claude API를 활용하여 고품질 한글 번역을 제공하는 웹 애플리케이션을 개발한다.

### 1.2 Background

- 유튜브에는 다양한 외국어 교육/기술/엔터테인먼트 콘텐츠가 있으나, 자막을 텍스트로 추출하려면 별도 도구가 필요
- 기존 도구들은 번역 품질이 낮거나 (Google 자동번역) 추가 단계가 많음
- Claude API의 고품질 번역으로 자연스러운 한글 텍스트를 원스텝으로 제공

### 1.3 Related Documents

- YouTube Data API: https://developers.google.com/youtube/v3
- Anthropic Claude API: https://docs.anthropic.com/

---

## 2. Scope

### 2.1 In Scope

- [ ] 유튜브 URL 입력 UI
- [ ] 유튜브 자막(transcript) 추출 기능
- [ ] Claude API를 이용한 한글 번역
- [ ] 번역된 텍스트 화면 표시
- [ ] 클립보드 복사 기능
- [ ] 자막 없는 영상 에러 처리

### 2.2 Out of Scope

- 음성 인식(Whisper) 기반 스크립트 추출
- 파일 다운로드(.txt, .srt)
- 타임스탬프 포함 출력
- 사용자 인증/로그인
- 번역 이력 저장

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | 유튜브 URL을 입력받아 유효성 검증 | High | Pending |
| FR-02 | 유튜브 영상의 자막(transcript) 추출 | High | Pending |
| FR-03 | 추출된 자막을 Claude API로 한글 번역 | High | Pending |
| FR-04 | 번역된 텍스트를 화면에 표시 | High | Pending |
| FR-05 | 텍스트 클립보드 복사 버튼 | Medium | Pending |
| FR-06 | 자막 없는 영상 시 에러 메시지 표시 | High | Pending |
| FR-07 | 로딩 상태 표시 (추출 중, 번역 중) | Medium | Pending |
| FR-08 | 원본 자막과 번역본 토글 표시 | Low | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Performance | URL 입력 후 30초 이내 결과 표시 | 수동 테스트 |
| UX | 모바일 반응형 지원 | 브라우저 DevTools |
| Error Handling | 모든 에러에 사용자 친화적 한글 메시지 | 수동 테스트 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] 유효한 유튜브 URL 입력 시 한글 번역 스크립트 출력
- [ ] 자막 없는 영상에 명확한 에러 메시지 표시
- [ ] 복사 버튼으로 텍스트 클립보드 복사 동작
- [ ] 모바일/데스크톱 반응형 레이아웃
- [ ] 로딩 상태 UI 표시

### 4.2 Quality Criteria

- [ ] 잘못된 URL 입력 시 적절한 검증 메시지
- [ ] API 에러 시 사용자 안내 메시지
- [ ] 빌드 성공 (lint 에러 없음)

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| YouTube 자막 API 변경/차단 | High | Medium | youtube-transcript 라이브러리 사용, 대안 라이브러리 준비 |
| Claude API 비용 발생 | Medium | High | 긴 스크립트는 청크 분할 번역, 토큰 제한 안내 |
| 자막 없는 영상 비율 높음 | Medium | Medium | 명확한 에러 메시지로 사용자 안내 |
| 긴 영상의 자막 처리 시간 | Medium | Medium | 로딩 상태 표시, 프로그레스 바 제공 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| 신규 프로젝트 | 전체 | 새로운 Next.js 프로젝트 생성 (기존 코드 없음) |

### 6.2 Current Consumers

신규 프로젝트이므로 기존 소비자 없음.

### 6.3 Verification

- [x] 신규 프로젝트 — 기존 영향 없음

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure (`components/`, `lib/`, `types/`) | Static sites, portfolios, landing pages | ✅ |
| **Dynamic** | Feature-based modules, BaaS integration | Web apps with backend, SaaS MVPs | ☐ |
| **Enterprise** | Strict layer separation, DI, microservices | High-traffic systems | ☐ |

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| Framework | Next.js / React / Vue | Next.js (App Router) | API Route로 서버사이드 처리 가능, 풀스택 단일 프레임워크 |
| Styling | Tailwind / CSS Modules | Tailwind CSS | 빠른 프로토타이핑, 반응형 지원 용이 |
| YouTube 자막 추출 | youtube-transcript / youtubei.js | youtube-transcript | 경량, 심플한 API, 자막 추출 특화 |
| 번역 API | Claude API / Google / DeepL | Claude API (Anthropic SDK) | 고품질 한글 번역, 문맥 이해력 우수 |
| 배포 | Vercel / Netlify | Vercel | Next.js 최적 지원, 무료 티어 |

### 7.3 Clean Architecture Approach

```
Selected Level: Starter

Folder Structure Preview:
┌─────────────────────────────────────────────────────┐
│ src/                                                │
│   app/                                              │
│     page.tsx              # 메인 페이지 (URL 입력)   │
│     layout.tsx            # 공통 레이아웃             │
│     api/                                            │
│       transcript/                                   │
│         route.ts          # 자막 추출 API Route      │
│       translate/                                    │
│         route.ts          # 번역 API Route           │
│   components/                                       │
│     url-input.tsx         # URL 입력 컴포넌트         │
│     transcript-viewer.tsx # 결과 표시 컴포넌트        │
│     copy-button.tsx       # 복사 버튼 컴포넌트        │
│     loading-spinner.tsx   # 로딩 상태 컴포넌트        │
│   lib/                                              │
│     youtube.ts            # YouTube 자막 추출 로직    │
│     translate.ts          # Claude API 번역 로직      │
│     validators.ts         # URL 유효성 검증           │
│   types/                                            │
│     index.ts              # 타입 정의                 │
└─────────────────────────────────────────────────────┘
```

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [ ] `CLAUDE.md` — 신규 생성 필요
- [ ] ESLint — Next.js 기본 설정 사용
- [ ] TypeScript — strict mode

### 8.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| **Naming** | Missing | camelCase (변수/함수), PascalCase (컴포넌트) | High |
| **Folder structure** | Missing | Starter 레벨 구조 | High |
| **Error handling** | Missing | 사용자 친화적 한글 에러 메시지 패턴 | Medium |

### 8.3 Environment Variables Needed

| Variable | Purpose | Scope | To Be Created |
|----------|---------|-------|:-------------:|
| `ANTHROPIC_API_KEY` | Claude API 인증 키 | Server | ✅ |

---

## 9. Next Steps

1. [ ] Design 문서 작성 (`youtube-transcript-extractor.design.md`)
2. [ ] 구현 시작
3. [ ] Gap 분석

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-03-26 | Initial draft | David Jung |
