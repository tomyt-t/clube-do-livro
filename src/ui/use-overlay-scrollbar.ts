import { useEffect, useRef } from 'react';

const HIDE_AFTER_MS = 650;
const MIN_THUMB = 24;

/**
 * A thin scroll indicator drawn over a scrolling area instead of the native
 * scrollbar (which shows arrows on some systems). It appears only while the
 * area scrolls, follows with a short lag (a CSS transition) and fades out.
 * Put `areaRef` on the scrolling element and `barRef` on a sibling overlay.
 */
export function useOverlayScrollbar<A extends HTMLElement, B extends HTMLElement>() {
  const areaRef = useRef<A>(null);
  const barRef = useRef<B>(null);

  useEffect(() => {
    const area = areaRef.current;
    const bar = barRef.current;
    if (!area || !bar) return;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = area;
      if (scrollHeight <= clientHeight) return;
      const height = Math.max(MIN_THUMB, (clientHeight * clientHeight) / scrollHeight);
      const offset = (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - height);
      bar.style.top = `${String(area.offsetTop)}px`;
      bar.style.height = `${String(height)}px`;
      bar.style.transform = `translateY(${String(offset)}px)`;
      bar.dataset.visible = 'true';
      clearTimeout(timer);
      timer = setTimeout(() => {
        delete bar.dataset.visible;
      }, HIDE_AFTER_MS);
    };

    area.addEventListener('scroll', update, { passive: true });
    return () => {
      area.removeEventListener('scroll', update);
      clearTimeout(timer);
    };
  }, []);

  return { areaRef, barRef };
}
