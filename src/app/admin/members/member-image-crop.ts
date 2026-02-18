import type { Area } from "react-easy-crop";

export const MEMBER_CROP_SIZE = 320;
export const CENTERED_CROP = { x: 0, y: 0 };
export const CROPPER_RENDER_DELAY_MS = 100;

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
  cropArea: Area,
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
