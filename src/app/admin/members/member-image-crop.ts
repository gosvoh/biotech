export const MEMBER_CROP_SIZE = 320;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;
export const ZOOM_STEP = 0.01;

/** A crop rectangle expressed in the source image's natural pixels. */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The displayed image's pixel offset (top-left) within the crop frame. */
export interface CropOffset {
  x: number;
  y: number;
}

/** Natural size of the loaded image plus the scale that makes it cover the frame. */
export interface MediaGeometry {
  naturalWidth: number;
  naturalHeight: number;
  /** Scale at zoom 1 so the smaller side exactly covers the square frame. */
  baseScale: number;
}

function clamp(value: number, min: number, max: number) {
  // When the image is smaller than the frame the bounds can invert; keep it sane.
  if (max < min) return (min + max) / 2;
  return Math.min(Math.max(value, min), max);
}

export function getMediaGeometry(
  naturalWidth: number,
  naturalHeight: number,
  frame = MEMBER_CROP_SIZE,
): MediaGeometry {
  const baseScale = Math.max(frame / naturalWidth, frame / naturalHeight);
  return { naturalWidth, naturalHeight, baseScale };
}

function displayedSize(geometry: MediaGeometry, zoom: number) {
  const scale = geometry.baseScale * zoom;
  return {
    width: geometry.naturalWidth * scale,
    height: geometry.naturalHeight * scale,
  };
}

/** Clamp the offset so the image always fully covers the frame (no empty edges). */
export function clampOffset(
  offset: CropOffset,
  geometry: MediaGeometry,
  zoom: number,
  frame = MEMBER_CROP_SIZE,
): CropOffset {
  const { width, height } = displayedSize(geometry, zoom);
  return {
    x: clamp(offset.x, frame - width, 0),
    y: clamp(offset.y, frame - height, 0),
  };
}

/** Offset that centers the image within the frame. */
export function centerOffset(
  geometry: MediaGeometry,
  zoom: number,
  frame = MEMBER_CROP_SIZE,
): CropOffset {
  const { width, height } = displayedSize(geometry, zoom);
  return { x: (frame - width) / 2, y: (frame - height) / 2 };
}

/**
 * Recompute the offset when zooming so the frame center stays anchored on the same
 * point of the image, then re-clamp to keep the frame covered.
 */
export function zoomAroundCenter(
  offset: CropOffset,
  geometry: MediaGeometry,
  prevZoom: number,
  nextZoom: number,
  frame = MEMBER_CROP_SIZE,
): CropOffset {
  const prev = displayedSize(geometry, prevZoom);
  const next = displayedSize(geometry, nextZoom);
  const center = frame / 2;
  const fracX = prev.width > 0 ? (center - offset.x) / prev.width : 0.5;
  const fracY = prev.height > 0 ? (center - offset.y) / prev.height : 0.5;
  return clampOffset(
    { x: center - fracX * next.width, y: center - fracY * next.height },
    geometry,
    nextZoom,
    frame,
  );
}

/** Map the current frame view to a crop rectangle in source pixels. */
export function getCropArea(
  offset: CropOffset,
  geometry: MediaGeometry,
  zoom: number,
  frame = MEMBER_CROP_SIZE,
): CropArea {
  const scale = geometry.baseScale * zoom;
  return {
    x: -offset.x / scale,
    y: -offset.y / scale,
    width: frame / scale,
    height: frame / scale,
  };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export async function createCroppedImageFile(
  imageSrc: string,
  cropArea: CropArea,
  fileName: string,
  mimeType: string,
) {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const outputWidth = Math.max(1, Math.round(cropArea.width));
  const outputHeight = Math.max(1, Math.round(cropArea.height));

  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Failed to create canvas context");

  context.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  const outputMimeType = mimeType.startsWith("image/")
    ? mimeType
    : "image/jpeg";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) return reject(new Error("Failed to crop image"));
        resolve(result);
      },
      outputMimeType,
      0.95,
    );
  });

  const baseName = fileName.replace(/\.[^.]+$/, "");
  const extension =
    blob.type === "image/png"
      ? "png"
      : blob.type === "image/webp"
        ? "webp"
        : "jpg";

  return new File([blob], `${baseName}.${extension}`, { type: blob.type });
}
