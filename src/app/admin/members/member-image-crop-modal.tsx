"use client";

import { Modal } from "antd";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent,
} from "react";
import type { MemberImageCropModalProps } from "./types";
import {
  MAX_ZOOM,
  MEMBER_CROP_SIZE,
  MIN_ZOOM,
  ZOOM_STEP,
  centerOffset,
  clampOffset,
  createCroppedImageFile,
  getCropArea,
  getMediaGeometry,
  zoomAroundCenter,
  type CropOffset,
  type MediaGeometry,
} from "./member-image-crop";

interface CropView {
  zoom: number;
  offset: CropOffset;
}

const INITIAL_VIEW: CropView = { zoom: MIN_ZOOM, offset: { x: 0, y: 0 } };

export function MemberImageCropModal({
  open,
  imageSrc,
  imageName,
  imageType,
  onCancel,
  onApply,
}: MemberImageCropModalProps) {
  // zoom + offset live in one atomic state so a single (pure) updater can move both.
  const [view, setView] = useState<CropView>(INITIAL_VIEW);
  const [geometry, setGeometry] = useState<MediaGeometry>();
  const [loadedSrc, setLoadedSrc] = useState(imageSrc);
  const { zoom, offset } = view;

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffset: CropOffset;
  } | null>(null);
  // The native range fires a burst of `input` events when the track is click-held
  // (the browser animates the thumb). Applying state per event re-renders the antd
  // Modal each time, whose class-component lifecycle schedules a nested update, and the
  // burst trips React's max-update-depth guard. Coalescing to one update per animation
  // frame keeps updates spaced across frames (and is cheaper).
  const rafRef = useRef<number | null>(null);
  const pendingZoomRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  // Reset state when the source image changes (the modal instance is reused between
  // uploads) so stale geometry/offset never leaks into a new image. Adjusting state
  // during render is React's recommended alternative to a reset effect.
  if (imageSrc !== loadedSrc) {
    setLoadedSrc(imageSrc);
    setView(INITIAL_VIEW);
    setGeometry(undefined);
  }

  const handleImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth, naturalHeight } = event.currentTarget;
      if (!naturalWidth || !naturalHeight) return;
      const nextGeometry = getMediaGeometry(naturalWidth, naturalHeight);
      setGeometry(nextGeometry);
      setView({ zoom: MIN_ZOOM, offset: centerOffset(nextGeometry, MIN_ZOOM) });
    },
    [],
  );

  const handleZoom = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextZoom = Number(event.target.value);
      if (!Number.isFinite(nextZoom)) return;
      pendingZoomRef.current = nextZoom;
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const next = pendingZoomRef.current;
        pendingZoomRef.current = null;
        if (next === null) return;
        setView((prev) =>
          geometry
            ? {
                zoom: next,
                offset: zoomAroundCenter(prev.offset, geometry, prev.zoom, next),
              }
            : { ...prev, zoom: next },
        );
      });
    },
    [geometry],
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!geometry) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startOffset: offset,
      };
    },
    [geometry, offset],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || !geometry || drag.pointerId !== event.pointerId) return;
      const next = {
        x: drag.startOffset.x + (event.clientX - drag.startX),
        y: drag.startOffset.y + (event.clientY - drag.startY),
      };
      setView((prev) => ({
        ...prev,
        offset: clampOffset(next, geometry, prev.zoom),
      }));
    },
    [geometry],
  );

  const handlePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer may already be released; ignore.
    }
    dragRef.current = null;
  }, []);

  const handleApplyCrop = useCallback(async () => {
    if (!imageSrc || !imageName || !geometry) return;
    const cropArea = getCropArea(offset, geometry, zoom);
    const croppedFile = await createCroppedImageFile(
      imageSrc,
      cropArea,
      imageName,
      imageType ?? "image/jpeg",
    );
    onApply(croppedFile);
  }, [geometry, imageName, imageSrc, imageType, offset, onApply, zoom]);

  // Layout size is fixed (zoom-1 cover size); pan/zoom are applied via `transform`
  // only, which is composited and never triggers reflow. Changing width/height/left/top
  // here instead would relayout the image on every zoom tick.
  const baseWidth = geometry ? geometry.naturalWidth * geometry.baseScale : 0;
  const baseHeight = geometry ? geometry.naturalHeight * geometry.baseScale : 0;
  const zoomPercent = ((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100;

  return (
    <Modal
      open={open}
      title="Обрезка изображения"
      onOk={() => void handleApplyCrop()}
      onCancel={onCancel}
      okText="Применить"
      cancelText="Отмена"
      okButtonProps={{ disabled: !geometry }}
      destroyOnHidden
      mask={{ closable: false }}
    >
      <div
        className="relative mx-auto touch-none select-none overflow-hidden rounded-lg bg-black/75"
        style={{
          width: MEMBER_CROP_SIZE,
          height: MEMBER_CROP_SIZE,
          cursor: geometry ? "move" : "default",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {imageSrc && (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview needs raw transform/natural-size control; next/image is unsuitable here
          <img
            key={imageSrc}
            src={imageSrc}
            alt=""
            draggable={false}
            onLoad={handleImageLoad}
            className="absolute left-0 top-0 max-w-none"
            style={{
              width: baseWidth,
              height: baseHeight,
              transformOrigin: "0 0",
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              opacity: geometry ? 1 : 0,
            }}
          />
        )}
        {!geometry && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
            Loading image...
          </div>
        )}
      </div>
      <div className="mt-6">
        <p className="mb-2">Zoom</p>
        <input
          // Uncontrolled (defaultValue + key reset per image) so React never re-asserts
          // the DOM value and never fights the browser's own thumb animation. zoom state
          // mirrors the value (via the rAF-coalesced onChange) for the crop math and fill.
          key={imageSrc}
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={ZOOM_STEP}
          defaultValue={MIN_ZOOM}
          onChange={handleZoom}
          disabled={!geometry}
          aria-label="Zoom"
          className="crop-zoom-slider"
          style={{ "--crop-zoom-pct": `${zoomPercent}%` } as CSSProperties}
        />
      </div>
    </Modal>
  );
}
