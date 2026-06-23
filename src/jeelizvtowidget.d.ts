declare module 'jeelizvtowidget' {
  interface StartOptions {
    isShadow?: boolean;
    sku?: string;
    searchImageMask?: string;
    searchImageColor?: number;
    searchImageRotationSpeed?: number;
    callbackReady?: () => void;
    onError?: (errorLabel: string) => void;
  }

  export const JEELIZVTOWIDGET: {
    start(options: StartOptions): void;
    load(sku: string): void;
    enter_adjustMode(): void;
    exit_adjustMode(): void;
    capture_image?(): string;
    destroy?(): void;
  };
}
