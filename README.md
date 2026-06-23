# Jeeliz VTO Widget Demo

Jeeliz `jeelizGlassesVTOWidget`을 사용하는 웹 기반 안경 가상 피팅 데모입니다.
upstream 예제와 같은 DOM 구조, 버튼 구성, SKU 전환 흐름을 사용합니다.

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

`jeelizvtowidget`은 Jeeliz VTO commercial software license를 따릅니다.
공개/상업 사용 전에 Jeeliz의 최신 라이선스와 가격 조건을 확인하세요.
