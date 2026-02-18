"use client";

import { Modal, Slider } from "antd";
import Cropper, { type Area } from "react-easy-crop";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MemberImageCropModalProps } from "./types";
import {
  CENTERED_CROP,
  CROPPER_RENDER_DELAY_MS,
  MEMBER_CROP_SIZE,
  createCroppedImageFile,
} from "./member-image-crop";

export function MemberImageCropModal({
  open,
  imageSrc,
  imageName,
  imageType,
  onCancel,
  onApply,
}: MemberImageCropModalProps) {
  const [crop, setCrop] = useState(CENTERED_CROP);
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area>();
  const [isCropperReady, setIsCropperReady] = useState(false);
  const cropperTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const clearCropperTimer = useCallback(() => {
    if (!cropperTimerRef.current) return;
    clearTimeout(cropperTimerRef.current);
    cropperTimerRef.current = undefined;
  }, []);

  const resetCropState = useCallback(() => {
    setCrop(CENTERED_CROP);
    setZoom(1);
    setCroppedAreaPixels(undefined);
  }, []);

  const handleCropModalOpenChange = useCallback(
    (nextOpen: boolean) => {
      clearCropperTimer();
      setIsCropperReady(false);
      resetCropState();

      if (!nextOpen || !imageSrc) return;

      cropperTimerRef.current = setTimeout(() => {
        setIsCropperReady(true);
      }, CROPPER_RENDER_DELAY_MS);
    },
    [clearCropperTimer, imageSrc, resetCropState],
  );

  const handleCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleApplyCrop = useCallback(async () => {
    if (!imageSrc || !imageName || !croppedAreaPixels) return;

    const croppedFile = await createCroppedImageFile(
      imageSrc,
      croppedAreaPixels,
      imageName,
      imageType ?? "image/jpeg",
    );
    onApply(croppedFile);
  }, [croppedAreaPixels, imageName, imageSrc, imageType, onApply]);

  useEffect(() => () => clearCropperTimer(), [clearCropperTimer]);

  return (
    <Modal
      open={open}
      title="Crop image"
      onOk={() => void handleApplyCrop()}
      onCancel={onCancel}
      afterOpenChange={handleCropModalOpenChange}
      okText="Apply"
      cancelText="Cancel"
      okButtonProps={{ disabled: !croppedAreaPixels }}
      destroyOnHidden
      maskClosable={false}
    >
      <div
        className="relative mx-auto rounded-lg overflow-hidden bg-black/75"
        style={{ width: MEMBER_CROP_SIZE, height: MEMBER_CROP_SIZE }}
      >
        {imageSrc && isCropperReady && (
          <Cropper
            key={imageSrc}
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            minZoom={1}
            maxZoom={3}
            aspect={1}
            onCropChange={setCrop}
            onCropComplete={handleCropComplete}
            onZoomChange={setZoom}
            showGrid
            restrictPosition
            classes={{ containerClassName: "absolute inset-0" }}
          />
        )}
        {imageSrc && !isCropperReady && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
            Preparing cropper...
          </div>
        )}
      </div>
      <div className="mt-6">
        <p className="mb-2">Zoom</p>
        <Slider
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(value) =>
            setZoom(typeof value === "number" ? value : value[0])
          }
        />
      </div>
    </Modal>
  );
}
