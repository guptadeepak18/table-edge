import React, { useEffect, useRef, useMemo } from 'react';
import type { SegmentStat } from '../../stores/tracker.store';

// European wheel physical pocket sequence (starting at 0, going clockwise)
const EUR_WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27,
  13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1,
  20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const USA_WHEEL = [
  0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1,
  '00', 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2,
];

const RED_SET = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const SEGMENT_COLORS = [
  '#06b6d4', // cyan — Seg 1
  '#a855f7', // purple — Seg 2
  '#3b82f6', // blue — Seg 3
  '#eab308', // yellow — Seg 4
  '#ef4444', // red — Seg 5
  '#22c55e', // green — Seg 6
];

// Segment pocket ranges (indices into wheel sequence)
const EUR_SEG_RANGES = [
  [0, 5], [6, 11], [12, 17], [18, 23], [24, 29], [30, 36],
];

const USA_SEG_RANGES = [
  [0, 5], [6, 11], [12, 18], [19, 24], [25, 30], [31, 37],
];

interface Props {
  lastNumber: number | '00' | null;
  topNumbers: Array<number | '00'>;
  segmentStats: SegmentStat[];
  rules: 'EUR' | 'USA';
  size?: number;
  predictedSector?: number | null;
}

export const RouletteWheelSVG: React.FC<Props> = ({
  lastNumber,
  topNumbers,
  segmentStats,
  rules,
  size = 320,
  predictedSector = null,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const wheel = rules === 'USA' ? USA_WHEEL : EUR_WHEEL;
  const segRanges = rules === 'USA' ? USA_SEG_RANGES : EUR_SEG_RANGES;
  const numPockets = wheel.length;
  const pocketArc = (Math.PI * 2) / numPockets;

  // Z-score map for segment heat ring opacity
  const segZMap = useMemo(() => {
    const m: Record<number, number> = {};
    segmentStats.forEach((s) => {
      const z = Math.max(0, s.z_score);
      // Opacity: 0.18 (base) up to 0.85 for z >= 3
      m[s.segment_index] = 0.18 + Math.min(z / 3, 1) * 0.67;
    });
    return m;
  }, [segmentStats]);

  const topSet = useMemo(() => new Set(topNumbers.map(String)), [topNumbers]);
  const centerPrediction = topNumbers[6]; // index 6 is the centre of 13

  // Animation pulse loop for last landed number highlight
  useEffect(() => {
    let animId: number | null = null;
    let startTime = performance.now();

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2;
      const baseDim = 880;
      const cx = baseDim / 2;
      const cy = baseDim / 2;

      // Ensure canvas backing store matches DPI
      if (canvas.width !== baseDim * dpr || canvas.height !== baseDim * dpr) {
        canvas.width = baseDim * dpr;
        canvas.height = baseDim * dpr;
      }

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const elapsed = performance.now() - startTime;
      // Smooth 1.4s pulse cycle for last landed pocket
      const pulse = 0.5 + 0.5 * Math.sin((elapsed / 1400) * Math.PI * 2);

      // Starting angle offset so pocket 0 is centered at 12 o'clock (top)
      const angleOffset = -Math.PI / 2 - pocketArc / 2;

      // ─────────────────────────────────────────────────────────────
      // LAYER 0: Outermost Segment Heat Map Ring (Radius 436 down to 408)
      // ─────────────────────────────────────────────────────────────
      // Outer subtle shadow backing
      ctx.beginPath();
      ctx.arc(cx, cy, 436, 0, Math.PI * 2);
      ctx.fillStyle = '#080b0e';
      ctx.fill();

      segRanges.forEach(([start, end], segIdx) => {
        const segNum = segIdx + 1;
        const opacity = segZMap[segNum] ?? 0.18;
        const color = SEGMENT_COLORS[segIdx];
        const startA = start * pocketArc + angleOffset;
        const endA = (end + 1) * pocketArc + angleOffset;

        // Draw heat arc sector
        ctx.beginPath();
        ctx.arc(cx, cy, 436, startA, endA);
        ctx.arc(cx, cy, 408, endA, startA, true);
        ctx.closePath();

        // Convert hex to rgba
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        ctx.fill();

        ctx.lineWidth = 1.2;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(opacity + 0.35, 0.95)})`;
        ctx.stroke();

        // Segment divider notch
        const notchCos = Math.cos(startA);
        const notchSin = Math.sin(startA);
        ctx.beginPath();
        ctx.moveTo(cx + notchCos * 406, cy + notchSin * 406);
        ctx.lineTo(cx + notchCos * 438, cy + notchSin * 438);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#27272a';
        ctx.stroke();

        // Segment label text (S1 - S6)
        const midA = (startA + endA) / 2;
        const labelR = 422;
        const lx = cx + Math.cos(midA) * labelR;
        const ly = cy + Math.sin(midA) * labelR;

        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(midA + Math.PI / 2);
        ctx.font = '700 13px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.95)`;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.6)`;
        ctx.shadowBlur = 4;
        ctx.fillText(`S${segNum}`, 0, 0);
        ctx.restore();
      });

      // Dividing ring between Segment Heat Ring and Bowl Rim
      ctx.beginPath();
      ctx.arc(cx, cy, 408, 0, Math.PI * 2);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#18181b';
      ctx.stroke();

      // ─────────────────────────────────────────────────────────────
      // ZONE 1: Outer Turned Mahogany Wooden Bowl (Radius 406 down to 346)
      // ─────────────────────────────────────────────────────────────
      const woodGrad = ctx.createRadialGradient(cx, cy, 180, cx, cy, 406);
      woodGrad.addColorStop(0, '#100502');
      woodGrad.addColorStop(0.20, '#260b05');
      woodGrad.addColorStop(0.48, '#541c0b');
      woodGrad.addColorStop(0.70, '#782a11');
      woodGrad.addColorStop(0.86, '#461608');
      woodGrad.addColorStop(1.0, '#120401');

      ctx.beginPath();
      ctx.arc(cx, cy, 406, 0, Math.PI * 2);
      ctx.fillStyle = woodGrad;
      ctx.fill();

      // Directional Lighting Sheen across Wooden Bowl (Light from top-left ~315°)
      const lightOverlay = ctx.createLinearGradient(cx - 360, cy - 360, cx + 360, cy + 360);
      lightOverlay.addColorStop(0, 'rgba(255, 235, 200, 0.16)');
      lightOverlay.addColorStop(0.38, 'rgba(255, 210, 160, 0.05)');
      lightOverlay.addColorStop(0.68, 'rgba(0, 0, 0, 0.18)');
      lightOverlay.addColorStop(1.0, 'rgba(0, 0, 0, 0.48)');
      ctx.beginPath();
      ctx.arc(cx, cy, 406, 0, Math.PI * 2);
      ctx.fillStyle = lightOverlay;
      ctx.fill();

      // Fine concentric wood grain striations (10 micro-rings with subtle variable opacity)
      const grainRadii = [352, 358, 364, 370, 376, 382, 388, 394, 398, 402];
      grainRadii.forEach((gr, idx) => {
        ctx.beginPath();
        ctx.arc(cx, cy, gr, 0, Math.PI * 2);
        ctx.lineWidth = 0.85;
        ctx.strokeStyle = idx % 2 === 0 ? 'rgba(0, 0, 0, 0.28)' : 'rgba(255, 210, 150, 0.08)';
        ctx.stroke();
      });

      // Outer chamfer rim lip with top-left specular highlight
      ctx.beginPath();
      ctx.arc(cx, cy, 404, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#220803';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 403, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = 'rgba(255, 245, 225, 0.42)';
      ctx.stroke();

      // Inner bowl slope drop-off shadow into lower canoe track
      const slopeShadow = ctx.createRadialGradient(cx, cy, 340, cx, cy, 354);
      slopeShadow.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
      slopeShadow.addColorStop(0.7, 'rgba(0, 0, 0, 0.35)');
      slopeShadow.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
      ctx.beginPath();
      ctx.arc(cx, cy, 354, 0, Math.PI * 2);
      ctx.fillStyle = slopeShadow;
      ctx.fill();

      // ─────────────────────────────────────────────────────────────
      // ZONE 2: 8 3D Faceted Brass Diamond Deflectors (Radius 362)
      // Alternating 4 Radial & 4 Tangential Pyramids
      // ─────────────────────────────────────────────────────────────
      for (let i = 0; i < 8; i++) {
        const dAngle = (i * Math.PI) / 4;
        const dx = cx + Math.cos(dAngle) * 362;
        const dy = cy + Math.sin(dAngle) * 362;
        const isRadial = i % 2 === 0;
        const rotAngle = isRadial ? dAngle : dAngle + Math.PI / 2;

        // Cast drop shadow onto the mahogany slope
        ctx.save();
        ctx.translate(dx + 3, dy + 4);
        ctx.rotate(rotAngle);
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.lineTo(4.5, 0);
        ctx.lineTo(0, 11);
        ctx.lineTo(-4.5, 0);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 5;
        ctx.fill();
        ctx.restore();

        // 4 Facets with metallic brass & specular lighting
        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(rotAngle);

        // Facet 1: Top-Left (facing light: bright specular glint)
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.lineTo(-4.5, 0);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fillStyle = '#fffde7';
        ctx.fill();

        // Facet 2: Bottom-Left (polished warm brass)
        ctx.beginPath();
        ctx.moveTo(-4.5, 0);
        ctx.lineTo(0, 11);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fillStyle = '#eab308';
        ctx.fill();

        // Facet 3: Top-Right (metallic mid-tone)
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.lineTo(4.5, 0);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fillStyle = '#ca8a04';
        ctx.fill();

        // Facet 4: Bottom-Right (shaded bronze)
        ctx.beginPath();
        ctx.moveTo(4.5, 0);
        ctx.lineTo(0, 11);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fillStyle = '#78350f';
        ctx.fill();

        // Central ridge highlight line
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.lineTo(0, 11);
        ctx.lineWidth = 0.7;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.restore();
      }

      // ─────────────────────────────────────────────────────────────
      // ZONE 3: Polished Ball Race / Canoe (Radius 346 down to 304)
      // ─────────────────────────────────────────────────────────────
      const canoeGrad = ctx.createRadialGradient(cx, cy, 304, cx, cy, 346);
      canoeGrad.addColorStop(0, '#151c24');
      canoeGrad.addColorStop(0.25, '#334155');
      canoeGrad.addColorStop(0.55, '#64748b');
      canoeGrad.addColorStop(0.85, '#1e293b');
      canoeGrad.addColorStop(1.0, '#0f172a');
      ctx.beginPath();
      ctx.arc(cx, cy, 346, 0, Math.PI * 2);
      ctx.arc(cx, cy, 304, 0, Math.PI * 2, true);
      ctx.fillStyle = canoeGrad;
      ctx.fill();

      // Gloss reflection highlight across the canoe track
      ctx.beginPath();
      ctx.arc(cx, cy, 325, -Math.PI * 0.8, -Math.PI * 0.2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.stroke();

      // ─────────────────────────────────────────────────────────────
      // ZONE 4: Outer Rotor Machined Bezel (Radius 304 down to 300)
      // ─────────────────────────────────────────────────────────────
      ctx.beginPath();
      ctx.arc(cx, cy, 304, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#e2e8f0';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 300, 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#94a3b8';
      ctx.stroke();

      // ─────────────────────────────────────────────────────────────
      // ZONE 5: Rotor Assembly (Numbers + 3D Pocket Wells + Sunburst Cone)
      // ─────────────────────────────────────────────────────────────

      // --- Part A: Outer Number Ring (Radius 300 down to 250) ---
      for (let i = 0; i < numPockets; i++) {
        const startA = i * pocketArc + angleOffset;
        const endA = startA + pocketArc;
        const p = wheel[i];
        const pStr = String(p);
        const isRed = RED_SET.has(Number(p));
        const isGreen = pStr === '0' || pStr === '00';
        const isTop = topSet.has(pStr);
        const isCenter = String(centerPrediction) === pStr;
        const isLast = lastNumber !== null && String(lastNumber) === pStr;

        // Number Pocket Background
        ctx.beginPath();
        ctx.arc(cx, cy, 300, startA, endA);
        ctx.arc(cx, cy, 250, endA, startA, true);
        ctx.closePath();

        let baseColor = isGreen ? '#007a33' : isRed ? '#9e1318' : '#11151a';
        ctx.fillStyle = baseColor;
        ctx.fill();

        // Tracker Top Number Highlight Glow
        if (isCenter) {
          ctx.beginPath();
          ctx.arc(cx, cy, 300, startA, endA);
          ctx.arc(cx, cy, 250, endA, startA, true);
          ctx.closePath();
          ctx.fillStyle = 'rgba(0, 255, 135, 0.40)';
          ctx.fill();

          ctx.lineWidth = 2.8;
          ctx.strokeStyle = '#00ff87';
          ctx.stroke();
        } else if (isTop) {
          ctx.beginPath();
          ctx.arc(cx, cy, 300, startA, endA);
          ctx.arc(cx, cy, 250, endA, startA, true);
          ctx.closePath();
          ctx.fillStyle = 'rgba(0, 255, 135, 0.20)';
          ctx.fill();

          ctx.lineWidth = 1.6;
          ctx.strokeStyle = 'rgba(0, 255, 135, 0.65)';
          ctx.stroke();
        }

        // Last Landed Number Pulse Glow
        if (isLast) {
          ctx.beginPath();
          ctx.arc(cx, cy, 300, startA, endA);
          ctx.arc(cx, cy, 250, endA, startA, true);
          ctx.closePath();
          ctx.lineWidth = 3.2;
          ctx.strokeStyle = `rgba(251, 191, 36, ${0.4 + 0.6 * pulse})`;
          ctx.shadowColor = 'rgba(251, 191, 36, 0.9)';
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // Thin polished separator pinstripe between numbers
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(startA) * 250, cy + Math.sin(startA) * 250);
        ctx.lineTo(cx + Math.cos(startA) * 300, cy + Math.sin(startA) * 300);
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.stroke();

        // Pocket Number Typography
        ctx.save();
        const midA = startA + pocketArc / 2;
        ctx.translate(cx, cy);
        ctx.rotate(midA);
        ctx.translate(275, 0);
        ctx.rotate(Math.PI / 2);

        if (isCenter) {
          ctx.fillStyle = '#00ff87';
          ctx.shadowColor = 'rgba(0, 255, 135, 0.85)';
          ctx.shadowBlur = 6;
        } else if (isLast) {
          ctx.fillStyle = '#fde047';
          ctx.shadowColor = 'rgba(251, 191, 36, 0.85)';
          ctx.shadowBlur = 6;
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.shadowBlur = 0;
        }

        ctx.font = pStr.length > 1 ? '600 21px Inter, sans-serif' : '600 23px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pStr, 0, 0);
        ctx.restore();
      }

      // --- Part B: Inner Pocket Wells & 3D Metal Frets (Radius 250 down to 190) ---
      for (let i = 0; i < numPockets; i++) {
        const startA = i * pocketArc + angleOffset;
        const endA = startA + pocketArc;
        const p = wheel[i];
        const isRed = RED_SET.has(Number(p));
        const isGreen = String(p) === '0' || String(p) === '00';
        const isTop = topSet.has(String(p));
        const isCenter = String(centerPrediction) === String(p);

        // Recessed pocket trough floor with inward depth gradient
        const troughGrad = ctx.createRadialGradient(cx, cy, 190, cx, cy, 250);
        if (isCenter) {
          troughGrad.addColorStop(0, '#047857');
          troughGrad.addColorStop(1, '#10b981');
        } else if (isTop) {
          if (isGreen) {
            troughGrad.addColorStop(0, '#005a26');
            troughGrad.addColorStop(1, '#059669');
          } else if (isRed) {
            troughGrad.addColorStop(0, '#7f1d1d');
            troughGrad.addColorStop(1, '#dc2626');
          } else {
            troughGrad.addColorStop(0, '#111827');
            troughGrad.addColorStop(1, '#374151');
          }
        } else {
          if (isGreen) {
            troughGrad.addColorStop(0, '#004d20');
            troughGrad.addColorStop(1, '#007a33');
          } else if (isRed) {
            troughGrad.addColorStop(0, '#660c10');
            troughGrad.addColorStop(1, '#9e1318');
          } else {
            troughGrad.addColorStop(0, '#0a0d10');
            troughGrad.addColorStop(1, '#151a20');
          }
        }

        ctx.beginPath();
        ctx.arc(cx, cy, 250, startA, endA);
        ctx.arc(cx, cy, 190, endA, startA, true);
        ctx.closePath();
        ctx.fillStyle = troughGrad;
        ctx.fill();

        // 3D Metallic Fret (Pocket Separator)
        const cosA = Math.cos(startA);
        const sinA = Math.sin(startA);

        // Shadow line on right side
        ctx.beginPath();
        ctx.moveTo(cx + cosA * 190 + 0.8, cy + sinA * 190 + 0.8);
        ctx.lineTo(cx + cosA * 250 + 0.8, cy + sinA * 250 + 0.8);
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.stroke();

        // Specular highlight line on left side
        ctx.beginPath();
        ctx.moveTo(cx + cosA * 190 - 0.8, cy + sinA * 190 - 0.8);
        ctx.lineTo(cx + cosA * 250 - 0.8, cy + sinA * 250 - 0.8);
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        // Main metallic fret body
        ctx.beginPath();
        ctx.moveTo(cx + cosA * 190, cy + sinA * 190);
        ctx.lineTo(cx + cosA * 250, cy + sinA * 250);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = '#cbd5e1';
        ctx.stroke();
      }

      // Fret ring dividing collars
      ctx.beginPath();
      ctx.arc(cx, cy, 250, 0, Math.PI * 2);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#cbd5e1';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 190, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#f59e0b';
      ctx.stroke();

      // --- Part C: 6 Wheel Sectors S1 to S6 (Radius 190 down to 86) ---
      const PURPLE_SECTORS = [
        '#281136', // S1
        '#351648', // S2
        '#220d30', // S3
        '#3e1954', // S4
        '#491d63', // S5
        '#2c133c', // S6
      ];

      segRanges.forEach(([start, end], segIdx) => {
        const segNum = segIdx + 1;
        const isPred = predictedSector === segNum;
        const color = isPred ? '#5b227c' : PURPLE_SECTORS[segIdx];
        const startA = start * pocketArc + angleOffset;
        const endA = (end + 1) * pocketArc + angleOffset;

        // Draw sector pie slice
        ctx.beginPath();
        ctx.arc(cx, cy, 190, startA, endA);
        ctx.arc(cx, cy, 86, endA, startA, true);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        // Border / divider
        ctx.lineWidth = isPred ? 2.5 : 1;
        ctx.strokeStyle = isPred ? '#00f2fe' : 'rgba(255, 255, 255, 0.2)';
        ctx.stroke();

        // Sector label text (S1 - S6)
        const midA = (startA + endA) / 2;
        const labelR = 138;
        const lx = cx + Math.cos(midA) * labelR;
        const ly = cy + Math.sin(midA) * labelR;

        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(midA + Math.PI / 2);
        ctx.font = '700 15px Inter, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isPred ? '#00f2fe' : 'rgba(240, 230, 255, 0.85)';
        if (isPred) {
          ctx.shadowColor = 'rgba(0, 242, 254, 0.9)';
          ctx.shadowBlur = 8;
        } else {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 4;
        }
        ctx.fillText(`S${segNum}`, 0, 0);
        ctx.restore();
      });

      // Inner brass retaining collar at base of hub
      ctx.beginPath();
      ctx.arc(cx, cy, 86, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#d97706';
      ctx.stroke();

      // ─────────────────────────────────────────────────────────────
      // ZONE 6: Center Hub / Outcome Medallion ("LAST" + Pocket Number)
      // ─────────────────────────────────────────────────────────────
      // Drop shadow for medallion
      ctx.beginPath();
      ctx.arc(cx, cy, 86, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Outer fluted metallic brass/gold bezel
      const bezelGrad = ctx.createRadialGradient(cx - 15, cy - 15, 20, cx, cy, 86);
      bezelGrad.addColorStop(0, '#ffffff');
      bezelGrad.addColorStop(0.35, '#fde047');
      bezelGrad.addColorStop(0.7, '#d97706');
      bezelGrad.addColorStop(1, '#78350f');
      ctx.beginPath();
      ctx.arc(cx, cy, 86, 0, Math.PI * 2);
      ctx.fillStyle = bezelGrad;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#fef08a';
      ctx.stroke();

      // Dark obsidian enamel disc matching reference UI
      const hubGrad = ctx.createRadialGradient(cx - 10, cy - 10, 15, cx, cy, 80);
      hubGrad.addColorStop(0, '#1a232f');
      hubGrad.addColorStop(0.6, '#0f1722');
      hubGrad.addColorStop(1, '#080c12');

      ctx.beginPath();
      ctx.arc(cx, cy, 80, 0, Math.PI * 2);
      ctx.fillStyle = hubGrad;
      ctx.fill();

      // Inner cyan/gold accent ring
      ctx.beginPath();
      ctx.arc(cx, cy, 74, 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.35)';
      ctx.stroke();

      // "LAST" label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.letterSpacing = '2px';
      ctx.fillText('LAST', cx, cy - 16);

      // Outcome number prominently in center (cyan font matching reference UI)
      const lastStr = lastNumber !== null ? String(lastNumber) : '--';
      ctx.fillStyle = '#00f2fe';
      ctx.font = '900 38px Inter, monospace, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 242, 254, 0.75)';
      ctx.shadowBlur = 14;
      ctx.fillText(lastStr, cx, cy + 14);
      ctx.shadowBlur = 0;

      ctx.restore();

      // Only schedule next animation frame if there is an active pulse effect on last landed number
      if (lastNumber !== null) {
        animId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animId !== null) {
        cancelAnimationFrame(animId);
      }
    };
  }, [wheel, segRanges, numPockets, pocketArc, segZMap, topSet, centerPrediction, lastNumber, predictedSector]);

  return (
    <div
      style={{ width: size, height: size }}
      className="relative select-none flex items-center justify-center"
    >
      <canvas
        ref={canvasRef}
        style={{
          width: size,
          height: size,
          display: 'block',
        }}
        className="rounded-full shadow-2xl drop-shadow-[0_12px_24px_rgba(0,0,0,0.85)]"
      />
    </div>
  );
};
