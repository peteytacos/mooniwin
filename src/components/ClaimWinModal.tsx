"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Step = "primer" | "camera" | "preview";

export default function ClaimWinModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("primer");
  const [location, setLocation] = useState("locating...");
  const [cardImageUrl, setCardImageUrl] = useState<string | null>(null);
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment"
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [winId, setWinId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const locationRef = useRef("locating...");

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  const fetchLocation = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json&zoom=10`
          );
          const data = await res.json();
          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            "";
          const state = data.address?.state || "";
          const country = data.address?.country || "";
          const loc = city
            ? `${city}, ${state || country}`
            : state || country || "Earth";
          setLocation(loc);
        } catch {
          setLocation("Earth");
        }
      },
      () => setLocation("Earth"),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Connect stream when video element mounts
  const videoRefCallback = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (el && streamRef.current) {
        el.srcObject = streamRef.current;
        el.play().catch(() => {});
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step]
  );

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera is not available in this browser.");
      return;
    }
    setCameraError(null);
    stopCamera();
    fetchLocation();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setStep("camera");
    } catch {
      setCameraError(
        "Camera access is needed to capture your win. Please allow camera access and try again."
      );
    }
  }, [facingMode, stopCamera, fetchLocation]);

  const flipCamera = useCallback(async () => {
    const newMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newMode);
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: newMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      // If exact fails (single camera), try without exact
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: newMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {}
    }
  }, [facingMode, stopCamera]);

  const generateWinCard = useCallback(async (photoDataUrl: string) => {
    const cardW = 1080;
    const cardH = 1350;
    const canvas = document.createElement("canvas");
    canvas.width = cardW;
    canvas.height = cardH;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cardW, cardH);

    // Load and draw photo
    const img = new Image();
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = photoDataUrl;
    });

    const photoH = cardH * 0.75;
    const imgAspect = img.width / img.height;
    const areaAspect = cardW / photoH;
    let sx = 0,
      sy = 0,
      sw = img.width,
      sh = img.height;
    if (imgAspect > areaAspect) {
      sw = img.height * areaAspect;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / areaAspect;
      sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cardW, photoH);

    // Gradient fade from photo to black
    const grad = ctx.createLinearGradient(0, photoH - 250, 0, photoH);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, photoH - 250, cardW, 250);

    // Text
    ctx.textAlign = "center";

    // "Moon, I win!" with golden glow
    ctx.shadowColor = "#fde68a";
    ctx.shadowBlur = 30;
    ctx.fillStyle = "#fde68a";
    ctx.font = "bold 80px system-ui, -apple-system, sans-serif";
    ctx.fillText("Moon, I win!", cardW / 2, photoH + 80);
    ctx.shadowBlur = 0;

    // "Better luck tomorrow!"
    ctx.fillStyle = "#ffffff";
    ctx.font = "300 40px system-ui, -apple-system, sans-serif";
    ctx.fillText("Better luck tomorrow, nerd \u{1F61B}", cardW / 2, photoH + 145);

    // Timestamp
    const now = new Date();
    const ts =
      now.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }) +
      " \u00B7 " +
      now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "28px system-ui, -apple-system, sans-serif";
    ctx.fillText(ts, cardW / 2, photoH + 210);

    // Location
    ctx.fillText(locationRef.current, cardW / 2, photoH + 248);

    // Watermark
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.font = "24px system-ui, -apple-system, sans-serif";
    ctx.fillText("mooniwin.com", cardW / 2, cardH - 30);

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.92);
    });
    const url = URL.createObjectURL(blob);
    setCardImageUrl(url);
    setCardBlob(blob);
    setStep("preview");

    // Upload in background for shareable link
    const fd = new FormData();
    fd.append("image", blob, "win.jpg");
    fetch("/api/wins", { method: "POST", body: fd })
      .then((res) => res.json())
      .then((data) => setWinId(data.id))
      .catch(() => {});
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    setFlash(true);
    setTimeout(() => setFlash(false), 150);

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    stopCamera();
    generateWinCard(dataUrl);
  }, [stopCamera, generateWinCard]);

  const handleShare = useCallback(async () => {
    if (!cardBlob) return;
    const shareUrl = winId
      ? `https://mooniwin.com/w/${winId}`
      : "https://mooniwin.com/";
    const file = new File([cardBlob], "moon-i-win.jpg", {
      type: "image/jpeg",
    });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          url: shareUrl,
        });
        return;
      } catch {
        /* user cancelled */
      }
    }
    // Fallback: download image
    if (cardImageUrl) {
      const a = document.createElement("a");
      a.href = cardImageUrl;
      a.download = "moon-i-win.jpg";
      a.click();
    }
  }, [cardBlob, cardImageUrl, winId]);

  const handleRetake = useCallback(() => {
    if (cardImageUrl) URL.revokeObjectURL(cardImageUrl);
    setCardImageUrl(null);
    setCardBlob(null);
    setWinId(null);
    startCamera();
  }, [startCamera, cardImageUrl]);

  const handleClose = useCallback(() => {
    stopCamera();
    if (cardImageUrl) URL.revokeObjectURL(cardImageUrl);
    setStep("primer");
    setCardImageUrl(null);
    setCardBlob(null);
    setWinId(null);
    setCameraError(null);
    onClose();
  }, [stopCamera, onClose, cardImageUrl]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const now = new Date();
  const exampleTimestamp =
    now.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }) +
    " \u00B7 " +
    now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center cursor-none"
          onClick={handleClose}
        >
          <motion.div
            initial={{ backdropFilter: "blur(0px)" }}
            animate={{ backdropFilter: "blur(12px)" }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 bg-black/85"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleClose}
              className="absolute -top-10 right-0 text-white/30 hover:text-white/70 transition-colors text-lg cursor-none z-20"
            >
              &#x2715;
            </button>

            <AnimatePresence mode="wait">
              {step === "primer" && (
                <motion.div
                  key="primer"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="bg-black rounded-2xl overflow-hidden border border-white/[0.15]"
                >
                  <div className="p-5 pb-3">
                    <h2 className="text-xl font-bold text-white tracking-tight">
                      capture your victory
                    </h2>
                    <p className="text-white/40 text-sm mt-1.5 leading-relaxed">
                      don&apos;t be alarmed, we&apos;re going to ask your
                      permission to use your camera and location to generate
                      proof that you&apos;ve won today.
                    </p>
                    <p className="text-white/40 text-sm mt-3 leading-relaxed">
                      we definitely don&apos;t store any of your data, this is
                      just a silly website!
                    </p>
                    <p className="text-white/40 text-sm mt-3 leading-relaxed">
                      below is an example of the card we&apos;ll generate:
                    </p>
                  </div>

                  <div className="mx-5 rounded-xl overflow-hidden border border-white/[0.15]">
                    <div className="relative aspect-[16/10] bg-gradient-to-b from-[#0f172a] to-black">
                      <img
                        src="/win-placeholder.png"
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                    </div>
                    <div className="bg-black px-4 pb-4 -mt-8 relative">
                      <p className="text-[#fde68a] font-bold text-lg tracking-tight text-glow">
                        Moon, I win!
                      </p>
                      <p className="text-white/80 text-sm mt-0.5">
                        Better luck tomorrow, nerd 😛
                      </p>
                      <div className="flex items-center gap-1.5 mt-2.5 text-white/30 text-xs">
                        <span>{exampleTimestamp}</span>
                        <span>&middot;</span>
                        <span>{location}</span>
                      </div>
                    </div>
                  </div>

                  {cameraError && (
                    <p className="mx-5 mt-3 text-red-400/80 text-xs leading-relaxed">
                      {cameraError}
                    </p>
                  )}

                  <div className="p-5 pt-4">
                    <button
                      onClick={startCamera}
                      className="w-full py-3 bg-black text-white font-bold rounded-lg border border-white/[0.15] hover:bg-white/[0.06] active:scale-[0.98] transition-all cursor-none text-sm tracking-tight"
                    >
                      capture my win
                    </button>
                  </div>
                </motion.div>
              )}

              {step === "camera" && (
                <motion.div
                  key="camera"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="bg-black rounded-2xl overflow-hidden border border-white/[0.15]"
                >
                  <div className="relative aspect-[3/4] bg-black rounded-t-2xl overflow-hidden">
                    <video
                      ref={videoRefCallback}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                      style={
                        facingMode === "user"
                          ? { transform: "scaleX(-1)" }
                          : undefined
                      }
                    />

                    {flash && (
                      <motion.div
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="absolute inset-0 bg-white z-10"
                      />
                    )}

                    <div className="absolute bottom-0 inset-x-0 pb-6 pt-16 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-center gap-10">
                      <button
                        onClick={flipCamera}
                        className="w-10 h-10 flex items-center justify-center text-white/40 hover:text-white text-xl cursor-none rounded-full bg-white/[0.06] hover:bg-white/[0.1] transition-colors"
                      >
                        &#x21bb;
                      </button>
                      <button
                        onClick={capturePhoto}
                        className="w-[72px] h-[72px] rounded-full border-[3px] border-white cursor-none flex items-center justify-center group"
                      >
                        <div className="w-[60px] h-[60px] rounded-full bg-white group-hover:bg-white/90 group-active:bg-white/70 transition-colors" />
                      </button>
                      <div className="w-10 h-10" />
                    </div>
                  </div>
                </motion.div>
              )}

              {step === "preview" && cardImageUrl && (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="bg-black rounded-2xl overflow-hidden border border-white/[0.15]"
                >
                  <div className="p-4">
                    <img
                      src={cardImageUrl}
                      alt="Your win card"
                      className="w-full rounded-lg"
                    />
                  </div>
                  <div className="px-4 pb-4 space-y-3">
                    <button
                      onClick={handleShare}
                      className="w-full py-3 bg-black text-white font-bold rounded-lg border border-white/[0.15] hover:bg-white/[0.06] active:scale-[0.98] transition-all cursor-none text-sm tracking-tight"
                    >
                      share your win
                    </button>
                    <button
                      onClick={handleRetake}
                      className="w-full py-2 text-white/30 hover:text-white/60 font-medium transition-colors cursor-none text-xs"
                    >
                      retake
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
