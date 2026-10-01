# KT플라자 대기현황 개발 가이드

이 문서는 외부 문서 없이 이 저장소만 보고 개발할 수 있도록 작성한 내부 가이드다.

## 1. 시스템 구조

```text
브라우저
  -> Next/Vinext 화면
       -> /api/stores  -> n8n 매장 현황 API
       -> /api/wait    -> n8n 업무별 대기시간 API
       -> /api/queue/register -> n8n 대기 접수 API
       -> Naver Maps JavaScript API
```

이 프로젝트에는 자체 데이터베이스나 대기시간 계산 엔진이 없다. 운영 데이터와 계산은 n8n이 담당하고, 이 저장소는 화면과 얇은 서버 프록시를 담당한다.

## 2. 시작하기

필요 조건: Node.js 22.13 이상

```bash
npm run install:ci
npm run dev
```

개발 서버는 기본적으로 `http://localhost:5173`에서 실행된다.

검증 명령:

```bash
npm run lint
npm run typecheck
npm run build
```

## 3. 주요 파일

| 파일 | 역할 |
| --- | --- |
| `app/page.tsx` | 첫 화면 SSR과 초기 매장 현황 조회 |
| `components/plaza-dashboard.tsx` | 검색, 필터, 지도, 대기시간, 대기 접수 UI |
| `lib/config.ts` | 서버 전용 n8n 설정과 타임아웃 |
| `lib/client-config.ts` | 브라우저에 공개되는 지도 설정 |
| `lib/n8n-client.ts` | n8n 호출, 타임아웃, 외부 오류 처리 |
| `lib/plaza-schemas.ts` | API 입력·응답 검증 |
| `lib/plaza-types.ts` | 프론트엔드 데이터 계약과 상담 유형 정의 |
| `app/api/stores/route.ts` | n8n 매장 현황 API 프록시 |
| `app/api/wait/route.ts` | n8n 업무별 대기시간 API 프록시 |
| `app/api/queue/register/route.ts` | 입력 검증 후 n8n 대기 접수 API 호출 |
| `app/globals.css` | 화면 전체 스타일 |
| `db/schema.ts` | 현재는 미사용. 로컬 DB 스키마 없음 |

## 4. API 계약

### 매장 현황

`GET /api/stores`

응답 형태:

```json
{
  "ok": true,
  "count": 18,
  "stores": [
    {
      "store_id": "ST001",
      "store_name": "KT플라자 ...",
      "district": "강서구",
      "address": "부산광역시 ...",
      "phone": "051-000-0000",
      "latitude": null,
      "longitude": null,
      "latest_wait": {
        "waiting_count": 1,
        "free_staff_now": 0,
        "estimated_wait_min": 21,
        "estimated_wait_max": 31,
        "calculated_at": "2026-09-28T14:00:00+09:00"
      }
    }
  ]
}
```

### 업무별 대기시간

`GET /api/wait?store_id=ST001&consult_type_id=CT01`

`consult_type_id`는 `lib/plaza-types.ts`의 상담 유형 ID를 사용한다.

### 대기 접수

`POST /api/queue/register`

```json
{
  "store_id": "ST001",
  "customer_id": "CUS0102",
  "consult_type_id": "CT01"
}
```

현재 고객번호는 `CUS` + 숫자 4자리 형식만 허용한다.

## 5. 데이터 변경 규칙

- 매장 ID는 `ST001` 형식을 유지한다.
- 상담 유형 ID는 `COMMON`, `CT01`~`CT05`를 사용한다.
- n8n 응답 필드가 바뀌면 먼저 `lib/plaza-types.ts`와 API route의 타입을 같이 수정한다.
- 좌표가 API에서 오지 않으면 `lib/plaza-types.ts`의 `fallbackCoordinates`가 지도 표시용으로 사용된다.
- 서버 비밀값을 브라우저 컴포넌트에 넣지 않는다.
- 외부 API 호출은 화면 컴포넌트가 직접 하지 말고 `app/api/*` 프록시를 통해 연결한다.

## 6. 기능 범위

현재 구현된 기능:

- 매장 목록 조회와 검색
- 지역 필터와 대기시간/이름 정렬
- 네이버 지도와 매장 마커
- 현재 위치와 길찾기
- 업무별 대기시간 조회
- 고객 대기 접수

아직 구현되지 않은 기능:

- 자연어 방문 목적을 AI로 상담 유형 분류
- 여러 매장을 비교한 최적 매장 추천
- 미래 시간대의 방문시간 추천
- 자체 DB 저장 및 운영자용 관리 화면

## 7. 기능 추가 순서

1. `lib/plaza-types.ts`와 `lib/plaza-schemas.ts`에 요청·응답 계약 추가
2. n8n 호출은 `lib/n8n-client.ts`에 추가
3. `app/api/*`에는 입력 검증과 HTTP 응답 변환만 추가
4. `components/plaza-dashboard.tsx`에는 화면 상태와 표시 로직만 추가
5. 외부 API 오류, 빈 응답, 오래된 갱신시각을 반드시 처리
6. `npm run lint`, `npm run typecheck`, `npm run build` 실행

## 8. 외부 의존성

- n8n Webhook: 매장, 대기시간, 대기 접수
- Naver Maps JavaScript API: 지도와 길찾기
- Cloudflare/Vinext: 배포 및 실행 환경

외부 서비스 주소와 제한시간은 `.env.example`을 복사해 `.env.local`에 설정한다. 서버용 n8n 설정은 `lib/config.ts`에서만 읽고, 브라우저용 공개 설정은 `lib/client-config.ts`에서만 읽는다.
