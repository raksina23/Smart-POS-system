"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  BrowserMultiFormatReader,
  IScannerControls,
} from "@zxing/browser";
import { DecodeHintType, BarcodeFormat, NotFoundException } from "@zxing/library";
import { useI18n } from "../lib/i18n";

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  cooldownMs?: number;
}

function describeCameraError(err: unknown, isEn: boolean): string {
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "";

  if (typeof window !== "undefined" && !window.isSecureContext) {
    return isEn
      ? "Camera requires HTTPS or localhost."
      : "ต้องเปิดผ่าน HTTPS หรือ localhost เท่านั้น";
  }
  if (name === "NotAllowedError" || message.includes("Permission")) {
    return isEn
      ? "Camera permission was denied."
      : "ไม่ได้รับอนุญาตให้ใช้กล้อง";
  }
  if (name === "NotFoundError" || message.includes("Requested device not found")) {
    return isEn
      ? "No camera was found on this device."
      : "ไม่พบกล้องบนอุปกรณ์นี้";
  }
  if (name === "NotReadableError") {
    return isEn
      ? "The camera is already in use by another app or tab."
      : "กล้องถูกใช้งานโดยแอปหรือแท็บอื่นอยู่";
  }
  return isEn
    ? `Couldn't start the camera: ${message}`
    : `เปิดกล้องไม่สำเร็จ: ${message}`;
}

function CameraIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 7h3l2-2h6l2 2h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function AlertIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TorchIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function BarcodeScanner({ onScan, cooldownMs = 1500 }: BarcodeScannerProps) {
  const { locale } = useI18n();
  const isEn = locale?.toLowerCase().startsWith("en") ?? false;

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastScanRef = useRef<number>(0);
  const onScanRef = useRef(onScan);

  const [rawError, setRawError] = useState<unknown>(null);
  const [ready, setReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let cancelled = false;
    setRawError(null);
    setReady(false);

    // Explicitly restrict to the barcode formats you actually need —
    // ZXing tries fewer formats per frame this way, which speeds up
    // and improves decode accuracy versus scanning for everything.
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.QR_CODE,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints);

    const start = async () => {
      try {
        const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (videoInputDevices.length === 0) {
          throw Object.assign(new Error("Requested device not found"), { name: "NotFoundError" });
        }

        // Prefer the back/environment camera on phones
        const backCamera =
          videoInputDevices.find((d) => /back|rear|environment/i.test(d.label)) ??
          videoInputDevices[videoInputDevices.length - 1];

        const controls = await reader.decodeFromVideoDevice(
          backCamera.deviceId,
          videoRef.current!,
          (result, err) => {
            if (result) {
              const text = result.getText();
              const now = Date.now();
              if (now - lastScanRef.current < cooldownMs) return;
              lastScanRef.current = now;

              onScanRef.current(text);
              return;
            }
            // NotFoundException fires continuously while nothing is in
            // frame yet — expected, not a real error, so we ignore it.
            if (err && !(err instanceof NotFoundException)) {
              console.error("scan frame error:", err);
            }
          }
        );

        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        setReady(true);

        // Check if this device/camera supports a torch (flashlight)
        const track = (videoRef.current?.srcObject as MediaStream)
          ?.getVideoTracks()?.[0];
        const capabilities = track?.getCapabilities?.() as
          | (MediaTrackCapabilities & { torch?: boolean })
          | undefined;
        setTorchSupported(!!capabilities?.torch);
      } catch (err) {
        console.error("Failed to start camera:", err);
        if (!cancelled) setRawError(err);
      }
    };

    start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [cooldownMs]);

  const toggleTorch = async () => {
    const track = (videoRef.current?.srcObject as MediaStream)?.getVideoTracks()?.[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: next } as any],
      });
      setTorchOn(next);
    } catch (err) {
      console.log("Torch toggle failed:", err);
    }
  };

  const errorMessage = rawError !== null ? describeCameraError(rawError, isEn) : null;

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        muted
        playsInline
      />

      {!ready && !errorMessage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-gray-100 text-gray-600 text-sm font-medium px-4 text-center pointer-events-none">
          <div className="w-11 h-11 rounded-2xl bg-white shadow-sm border border-gray-200/80 flex items-center justify-center text-gray-500">
            <CameraIcon className="w-6 h-6 animate-pulse" />
          </div>
          <span>{isEn ? "Starting camera..." : "กำลังเปิดกล้อง..."}</span>
        </div>
      )}

      {errorMessage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-red-50 p-4 text-center">
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
            <AlertIcon className="w-5 h-5" />
          </div>
          <p className="text-red-600 text-sm font-semibold leading-relaxed">
            {errorMessage}
          </p>
        </div>
      )}

      {ready && torchSupported && (
        <button
          type="button"
          onClick={toggleTorch}
          className={`absolute bottom-3 left-3 flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-xl shadow-sm backdrop-blur-sm active:scale-95 transition z-10 ${
            torchOn
              ? "bg-amber-500 text-white"
              : "bg-black/65 text-white hover:bg-black/80"
          }`}
        >
          <TorchIcon className="w-4 h-4 shrink-0" />
          <span>
            {torchOn
              ? isEn
                ? "Torch off"
                : "ปิดไฟฉาย"
              : isEn
              ? "Torch on"
              : "เปิดไฟฉาย"}
          </span>
        </button>
      )}
    </div>
  );
}