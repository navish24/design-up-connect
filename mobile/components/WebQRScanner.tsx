import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Spacing, FontSize, FontWeight, Radius } from '../constants/theme';
// Static import — dynamic import inside RAF loop fails silently on iOS Safari
import jsQR from 'jsqr';

interface Props {
  active: boolean;
  onScan: (data: string) => void;
  onDetected?: () => void; // fires immediately when QR pixels are found, before onScan
  torchOn?: boolean;
  onTorchSupportChange?: (supported: boolean) => void;
}

type PermState = 'pending' | 'granted' | 'denied' | 'unavailable';

export default function WebQRScanner({ active, onScan, onDetected, torchOn, onTorchSupportChange }: Props) {
  const { colors } = useTheme();
  const containerRef = useRef<any>(null);
  const videoRef = useRef<any>(null);   // HTMLVideoElement
  const streamRef = useRef<any>(null);  // MediaStream
  const rafRef = useRef<number | null>(null);
  const lastScannedRef = useRef<string>('');
  const lastScannedAtRef = useRef<number>(0);
  const wantCameraRef = useRef(false);  // guards against post-stopStream getUserMedia resolution
  const [permState, setPermState] = useState<PermState>('pending');
  const [scanning, setScanning] = useState(false);
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    if (!active) {
      stopStream();
      return;
    }
    startCamera();
    return () => hardStop(); // release tracks on unmount
  }, [active]);

  // Apply or remove torch when prop changes
  useEffect(() => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track) return;
    try {
      (track.applyConstraints as any)({ advanced: [{ torch: !!torchOn }] }).catch(() => {});
    } catch (_) {}
  }, [torchOn]);

  // Hard-stop when PWA goes to background (prevents persistent iOS recording indicator)
  useEffect(() => {
    const g = globalThis as any;
    if (!g.document) return;
    const onVisibility = () => { if (g.document.visibilityState === 'hidden') hardStop(); };
    g.document.addEventListener('visibilitychange', onVisibility);
    return () => g.document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Soft-pause: cancel RAF loop and detach video but keep the MediaStream alive
  // so startCamera() can reuse it without re-prompting for camera permission.
  const stopStream = () => {
    wantCameraRef.current = false;
    if (rafRef.current) {
      (globalThis as any).cancelAnimationFrame?.(rafRef.current);
      rafRef.current = null;
    }
    setScanning(false);
    const container = containerRef.current as HTMLElement | null;
    if (container && videoRef.current) {
      try { container.removeChild(videoRef.current); } catch (_) {}
    }
    videoRef.current = null;
    // streamRef kept alive intentionally — reused on next startCamera().
  };

  // Hard-stop: also releases camera tracks (app background or component unmount).
  const hardStop = () => {
    stopStream();
    streamRef.current?.getTracks().forEach((t: any) => t.stop());
    streamRef.current = null;
  };

  const startCamera = async () => {
    const g = globalThis as any;
    if (!g.navigator?.mediaDevices?.getUserMedia) {
      setPermState('unavailable');
      return;
    }
    wantCameraRef.current = true;

    // Reuse an existing live stream to avoid re-prompting for permission.
    const existingTrack = streamRef.current?.getVideoTracks?.()[0];
    const streamToUse: any = existingTrack && existingTrack.readyState === 'live'
      ? streamRef.current
      : null;

    try {
      const stream = streamToUse ?? await g.navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
      });
      // If stopStream() was called while getUserMedia was pending, discard the new stream
      if (!wantCameraRef.current) {
        if (!streamToUse) stream.getTracks().forEach((t: any) => t.stop());
        return;
      }
      streamRef.current = stream;
      setPermState('granted');

      if (!streamToUse) {
        // Detect torch support — only needed once on first acquisition
        try {
          const track = stream.getVideoTracks()[0];
          const caps = track?.getCapabilities?.();
          onTorchSupportChange?.(!!(caps?.torch));
        } catch (_) { onTorchSupportChange?.(false); }
      }

      // Suppress iOS Safari native video controls overlay
      if (!g.document.getElementById('connect-video-no-controls')) {
        const style = g.document.createElement('style');
        style.id = 'connect-video-no-controls';
        style.textContent = 'video::-webkit-media-controls,video::-webkit-media-controls-panel,video::-webkit-media-controls-overlay-play-button,video::-webkit-media-controls-start-playback-button{display:none!important;opacity:0!important;}';
        g.document.head.appendChild(style);
      }

      // Build <video> element and inject into the container div
      const video = g.document.createElement('video');
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.setAttribute('muted', 'true');
      video.setAttribute('autoplay', 'true');
      video.setAttribute('disablepictureinpicture', 'true');
      video.style.cssText =
        'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;border-radius:0;';
      video.srcObject = stream;
      videoRef.current = video;

      // Append video to the React Native View's underlying DOM node
      const container = containerRef.current as HTMLElement | null;
      if (container) container.appendChild(video);

      video.onloadedmetadata = () => {
        video.play().catch(() => {});
        setScanning(true);
        scheduleFrame(video);
      };
    } catch (err: any) {
      setPermState(err?.name === 'NotAllowedError' ? 'denied' : 'unavailable');
    }
  };

  const scheduleFrame = (video: any) => {
    const g = globalThis as any;
    const SCAN_W = 640;
    const SCAN_H = 360;
    const canvas = g.document.createElement('canvas');
    canvas.width = SCAN_W;
    canvas.height = SCAN_H;
    const ctx = canvas.getContext('2d');

    // Throttle jsQR to ~15fps — the RAF fires at 60fps for smooth video preview
    // but image processing only runs when enough time has passed. This cuts CPU
    // (and therefore battery/heat) by ~75% compared to processing every frame.
    const SCAN_INTERVAL_MS = 66; // ~15fps
    let lastScanAt = 0;

    const tick = () => {
      rafRef.current = g.requestAnimationFrame(tick);

      const now = g.performance?.now() ?? Date.now();
      if (now - lastScanAt < SCAN_INTERVAL_MS) return; // skip — not yet time to scan
      lastScanAt = now;

      // readyState >= 2 means we have at least the current frame
      // iOS Safari often stays at 3 (HAVE_FUTURE_DATA) and never reaches 4
      if (video.readyState < 2) return;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;
      ctx.drawImage(video, 0, 0, vw, vh, 0, 0, SCAN_W, SCAN_H);
      let imageData: ImageData;
      try { imageData = ctx.getImageData(0, 0, SCAN_W, SCAN_H); } catch { return; }

      const code = jsQR(imageData.data, SCAN_W, SCAN_H, {
        inversionAttempts: 'attemptBoth',
      });

      if (code?.data) {
        // Debounce: ignore same QR within 2 seconds
        if (code.data === lastScannedRef.current && now - lastScannedAtRef.current < 2000) return;
        lastScannedRef.current = code.data;
        lastScannedAtRef.current = now; // reuse timestamp from throttle check

        // Flash the frame green as immediate visual feedback
        setDetected(true);
        g.setTimeout(() => setDetected(false), 600);
        onDetected?.();

        // Vibrate briefly as haptic substitute
        g.navigator?.vibrate?.(50);
        onScan(code.data);
      }
    };

    rafRef.current = g.requestAnimationFrame(tick);
  };

  // ── Permission denied ────────────────────────────────────────────────────────
  if (permState === 'denied') {
    return (
      <View style={[s.fallback, { backgroundColor: '#000' }]}>
        <Ionicons name="camera-outline" size={44} color="#888" />
        <Text style={s.fallbackTitle}>Camera access denied</Text>
        <Text style={s.fallbackBody}>
          Reload the page — a prompt will appear to allow camera access.
        </Text>
        <Pressable
          style={s.reloadBtn}
          onPress={() => (globalThis as any).window?.location?.reload()}
        >
          <Text style={s.reloadBtnText}>Reload</Text>
        </Pressable>
      </View>
    );
  }

  if (permState === 'unavailable') {
    return (
      <View style={[s.fallback, { backgroundColor: '#000' }]}>
        <Ionicons name="camera-outline" size={44} color="#888" />
        <Text style={s.fallbackTitle}>Camera not available</Text>
        <Text style={s.fallbackBody}>
          Your browser or device doesn't support camera access.
        </Text>
      </View>
    );
  }

  return (
    // containerRef gives us the underlying <div> so we can appendChild(<video>)
    <View ref={containerRef} style={s.camera}>
      {/* Scan frame overlay — sits above the video via z-index */}
      <View style={s.overlay} pointerEvents="none">
        <View style={[s.qrFrame, { borderColor: detected ? '#00FF88' : colors.accent + '50', borderWidth: detected ? 2 : 1 }]}>
          <View style={[s.corner, s.cornerTL, { borderColor: detected ? '#00FF88' : colors.accent }]} />
          <View style={[s.corner, s.cornerTR, { borderColor: detected ? '#00FF88' : colors.accent }]} />
          <View style={[s.corner, s.cornerBL, { borderColor: detected ? '#00FF88' : colors.accent }]} />
          <View style={[s.corner, s.cornerBR, { borderColor: detected ? '#00FF88' : colors.accent }]} />
          {detected && (
            <View style={s.detectedFlash} />
          )}
        </View>
        <Text style={s.hint}>
          {permState === 'pending' ? 'Starting camera…' : detected ? '✓ QR detected — processing…' : 'Point at someone\'s Connect QR'}
        </Text>
      </View>
    </View>
  );
}

const CORNER = 20;
const BORDER = 3;

const s = StyleSheet.create({
  camera: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden' as any,
    position: 'relative' as any,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  qrFrame: {
    width: 220,
    height: 220,
    borderWidth: 1,
    borderRadius: 4,
    overflow: 'hidden' as any,
  },
  detectedFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,255,136,0.15)',
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: '#00B4B4',
    borderWidth: BORDER,
  },
  cornerTL: { top: -BORDER, left: -BORDER, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: -BORDER, right: -BORDER, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: -BORDER, left: -BORDER, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: -BORDER, right: -BORDER, borderLeftWidth: 0, borderTopWidth: 0 },
  hint: {
    color: '#FFF',
    fontSize: FontSize.sm,
    marginTop: Spacing.md,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  fallbackTitle: {
    color: '#FFF',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  fallbackBody: {
    color: '#888',
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  reloadBtn: {
    marginTop: 20,
    backgroundColor: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  reloadBtnText: {
    color: '#000',
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
});
