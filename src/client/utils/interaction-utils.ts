export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(element?.closest("input, textarea, [contenteditable='true']"));
}

const GPU_ACCEL_DISABLED_CLASS = "gpu-accel-off";
let gpuPolicyMounted = false;

function isMobileGpuFallbackTarget(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean; platform?: string } };
  const userAgent = navigator.userAgent;
  const normalizedPlatform = (nav.userAgentData?.platform ?? navigator.platform ?? "").toLowerCase();
  const uaDataMobile = nav.userAgentData?.mobile === true;
  const uaMobileOrTablet = /android|iphone|ipad|ipod|mobile|tablet|silk|kindle|playbook|opera mini|opera mobi/i.test(userAgent);
  const platformMobileOrTablet = /android|ios|ipados|iphone|ipad|ipod/.test(normalizedPlatform);
  const isIpadOsDesktopUa = normalizedPlatform === "macintel" && navigator.maxTouchPoints > 1;
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const hasNoHover = window.matchMedia("(hover: none)").matches;
  const likelyTouchFirstDevice = isCoarsePointer && hasNoHover;
  return uaDataMobile || uaMobileOrTablet || platformMobileOrTablet || isIpadOsDesktopUa || likelyTouchFirstDevice;
}

function applyGpuAccelerationPolicyClass(): void {
  document.documentElement.classList.toggle(GPU_ACCEL_DISABLED_CLASS, isMobileGpuFallbackTarget());
}

export function mountGpuAccelerationPolicy(): void {
  if (gpuPolicyMounted) {
    return;
  }

  gpuPolicyMounted = true;
  applyGpuAccelerationPolicyClass();

  const onViewportChange = (): void => {
    applyGpuAccelerationPolicyClass();
  };

  window.addEventListener("resize", onViewportChange, { passive: true });
  window.addEventListener("orientationchange", onViewportChange);

  const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
  const noHoverQuery = window.matchMedia("(hover: none)");

  if (typeof coarsePointerQuery.addEventListener === "function") {
    coarsePointerQuery.addEventListener("change", onViewportChange);
    noHoverQuery.addEventListener("change", onViewportChange);
  } else {
    coarsePointerQuery.addListener(onViewportChange);
    noHoverQuery.addListener(onViewportChange);
  }
}

export function shouldAutoScrollInviteJoin(): boolean {
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const isSmallViewport = window.matchMedia("(max-width: 1100px)").matches;
  return isCoarsePointer || isSmallViewport;
}

export function isElementMostlyVisible(element: HTMLElement, minVisibleRatio = 0.68): boolean {
  const rect = element.getBoundingClientRect();
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

  const visibleWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
  const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
  const visibleArea = visibleWidth * visibleHeight;
  const totalArea = Math.max(1, rect.width * rect.height);
  return visibleArea / totalArea >= minVisibleRatio;
}
