import { useEffect, useRef, useState } from "react";

export function useHideOnScroll() {
  const [isVisible, setIsVisible] = useState(true);
  const previousScrollY = useRef(0);

  useEffect(() => {
    previousScrollY.current = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = Math.max(0, window.scrollY);

      if (currentScrollY === 0) {
        setIsVisible(true);
      } else if (currentScrollY < previousScrollY.current) {
        setIsVisible(true);
      } else if (currentScrollY > previousScrollY.current) {
        setIsVisible(false);
      }

      previousScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return isVisible;
}
