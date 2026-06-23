# Glass Fit Studio

Jeeliz FaceFilter를 사용하는 웹 기반 안경 가상 피팅 MVP입니다.

## 개발 실행

```bash
npm install
npm run dev
```

브라우저에서 표시되는 HTTPS 로컬 주소를 열고 카메라 권한을 허용하세요.
카메라 API는 HTTPS 또는 localhost 보안 컨텍스트가 필요합니다.

## 배포

GitHub Pages에 바로 올릴 수 있는 정적 앱입니다.

```bash
npm run build
npm run deploy
```

GitHub 저장소 Settings에서 Pages 소스가 `gh-pages` 브랜치를 바라보게 설정하면 됩니다.

## 구현 메모

- Jeeliz FaceFilter는 공식 CDN의 `jeelizFaceFilter.js`를 사용합니다.
- 얼굴 추적 실패 또는 카메라 권한 거부 시 데모 모드로 전환해 UI를 계속 볼 수 있습니다.
- 상품 데이터는 `src/catalog.ts`에 분리되어 있어 안경 상품을 쉽게 추가할 수 있습니다.
