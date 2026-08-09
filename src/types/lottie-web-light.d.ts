/**
 * `lottie-web` ships no `exports` map, so the ESM light build is imported by
 * path. Only the one call this project uses is typed.
 */
declare module "lottie-web/build/player/esm/lottie_light.min.js" {
  interface LottieAnimation {
    destroy: () => void;
    goToAndStop: (value: number, isFrame?: boolean) => void;
  }
  interface LottiePlayer {
    loadAnimation: (config: {
      container: Element;
      renderer: "svg";
      loop: boolean;
      autoplay: boolean;
      animationData: unknown;
      rendererSettings?: Record<string, unknown>;
    }) => LottieAnimation;
  }
  const lottie: LottiePlayer;
  export default lottie;
}
