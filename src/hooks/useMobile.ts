import { useState, useEffect } from 'react';

/**
 * Hook to detect mobile devices and provide responsive breakpoints
 * Does NOT change any desktop behavior - only provides detection
 */
export function useMobile() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    // Check for touch capability
    const checkTouch = () => {
      return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    };

    // Check screen size
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
    };

    // Initial checks
    setIsTouchDevice(checkTouch());
    checkScreenSize();

    // Combined mobile detection (touch device OR small screen)
    const updateMobile = () => {
      checkScreenSize();
      setIsTouchDevice(checkTouch());
    };

    // Listen for resize
    window.addEventListener('resize', updateMobile);

    return () => {
      window.removeEventListener('resize', updateMobile);
    };
  }, []);

  return {
    isMobile,
    isTablet,
    isTouchDevice,
    isDesktop: !isMobile && !isTablet,
    // Helper for conditional rendering
    isMobileOrTablet: isMobile || isTablet,
  };
}

/**
 * Get optimal DPR for current device
 * Returns higher DPR for desktop, limited DPR for mobile
 */
export function getOptimalDpr(): number {
  const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const dpr = window.devicePixelRatio || 1;

  if (isMobileDevice) {
    // Limit DPR on mobile to improve performance
    return Math.min(dpr, 1.5);
  }

  // Desktop gets full DPR (up to 2)
  return Math.min(dpr, 2);
}
