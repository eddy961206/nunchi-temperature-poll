# 눈치온도

QR로 들어와서 `더워요 / 괜찮아요 / 추워요`만 누르는 초간단 익명 온도 투표 웹앱이야.

## 핵심 기능

- 로그인 없음
- 이름 입력 없음
- 방 만들기 → QR 공유 → 실시간 투표
- 한 기기당 한 표, 다시 누르면 내 표가 바뀜
- 최근 15/30/45/60/120분 투표만 반영
- 호스트 링크에서만 투표 초기화 가능
- 서버 재시작 후에도 `data/rooms.json`에 투표 상태 보존

## 바로 실행

```bash
npm install
npm start
```

브라우저에서 열어:

```txt
http://localhost:3000
```

휴대폰에서 테스트하려면 같은 와이파이에서 노트북 IP로 접속하면 돼.

```txt
http://노트북IP:3000
```


## GitHub 공개 레포로 올리기

이 폴더에는 `publish-to-github.sh`와 `PUBLISH_TO_GITHUB.md`를 같이 넣어놨어.
GitHub CLI가 있으면 아래처럼 바로 공개 레포를 만들고 push할 수 있어.

```bash
./publish-to-github.sh
```

## 배포 추천

Socket.IO를 쓰니까 Vercel 같은 일반 서버리스보다는 Render, Railway, Fly.io, VM, 사내 NAS, 사내 미니 서버가 편해.

### Render 예시

- Build command: `npm install`
- Start command: `npm start`
- Environment: `NODE_VERSION=20`

무료 서버는 일정 시간 뒤 잠들 수 있어. 사무실 상시 사용이면 유료 최소 플랜이나 사내 서버가 더 안정적이야.

## 사용 방식

1. 호스트가 방을 만들어.
2. 화면에 뜬 QR을 사무실 모니터, 슬랙, 노션, 카톡방에 공유해.
3. 사람들은 눌러서 `더워요 / 괜찮아요 / 추워요`만 선택해.
4. 결과 카드의 `눈치 판단` 문구를 보고 선풍기/에어컨/히터를 한 단계 조절해.
5. 점심 이후나 퇴근 전에는 호스트가 초기화하면 돼.

## MVP 룰

이 앱은 “정답”을 내려주는 앱이 아니라 눈치 비용을 낮추는 앱이야.

추천 운영 룰:

- 3명 미만이면 참고만 하기
- 더워요가 추워요보다 2명 이상 많으면 선풍기/냉방 한 단계 올리기
- 추워요가 더워요보다 2명 이상 많으면 냉방 낮추기
- 더워요와 추워요가 비슷하면 공용기기보다 바람 방향, 자리, 개인장비 먼저 조정하기

## 파일 구조

```txt
server.js              # Express + Socket.IO 서버
public/index.html      # 화면 템플릿
public/styles.css      # 모바일 우선 스타일
public/app.js          # 클라이언트 로직
data/rooms.json        # 실행 중 자동 생성되는 저장 파일
reels/                 # 릴스 바이럴용 대본/캡션/촬영안
```
