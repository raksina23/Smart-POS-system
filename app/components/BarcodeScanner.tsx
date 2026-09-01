"use client";
import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface BarcodeScannerProps {
  // Called every time a barcode is successfully decoded from the camera.
  onScan: (decodedText: string) => void;
  // Optional: pause scanning briefly after a hit, so the same barcode
  // sitting in front of the camera doesn't get scanned 10x in a row.
  cooldownMs?: number;
}

// Turns whatever the browser/library throws into a short, readable message —
// so testing on a phone (no dev console handy) still tells you what's wrong.
function describeCameraError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "";

  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "ต้องเปิดผ่าน HTTPS หรือ localhost เท่านั้น กล้องจะไม่ทำงานบน http:// ธรรมดา / Camera requires HTTPS or localhost — plain http:// (like an IP address) won't work.";
  }
  if (name === "NotAllowedError" || message.includes("Permission")) {
    return "ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณาอนุญาตการเข้าถึงกล้องในเบราว์เซอร์ / Camera permission was denied — allow camera access in your browser settings.";
  }
  if (name === "NotFoundError" || message.includes("Requested device not found")) {
    return "ไม่พบกล้องบนอุปกรณ์นี้ / No camera was found on this device.";
  }
  if (name === "NotReadableError") {
    return "กล้องถูกใช้งานโดยแอปอื่นอยู่ / The camera is already in use by another app or tab.";
  }
  return `เปิดกล้องไม่สำเร็จ / Couldn't start the camera: ${message}`;
}

export default function BarcodeScanner({ onScan, cooldownMs = 1500 }: BarcodeScannerProps) {
  const containerId = "barcode-scanner-region";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let scanner: Html5Qrcode;

    try {
      scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;
    } catch (err) {
      setError(describeCameraError(err));
      return;
    }

    scanner
      .start(
        { facingMode: "environment" }, // rear camera on phones
        {
          fps: 10,
          qrbox: { width: 250, height: 120 }, // wide box suits 1D barcodes
        },
        (decodedText) => {
          const now = Date.now();
          if (now - lastScanRef.current < cooldownMs) return; // debounce
          lastScanRef.current = now;
          onScan(decodedText);
        },
        () => {
          // Fires continuously while no barcode is in frame — intentionally
          // ignored, this isn't an error, just "nothing found this frame".
        }
      )
      .then(() => setReady(true))
      .catch((err) => {
        console.error("Failed to start camera:", err);
        setError(describeCameraError(err));
      });

    // Cleanup: stop the camera when this component unmounts, otherwise
    // the camera stays "on" in the browser even after leaving the page.
    return () => {
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => {
          /* already stopped, ignore */
        });
    };
  }, [onScan, cooldownMs]);

  return (
    <div className="relative w-full h-full">
      <div id={containerId} className="w-full h-full" />

      {/* Loading state — shown until the camera stream actually starts */}
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 text-gray-500 text-sm font-medium pointer-events-none">
          📷 กำลังเปิดกล้อง... / Starting camera...
        </div>
      )}

      {/* Error state — visible on-screen so it's readable on a phone
          without needing to open dev tools */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 p-3">
          <p className="text-red-600 text-xs font-medium text-center leading-snug">
            ⚠️ {error}
          </p>
        </div>
      )}
    </div>
  );
}