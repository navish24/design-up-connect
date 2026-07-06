import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, FontWeight, Spacing } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

interface Props {
  active: boolean;
  onCapture: (base64Jpeg: string) => void;
  autoCapture?: boolean;
  torchOn?: boolean;
  onTorchSupportChange?: (supported: boolean) => void;
}

export interface WebCardScannerHandle {
  capture: () => void;
}

type PermState = 'pending' | 'granted' | 'denied' | 'unavailable';

const WebCardScanner = forwardRef<WebCardScannerHandle, Props>(({ active, onCapture, autoCapture = false, torchOn, onTorchSupportChange }, ref) => {
  const { colors } = useTheme();
  const containerRef = useRef<any>(null);
  const videoRef = useRef<any>(null);
  const streamRef = useRef<any>(null);
  const wantCameraRef = useRef(false);
  const pauseUntilRef = useRef(0);
  const stabilityTimerRef = useRef<any>(null);
  const lastSampleRef = useRef<Uint8ClampedArray | null>(null);
  const stableStartRef = useRef<number | null>(null);
  const [permState, setPermState] = useState<PermState>('pending');
  const [stabilityPct, setStabilityPct] = useState(0);

  useImperativeHandle(ref, () => ({ capture }));

  useEffect(() => {
    if (!active) { stopStream(); return; }
    startCamera();
    return () => stopStream();
  }, [active]);

  // When torch toggles: pause stability loop for 2s while camera exposure settles
  useEffect(() => {
    lastSampleRef.current = null;
    stableStartRef.current = null;
    setStabilityPct(0);
    pauseUntilRef.current = Date.now() + 2000;
  }, [torchOn]);

  // Apply or remove torch when the prop changes
  useEffect(() => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track) return;
    try {
      (track.applyConstraints as any)({ advanced: [{ torch: !!torchOn }] }).catch(() => {});
    } catch (_) {}
  }, [torchOn]);

  // Stop stream when PWA goes to background
  useEffect(() => {
    const g = globalThis as any;
    if (!g.document) return;
    const onVisibility = () => { if (g.document.visibilityState === 'hidden') stopStream(); };
    g.document.addEventListener('visibilitychange', onVisibility);
    return () => g.document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const stopStream = () => {
    wantCameraRef.current = false;
    const g = globalThis as any;
    if (stabilityTimerRef.current) { g.clearTimeout?.(stabilityTimerRef.current); stabilityTimerRef.current = null; }
    lastSampleRef.current = null;
    stableStartRef.current = null;
    setStabilityPct(0);
    streamRef.current?.getTracks().forEach((t: any) => t.stop());
    streamRef.current = null;
    const container = containerRef.current as HTMLElement | null;
    if (container && videoRef.current) {
      try { container.removeChild(videoRef.current); } catch (_) {}
    }
    videoRef.current = null;
  };

  const checkStabilityLoop = () => {
    const g = globalThis as any;
    if (!wantCameraRef.current || !autoCapture) return;
    // Wait for camera exposure to settle after torch change
    if (Date.now() < pauseUntilRef.current) {
      stabilityTimerRef.current = g.setTimeout(checkStabilityLoop, 400);
      return;
    }
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      stabilityTimerRef.current = g.setTimeout(checkStabilityLoop, 400);
      return;
    }
    const W = 40, H = 25;
    const canvas = g.document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) { stabilityTimerRef.current = g.setTimeout(checkStabilityLoop, 400); return; }
    ctx.drawImage(video, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H).data;

    // Require minimum brightness (not a dark/blank frame)
    let totalBrightness = 0;
    for (let i = 0; i < data.length; i += 4) totalBrightness += (data[i] + data[i+1] + data[i+2]) / 3;
    if (totalBrightness / (data.length / 4) < 20) {
      lastSampleRef.current = data; stableStartRef.current = null; setStabilityPct(0);
      stabilityTimerRef.current = g.setTimeout(checkStabilityLoop, 400);
      return;
    }

    // Torch creates glare/noise so allow more pixel variation before calling it "moving"
    const MAD_THRESHOLD = torchOn ? 26 : 18;

    if (lastSampleRef.current && lastSampleRef.current.length === data.length) {
      let diff = 0;
      for (let i = 0; i < data.length; i += 4) {
        diff += Math.abs(data[i] - lastSampleRef.current[i])
               + Math.abs(data[i+1] - lastSampleRef.current[i+1])
               + Math.abs(data[i+2] - lastSampleRef.current[i+2]);
      }
      const mad = diff / (data.length / 4) / 3;

      if (mad < MAD_THRESHOLD) {
        if (!stableStartRef.current) stableStartRef.current = Date.now();
        const elapsed = Date.now() - stableStartRef.current;
        const pct = Math.min(100, Math.round((elapsed / 1500) * 100));
        setStabilityPct(pct);
        if (elapsed >= 1500) {
          stableStartRef.current = null; lastSampleRef.current = null; setStabilityPct(0);
          capture();
          return; // capture navigates away, stop loop
        }
      } else {
        stableStartRef.current = null; setStabilityPct(0);
      }
    }

    lastSampleRef.current = data;
    stabilityTimerRef.current = g.setTimeout(checkStabilityLoop, 350);
  };

  const startCamera = async () => {
    const g = globalThis as any;
    if (!g.navigator?.mediaDevices?.getUserMedia) { setPermState('unavailable'); return; }
    wantCameraRef.current = true;
    try {
      const stream = await g.navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      if (!wantCameraRef.current) {
        stream.getTracks().forEach((t: any) => t.stop());
        return;
      }
      streamRef.current = stream;
      setPermState('granted');

      // Detect torch support — torch is only available on Android Chrome, not iOS Safari
      try {
        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.();
        onTorchSupportChange?.(!!(caps?.torch));
      } catch (_) { onTorchSupportChange?.(false); }

      // Suppress iOS Safari native video controls overlay
      if (!g.document.getElementById('connect-video-no-controls')) {
        const style = g.document.createElement('style');
        style.id = 'connect-video-no-controls';
        style.textContent = 'video::-webkit-media-controls,video::-webkit-media-controls-panel,video::-webkit-media-controls-overlay-play-button,video::-webkit-media-controls-start-playback-button{display:none!important;opacity:0!important;}';
        g.document.head.appendChild(style);
      }

      const video = g.document.createElement('video');
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.setAttribute('muted', 'true');
      video.setAttribute('autoplay', 'true');
      video.setAttribute('disablepictureinpicture', 'true');
      video.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;';
      video.srcObject = stream;
      videoRef.current = video;

      const container = containerRef.current as HTMLElement | null;
      if (container) container.appendChild(video);
      video.play().catch(() => {});

      // Start stability detection after a warm-up delay
      if (autoCapture) {
        stabilityTimerRef.current = (globalThis as any).setTimeout(() => {
          if (wantCameraRef.current) checkStabilityLoop();
        }, 900);
      }
    } catch (err: any) {
      setPermState(err?.name === 'NotAllowedError' ? 'denied' : 'unavailable');
    }
  };

  const capture = () => {
    const g = globalThis as any;
    const video = videoRef.current;
    const container = containerRef.current as HTMLElement | null;
    if (!video) return;
    try {
      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;

      // Step 1: Crop to the bracket frame area (with generous padding for edge detection)
      const cw = container?.clientWidth ?? 390;
      const ch = container?.clientHeight ?? 600;
      const videoAspect = vw / vh;
      const containerAspect = cw / ch;

      let displayW: number, displayH: number, overflowX: number, overflowY: number;
      if (videoAspect > containerAspect) {
        displayH = ch; displayW = ch * videoAspect;
        overflowX = (displayW - cw) / 2; overflowY = 0;
      } else {
        displayW = cw; displayH = cw / videoAspect;
        overflowX = 0; overflowY = (displayH - ch) / 2;
      }

      const BRACKET_W = 300, BRACKET_H = 188, PAD = 40;
      const bx = (cw - BRACKET_W) / 2 - PAD;
      const by = (ch - BRACKET_H) / 2 - PAD;
      const bw = BRACKET_W + PAD * 2;
      const bh = BRACKET_H + PAD * 2;

      const sx = Math.max(0, (bx + overflowX) * (vw / displayW));
      const sy = Math.max(0, (by + overflowY) * (vh / displayH));
      const sw = Math.min(vw - sx, bw * (vw / displayW));
      const sh = Math.min(vh - sy, bh * (vh / displayH));

      const TARGET_W = 1200;
      const outScale = Math.min(TARGET_W / sw, 1);
      const canvas = g.document.createElement('canvas');
      canvas.width = Math.round(sw * outScale);
      canvas.height = Math.round(sh * outScale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      // Step 2: Auto-crop to card edges by detecting background color.
      // Sample each corner independently — backgrounds are often multi-colored
      // (fabric, wood, etc.) so a single averaged bg color fails. A pixel is
      // "background" if it closely matches ANY corner sample.
      const W = canvas.width, H = canvas.height;
      const pixels = ctx.getImageData(0, 0, W, H).data;

      const samplePx = (x: number, y: number) => {
        const i = (y * W + x) * 4;
        return [pixels[i], pixels[i + 1], pixels[i + 2]];
      };
      const avgPixels = (pts: number[][]) => pts[0].map((_, i) => pts.reduce((s, c) => s + c[i], 0) / pts.length);

      // Larger corner sample (12×12) for a stable per-corner color estimate
      const CS = 12;
      const cornerSamples = (ox: number, oy: number, dx: number, dy: number) =>
        Array.from({ length: CS }, (_, r) =>
          Array.from({ length: CS }, (_, c) => samplePx(ox + dx * c, oy + dy * r))
        ).flat();

      const corners = [
        avgPixels(cornerSamples(0, 0, 1, 1)),          // top-left
        avgPixels(cornerSamples(W - 1, 0, -1, 1)),     // top-right
        avgPixels(cornerSamples(0, H - 1, 1, -1)),     // bottom-left
        avgPixels(cornerSamples(W - 1, H - 1, -1, -1)),// bottom-right
      ];

      // A pixel matches background if it's within THRESH of any corner color
      const THRESH = 42;
      const isBg = (x: number, y: number) => {
        const [r, gv, b] = samplePx(x, y);
        return corners.some(([cr, cg, cb]) =>
          (Math.abs(r - cr) + Math.abs(gv - cg) + Math.abs(b - cb)) / 3 < THRESH
        );
      };
      // Skip every other pixel for performance on large canvases
      const rowHasCard = (y: number) => { for (let x = 0; x < W; x += 2) if (!isBg(x, y)) return true; return false; };
      const colHasCard = (x: number) => { for (let y = 0; y < H; y += 2) if (!isBg(x, y)) return true; return false; };

      let t = 0, bot = H - 1, l = 0, r = W - 1;
      while (t < H && !rowHasCard(t)) t++;
      while (bot > t && !rowHasCard(bot)) bot--;
      while (l < W && !colHasCard(l)) l++;
      while (r > l && !colHasCard(r)) r--;

      // Only apply detected crop if it found a plausible card region (>40% of bracket)
      const detW = r - l, detH = bot - t;
      const applyDetected = detW > W * 0.4 && detH > H * 0.4;
      const EDGE_PAD = 6;
      const cx = applyDetected ? Math.max(0, l - EDGE_PAD) : 0;
      const cy = applyDetected ? Math.max(0, t - EDGE_PAD) : 0;
      const cw2 = applyDetected ? Math.min(W - cx, detW + EDGE_PAD * 2) : W;
      const ch2 = applyDetected ? Math.min(H - cy, detH + EDGE_PAD * 2) : H;

      const finalCanvas = g.document.createElement('canvas');
      finalCanvas.width = cw2; finalCanvas.height = ch2;
      const fCtx = finalCanvas.getContext('2d');
      if (!fCtx) return;
      fCtx.drawImage(canvas, cx, cy, cw2, ch2, 0, 0, cw2, ch2);

      finalCanvas.toBlob((blob: any) => {
        if (!blob) return;
        const reader = new g.FileReader();
        reader.onload = (e: any) => {
          const b64 = (e.target?.result as string ?? '').split(',')[1];
          if (b64) onCapture(b64);
        };
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.92);
    } catch { /* ignore */ }
  };

  if (permState === 'denied') {
    return (
      <View style={[s.fallback, { backgroundColor: '#000' }]}>
        <Ionicons name="camera-off-outline" size={44} color="#888" />
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
        <Ionicons name="camera-off-outline" size={44} color="#888" />
        <Text style={s.fallbackTitle}>Camera not available</Text>
        <Text style={s.fallbackBody}>Your browser doesn't support camera access.</Text>
      </View>
    );
  }

  return (
    <View ref={containerRef} style={s.camera}>
      <View style={s.overlay} pointerEvents="none">
        {/* Landscape corner-bracket frame — no border line, brackets only */}
        <View style={s.bracketFrame}>
          <View style={[s.corner, s.cornerTL, { borderColor: colors.accent }]} />
          <View style={[s.corner, s.cornerTR, { borderColor: colors.accent }]} />
          <View style={[s.corner, s.cornerBL, { borderColor: colors.accent }]} />
          <View style={[s.corner, s.cornerBR, { borderColor: colors.accent }]} />
          {stabilityPct > 0 && (
            <View style={[s.progressBar, { backgroundColor: colors.accent, width: `${stabilityPct}%` as any }]} />
          )}
        </View>
        {/* Hint pill below frame */}
        <View style={s.hintPill}>
          <Text style={s.hint}>
            {permState === 'pending'
              ? 'Starting camera…'
              : stabilityPct > 0
                ? `Hold still… ${stabilityPct}%`
                : 'Hold the card in the frame — captures automatically'}
          </Text>
        </View>
      </View>
    </View>
  );
});

