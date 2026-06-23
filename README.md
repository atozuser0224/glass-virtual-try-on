# Glass VTO Widget Demo

MediaPipe Face Landmarker 기반의 자체 웹 안경 가상 피팅 데모입니다.
Jeeliz 위젯과 비슷한 버튼 구성, SKU 전환 흐름, 조정 모드를 제공합니다.

## 개발 실행

```bash
npm install
npm run dev
```

브라우저에서 표시되는 HTTPS 로컬 주소를 열고 카메라 권한을 허용하세요.
카메라 API는 HTTPS 또는 localhost 보안 컨텍스트가 필요합니다.

## 위젯 사용

- 기본 모델: `rayban_aviator_or_vertFlash`
- URL 파라미터로 초기 모델 변경: `?sku=rayban_round_cuivre_pinkBrownDegrade`
- 그림자 비활성화: `?isHideShadow=1`
- 화면 하단 버튼으로 Model 1, Model 2, 직접 SKU 입력을 사용할 수 있습니다.

## 배포

GitHub Pages에 바로 올릴 수 있는 정적 앱입니다.

```bash
npm run build
npm run deploy
```

GitHub 저장소 Settings에서 Pages 소스가 `gh-pages` 브랜치를 바라보게 설정하면 됩니다.

현재 저장소는 GitHub Actions Pages 배포도 포함합니다.

## 라이선스 메모

이 앱은 Jeeliz 런타임/번들을 사용하지 않는 clean-room 구현입니다.
MediaPipe, Three.js, Vite 기반으로 구성되어 있습니다.
