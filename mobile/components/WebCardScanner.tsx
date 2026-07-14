import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, FontWeight, Spacing } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import jsQR from 'jsqr';

interface Props {
  active: boolean;
  onCapture: (base64Jpeg: string) => void;
  autoCapture?: boolean;
  torchOn?: boolean;
  onTorchSupportChange?: (supported: boolean) => void;
  errorHint?: string | null;
  // Fires when a QR code is found in the live feed — called immediately without
  // waiting for card stability. Return true if the QR was handled (pauses card
  // capture); return false to let the card OCR flow continue normally.
  onQRDetected?: (data: string) => boolean;
}

export interface WebCardScannerHandle {
  capture: () => void;
}

type PermState = 'pending' | 'granted' | 'denied' | 'unavailable';

const WebCardScanner = forwardRef<WebCardScannerHandle, Props>(({ active, onCapture, autoCapture = false, torchOn, onTorchSupportChange, errorHint, onQRDetected }, ref) => {
  const { colors } = useTheme();
  const containerRef = useRef<any>(null);
  const videoRef = useRef<any>(null);
  const streamRef = useRef<any>(null);
  const wantCameraRef = useRef(false);
  const pauseUntilRef = useRef(0);
  const stabilityTimerRef = useRef<any>(null);
  const lastSampleRef = useRef<Uint8ClampedArray | null>(null);
  const stableStartRef = useRef<number | null>(null);
  const edgeWarnShownRef = useRef(false);   // true once per stable session after warning shown
  const edgePauseUntilRef = useRef(0);     // timestamp until which stability countdown is paused
  const lastQRScanRef = useRef(0);
  const lastQRDataRef = useRef<string | null>(null);
  const lastQRFireRef = useRef(0);
  const onQRDetectedRef = useRef(onQRDetected);
  onQRDetectedRef.current = onQRDetected;
  const [permState, setPermState] = useState<PermState>('pending');
  const [stabilityPct, setStabilityPct] = useState(0);
  const [showRotateHint, setShowRotateHint] = useState(false);
  const rotateHintTimerRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({ capture }));

  useEffect(() => {
    if (!active) { stopStream(); return; }
    startCamera();
  }, [active]);

  // Separate unmount cleanup — must not run on every active toggle or the stream
  // gets killed and the next open re-prompts for camera permission.
  useEffect(() => { return () => hardStop(); }, []);

  // Show a rotation hint after 5s of no card detected — helps users who hold
  // their card landscape (wide) in a portrait viewport and miss content at the edges.
  useEffect(() => {
    clearTimeout(rotateHintTimerRef.current);
    if (permState === 'granted' && stabilityPct === 0 && active && !errorHint) {
      rotateHintTimerRef.current = setTimeout(() => setShowRotateHint(true), 5000);
    } else {
      if (stabilityPct > 0) setShowRotateHint(false);
    }
    return () => clearTimeout(rotateHintTimerRef.current);
  }, [permState, stabilityPct, active, errorHint]);

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

  // Hard-stop when PWA goes to background (camera off for battery/privacy)
  useEffect(() => {
    const g = globalThis as any;
    if (!g.document) return;
    const onVisibility = () => { if (g.document.visibilityState === 'hidden') hardStop(); };
    g.document.addEventListener('visibilitychange', onVisibility);
    return () => g.document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Soft-pause: cancel timers and detach video from DOM but keep the MediaStream
  // tracks alive so startCamera() can reuse them without a getUserMedia prompt.
  const stopStream = () => {
    wantCameraRef.current = false;
    const g = globalThis as any;
    if (stabilityTimerRef.current) { g.clearTimeout?.(stabilityTimerRef.current); stabilityTimerRef.current = null; }
    lastSampleRef.current = null;
    stableStartRef.current = null;
    setStabilityPct(0);
    const container = containerRef.current as HTMLElement | null;
    if (container && videoRef.current) {
      try { container.removeChild(videoRef.current); } catch (_) {}
    }
    videoRef.current = null;
    // Stream (streamRef) is intentionally kept alive to avoid re-prompting.
  };

  // Hard-stop: also releases camera tracks (used when app backgrounds or unmounts).
  const hardStop = () => {
    stopStream();
    streamRef.current?.getTracks().forEach((t: any) => t.stop());
    streamRef.current = null;
  };

  // Detects whether the card content extends beyond the left or right edge of the
  // bracket zone — i.e. the card is wider than the bracket and will be cropped.
  // Runs a tiny 80×50 canvas of the bracket+padding area and checks if card pixels
  // are found inside the padding columns (which should only contain background).
  const isCardEdgeCropped = (video: any): boolean => {
    const g = globalThis as any;
    const container = containerRef.current as HTMLElement;
    if (!container || !video || video.readyState < 2) return false;
    const cw = container.clientWidth, ch = container.clientHeight;
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh || !cw || !ch) return false;
    const BRAK_W = 300, BRAK_H = 188, PAD = 40;
    const videoAspect = vw / vh, containerAspect = cw / ch;
    let displayW: number, displayH: number, overflowX: number, overflowY: number;
    if (videoAspect > containerAspect) {
      displayH = ch; displayW = ch * videoAspect; overflowX = (displayW - cw) / 2; overflowY = 0;
    } else {
      displayW = cw; displayH = cw / videoAspect; overflowX = 0; overflowY = (displayH - ch) / 2;
    }
    const sx = Math.max(0, ((cw - BRAK_W) / 2 - PAD + overflowX) * (vw / displayW));
    const sy = Math.max(0, ((ch - BRAK_H) / 2 - PAD + overflowY) * (vh / displayH));
    const sw = Math.min(vw - sx, (BRAK_W + PAD * 2) * (vw / displayW));
    const sh = Math.min(vh - sy, (BRAK_H + PAD * 2) * (vh / displayH));
    const CW = 80, CH = 50;
    const canvas = g.document.createElement('canvas');
    canvas.width = CW; canvas.height = CH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    try { ctx.drawImage(video, sx, sy, sw, sh, 0, 0, CW, CH); } catch { return false; }
    const pixels = ctx.getImageData(0, 0, CW, CH).data;
    const px = (x: number, y: number) => { const i = (y * CW + x) * 4; return [pixels[i], pixels[i+1], pixels[i+2]]; };
    // Background from each corner (4×4 box)
    const avgBox = (ox: number, oy: number, dx: number, dy: number) => {
      const pts = Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => px(ox + dx*c, oy + dy*r))).flat();
      return [0,1,2].map(ci => pts.reduce((s,p) => s + p[ci], 0) / pts.length);
    };
    const bg = [avgBox(0,0,1,1), avgBox(CW-1,0,-1,1), avgBox(0,CH-1,1,-1), avgBox(CW-1,CH-1,-1,-1)];
    const isBg = (col: number[]) => bg.some(([cr,cg,cb]) => (Math.abs(col[0]-cr)+Math.abs(col[1]-cg)+Math.abs(col[2]-cb))/3 < 42);
    const colHasCard = (x: number) => { for (let y = 3; y < CH-3; y += 3) if (!isBg(px(x,y))) return true; return false; };
    // PAD occupies PAD/(BRAK_W+2*PAD) fraction of canvas width
    const padCols = Math.round(CW * PAD / (BRAK_W + PAD * 2)); // ≈ 8 columns
    let leftCard = 0, rightCard = 0;
    for (let x = 0; x < padCols; x++) { if (colHasCard(x)) leftCard++; if (colHasCard(CW-1-x)) rightCard++; }
    return leftCard >= 3 || rightCard >= 3; // card content in padding zone = cropped
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

    // QR detection — runs every 500ms independently of stability countdown.
    // This makes QR codes on visiting cards (or held up directly) work without
    // needing the user to hold still for the full 1.5s card-capture countdown.
    const now = Date.now();
    if (onQRDetectedRef.current && now - lastQRScanRef.current >= 500) {
      lastQRScanRef.current = now;
      try {
        const QR_W = 320, QR_H = 240;
        const qrCanvas = g.document.createElement('canvas');
        qrCanvas.width = QR_W; qrCanvas.height = QR_H;
        const qrCtx = qrCanvas.getContext('2d');
        if (qrCtx) {
          qrCtx.drawImage(video, 0, 0, QR_W, QR_H);
          const imgData = qrCtx.getImageData(0, 0, QR_W, QR_H);
          const code = jsQR(imgData.data, QR_W, QR_H, { inversionAttempts: 'attemptBoth' });
          if (code?.data) {
            const isSameQR = code.data === lastQRDataRef.current && now - lastQRFireRef.current < 2000;
            if (!isSameQR) {
              lastQRDataRef.current = code.data;
              lastQRFireRef.current = now;
              const handled = onQRDetectedRef.current(code.data);
              // Only pause card capture when the QR was actually handled (Designup QR).
              // Non-app QRs (website links, social QRs on the card) should be ignored
              // so OCR continues and the card review page still opens.
              if (handled) pauseUntilRef.current = now + 5000;
            }
          }
        }
      } catch {}
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
        if (!stableStartRef.current) {
          // First stable frame — check if card is wider than bracket before counting down.
          if (!edgeWarnShownRef.current && Date.now() >= edgePauseUntilRef.current) {
            if (isCardEdgeCropped(video)) {
              edgeWarnShownRef.current = true;
              setShowRotateHint(true);
              edgePauseUntilRef.current = Date.now() + 3000; // 3s pause before countdown starts
            }
          }
          if (Date.now() >= edgePauseUntilRef.current) {
            stableStartRef.current = Date.now();
          }
        }
        if (stableStartRef.current) {
          const elapsed = Date.now() - stableStartRef.current;
          const pct = Math.min(100, Math.round((elapsed / 1500) * 100));
          setStabilityPct(pct);
          if (elapsed >= 1500) {
            stableStartRef.current = null; lastSampleRef.current = null; setStabilityPct(100);
            capture();
            // Block the next auto-capture for 5 s — covers cloud-OCR latency (~2 s) plus
            // camera restart time (~1 s). pauseUntilRef survives stopStream() so this guard
            // stays effective even if active=false temporarily while OCR runs.
            pauseUntilRef.current = Date.now() + 5000;
            stabilityTimerRef.current = g.setTimeout(checkStabilityLoop, 5100);
            return;
          }
        }
      } else {
        stableStartRef.current = null; setStabilityPct(0);
        edgeWarnShownRef.current = false; // card moved — allow re-detection
        setShowRotateHint(false);
      }
    }

    lastSampleRef.current = data;
    stabilityTimerRef.current = g.setTimeout(checkStabilityLoop, 350);
  };

  const startCamera = async () => {
    const g = globalThis as any;
    if (!g.navigator?.mediaDevices?.getUserMedia) { setPermState('unavailable'); return; }
    wantCameraRef.current = true;

    // Reuse an existing live stream so we don't re-prompt for camera permission.
    const existingTrack = streamRef.current?.getVideoTracks?.()[0];
    const streamToUse: any = existingTrack && existingTrack.readyState === 'live'
      ? streamRef.current
      : null;

    try {
      const stream = streamToUse ?? await g.navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      if (!wantCameraRef.current) {
        // Only stop tracks if we just acquired a new stream
        if (!streamToUse) stream.getTracks().forEach((t: any) => t.stop());
        return;
      }
      streamRef.current = stream;
      setPermState('granted');

      if (!streamToUse) {
        // Detect torch support — only needed once when stream is first acquired
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
        <Text style={s.fallbackBody}>Your browser doesn't support camera access.</Text>
      </View>
    );
  }

  return (
    <View ref={containerRef} style={s.camera}>
      <View style={s.overlay} pointerEvents="none">
        {/* Top dark band */}
        <View style={s.dimBand} />

        {/* Middle row: dark sides flanking the clear card zone */}
        <View style={s.dimRow}>
          <View style={s.dimSide} />
          {/* Clear bracket zone — live camera shows through here */}
          <View style={s.bracketFrame}>
            <View style={[s.corner, s.cornerTL, { borderColor: colors.accent }]} />
            <View style={[s.corner, s.cornerTR, { borderColor: colors.accent }]} />
            <View style={[s.corner, s.cornerBL, { borderColor: colors.accent }]} />
            <View style={[s.corner, s.cornerBR, { borderColor: colors.accent }]} />
            {stabilityPct > 0 && (
              <View style={[s.progressBar, { backgroundColor: colors.accent, width: `${stabilityPct}%` as any }]} />
            )}
          </View>
          <View style={s.dimSide} />
        </View>

        {/* Bottom dark band with hint pill */}
        <View style={s.dimBottomBand}>
          <View style={[s.hintPill, errorHint ? s.hintPillError : null]}>
            {errorHint ? (
              <View style={s.hintErrorRow}>
                <Ionicons name="warning-outline" size={14} color="#FFF" />
                <Text style={s.hint}>{errorHint}</Text>
              </View>
            ) : showRotateHint ? (
              <View style={s.hintErrorRow}>
                <Ionicons name="phone-portrait-outline" size={14} color="#FFF" />
                <Text style={s.hint}>
                  {stabilityPct >= 100
                    ? 'Captured! Analysing card…'
                    : stabilityPct > 0
                      ? `Card edges cut off — rotate to portrait for full capture (${stabilityPct}%)`
                      : 'No card? Try rotating it to portrait (vertical)'}
                </Text>
              </View>
            ) : (
              <Text style={s.hint}>
                {permState === 'pending'
                  ? 'Starting camera…'
                  : stabilityPct >= 100
                    ? 'Captured! Analysing card…'
                    : stabilityPct > 0
                      ? `Hold still… ${stabilityPct}%`
                      : 'Hold card flat in the frame — auto-captures'}
              </Text>
            )}
          </View>
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
    flexDirection: 'column' as any,
  },
  // Dark bands above/below and on the sides of the card zone
  dimBand: {
    flex: 1,
    width: '100%' as any,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  dimRow: {
    flexDirection: 'row' as any,
    height: 188,
  },
  dimSide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  dimBottomBand: {
    flex: 1,
    width: '100%' as any,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center' as any,
    paddingTop: 18,
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
  hintPillError: {
    backgroundColor: 'rgba(194,80,30,0.85)',
  },
  hintErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