export default WebCardScanner;

const CORNER = 28;
const BORDER = 3;

const s = StyleSheet.create({
  camera: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden' as any,
    position: 'relative' as any,
  },
  manualBtn: {
    position: 'absolute' as any,
    bottom: 28,
    alignSelf: 'center',
    left: '50%' as any,
    marginLeft: -34,
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualBtnInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFF',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  // Landscape visiting-card frame (brackets only, no border line)
  bracketFrame: {
    width: 300,
    height: 188,
    position: 'relative' as any,
  },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderWidth: BORDER },
  cornerTL: { top: -BORDER, left: -BORDER, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: -BORDER, right: -BORDER, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: -BORDER, left: -BORDER, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: -BORDER, right: -BORDER, borderLeftWidth: 0, borderTopWidth: 0 },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3,
    borderRadius: 2,
  },
  hintPill: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
    borderRadius: 20,
    maxWidth: '80%' as any,
  },
  hint: {
    color: '#FFF',
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  fallbackTitle: { color: '#FFF', fontSize: FontSize.lg, fontWeight: FontWeight.semibold, textAlign: 'center' },
  fallbackBody: { color: '#888', fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  reloadBtn: {
    marginTop: 20, backgroundColor: '#FFF',
    paddingVertical: 12, paddingHorizontal: 32, borderRadius: 8,
  },
  reloadBtnText: { color: '#000', fontSize: FontSize.md, fontWeight: FontWeight.semibold },
});
