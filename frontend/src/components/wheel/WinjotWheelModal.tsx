import React, { useEffect, useRef, useState } from 'react';
import type { SpinResult, PocketValue } from '../../stores/simulator.store';
import { useSimulatorStore } from '../../stores/simulator.store';
import { audioService } from '../../services/audio.service';
import { Volume2, VolumeX, Maximize2, Minimize2 } from 'lucide-react';

const EUR_SEQUENCE: PocketValue[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const USA_SEQUENCE: PocketValue[] = [
  0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, '00',
  27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2
];

const RED_SET = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

interface WinjotWheelModalProps {
  isOpen: boolean;
  spinResult: SpinResult | null;
  onBallLand?: () => void;
  onComplete: () => void;
}

export const WinjotWheelModal: React.FC<WinjotWheelModalProps> = ({
  isOpen,
  spinResult,
  onBallLand,
  onComplete,
}) => {
  const { rules, currentSpinDirection, coldNumbers, hotNumbers } = useSimulatorStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLanded, setIsLanded] = useState(false);
  const canDismissRef = useRef(false);

  const onBallLandRef = useRef(onBallLand);
  onBallLandRef.current = onBallLand;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const seq = rules === 'USA' ? USA_SEQUENCE : EUR_SEQUENCE;
  const numPockets = seq.length;

  useEffect(() => {
    if (!isOpen || !spinResult) return;

    canDismissRef.current = false;
    setIsLanded(false);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const startTime = performance.now();
    let hasPlayedDrop = false;
    let hasCompleted = false;

    // Spin physics constants
    const dirSign = currentSpinDirection === 'ccw' ? -1 : 1;
    const SPIN_DURATION = 4.9; // seconds to complete roll and land
    const TOTAL_DURATION = 6.2; // total modal duration (1.3s post-land display)


    // Pocket arc and target pocket relative angle on rotor
    const pocketArc = (Math.PI * 2) / numPockets;
    const targetIdx = seq.findIndex(p => String(p) === String(spinResult.pocketNumber));
    const targetRelativeAngle = targetIdx * pocketArc + pocketArc / 2;

    // Rotor parameters (increased wheel speed slightly per user request)
    const rotorBaseSpeed = 0.82 * dirSign;
    const rotorDecel = 0.065 * dirSign;

    // Precalculate target pocket's absolute angle at landing time
    const rotorLandAngle = rotorBaseSpeed * SPIN_DURATION - 0.5 * rotorDecel * Math.pow(SPIN_DURATION, 2);
    const targetLandAngle = rotorLandAngle + targetRelativeAngle;

    // Ball completes 6.5 full counter-rotations
    const BALL_REVOLUTIONS = 6.5;
    const ballStartAngle = targetLandAngle + BALL_REVOLUTIONS * 2 * Math.PI * dirSign;
    const totalBallAngleTravel = targetLandAngle - ballStartAngle;

    audioService.playBallChatter();

    const render = (time: number) => {
      const elapsed = (time - startTime) / 1000;

      // 1. Calculate Rotor Angle
      let currentRotorAngle: number;
      if (elapsed < SPIN_DURATION) {
        currentRotorAngle = rotorBaseSpeed * elapsed - 0.5 * rotorDecel * Math.pow(elapsed, 2);
      } else {
        const postElapsed = elapsed - SPIN_DURATION;
        const coastSpeed = (rotorBaseSpeed - rotorDecel * SPIN_DURATION) * 0.4;
        currentRotorAngle = rotorLandAngle + coastSpeed * postElapsed;
      }

      // 2. Calculate Ball Angle & Radius with Zero Discontinuity
      let currentBallAngle: number;
      let currentBallRadius: number;

      const R_OUTER = 328;
      const R_POCKET = 222;

      if (elapsed < SPIN_DURATION) {
        const p = elapsed / SPIN_DURATION; // 0 -> 1

        // Smooth continuous easing for angle: monotonically decelerates to pocket
        const angleProgress = 1 - Math.pow(1 - p, 2.8);
        currentBallAngle = ballStartAngle + totalBallAngleTravel * angleProgress;

        // Radius progression
        if (p < 0.45) {
          currentBallRadius = R_OUTER;
        } else if (p < 0.85) {
          const sp = (p - 0.45) / 0.40;
          const easeSpiral = 0.5 - 0.5 * Math.cos(sp * Math.PI);
          currentBallRadius = R_OUTER - (R_OUTER - R_POCKET) * easeSpiral;
        } else {
          // Fret chatter bounce
          if (!hasPlayedDrop) {
            hasPlayedDrop = true;
            audioService.playBallDrop();
          }
          const bp = (p - 0.85) / 0.15;
          const bounce = Math.sin(bp * Math.PI * 4) * (1 - bp) * 6;
          currentBallRadius = R_POCKET + bounce;
        }
      } else {
        // Locked into winning pocket seamlessly
        if (!canDismissRef.current) {
          canDismissRef.current = true;
          setIsLanded(true);
          onBallLandRef.current?.();
        }

        currentBallRadius = R_POCKET;
        currentBallAngle = currentRotorAngle + targetRelativeAngle;

        if (elapsed >= TOTAL_DURATION && !hasCompleted) {
          hasCompleted = true;
          onCompleteRef.current?.();
          return;
        }
      }

      // 3. Render 840x840 Canvas for Sharp High-DPI Display
      ctx.clearRect(0, 0, 840, 840);
      const cx = 420;
      const cy = 420;

      // -------------------------------------------------------------
      // ZONE 1: Outer Turned Mahogany Wooden Bowl (Radius 414 down to 352)
      // -------------------------------------------------------------
      const woodGrad = ctx.createRadialGradient(cx, cy, 180, cx, cy, 414);
      woodGrad.addColorStop(0, '#100502');
      woodGrad.addColorStop(0.20, '#260b05');
      woodGrad.addColorStop(0.48, '#541c0b');
      woodGrad.addColorStop(0.70, '#782a11');
      woodGrad.addColorStop(0.86, '#461608');
      woodGrad.addColorStop(1.0, '#120401');

      ctx.beginPath();
      ctx.arc(cx, cy, 414, 0, Math.PI * 2);
      ctx.fillStyle = woodGrad;
      ctx.fill();

      // Directional Lighting Sheen across Wooden Bowl (Light from top-left ~315°)
      const lightOverlay = ctx.createLinearGradient(cx - 380, cy - 380, cx + 380, cy + 380);
      lightOverlay.addColorStop(0, 'rgba(255, 235, 200, 0.16)');
      lightOverlay.addColorStop(0.38, 'rgba(255, 210, 160, 0.05)');
      lightOverlay.addColorStop(0.68, 'rgba(0, 0, 0, 0.18)');
      lightOverlay.addColorStop(1.0, 'rgba(0, 0, 0, 0.48)');
      ctx.beginPath();
      ctx.arc(cx, cy, 414, 0, Math.PI * 2);
      ctx.fillStyle = lightOverlay;
      ctx.fill();

      // Fine concentric wood grain striations (12 micro-rings with subtle variable opacity)
      const grainRadii = [358, 364, 370, 376, 382, 388, 394, 400, 405, 409];
      grainRadii.forEach((gr, idx) => {
        ctx.beginPath();
        ctx.arc(cx, cy, gr, 0, Math.PI * 2);
        ctx.lineWidth = 0.85;
        ctx.strokeStyle = idx % 2 === 0 ? 'rgba(0, 0, 0, 0.28)' : 'rgba(255, 210, 150, 0.08)';
        ctx.stroke();
      });

      // Outer chamfer rim lip with top-left specular highlight
      ctx.beginPath();
      ctx.arc(cx, cy, 412, 0, Math.PI * 2);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#220803';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 410, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = 'rgba(255, 245, 225, 0.42)';
      ctx.stroke();

      // Inner bowl slope drop-off shadow into lower canoe track
      const slopeShadow = ctx.createRadialGradient(cx, cy, 342, cx, cy, 356);
      slopeShadow.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
      slopeShadow.addColorStop(0.7, 'rgba(0, 0, 0, 0.35)');
      slopeShadow.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
      ctx.beginPath();
      ctx.arc(cx, cy, 356, 0, Math.PI * 2);
      ctx.fillStyle = slopeShadow;
      ctx.fill();

      // -------------------------------------------------------------
      // ZONE 2: 8 3D Faceted Brass Diamond Deflectors (Radius 366)
      // Alternating 4 Radial & 4 Tangential Pyramids (Matches Casino References)
      // -------------------------------------------------------------
      for (let i = 0; i < 8; i++) {
        const dAngle = (i * Math.PI) / 4;
        const dx = cx + Math.cos(dAngle) * 366;
        const dy = cy + Math.sin(dAngle) * 366;
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

      // -------------------------------------------------------------
      // ZONE 3: Polished Ball Race / Canoe (Radius 348 down to 306)
      // -------------------------------------------------------------
      const canoeGrad = ctx.createRadialGradient(cx, cy, 306, cx, cy, 348);
      canoeGrad.addColorStop(0, '#151c24');
      canoeGrad.addColorStop(0.25, '#334155');
      canoeGrad.addColorStop(0.55, '#64748b');
      canoeGrad.addColorStop(0.85, '#1e293b');
      canoeGrad.addColorStop(1.0, '#0f172a');
      ctx.beginPath();
      ctx.arc(cx, cy, 348, 0, Math.PI * 2);
      ctx.arc(cx, cy, 306, 0, Math.PI * 2, true);
      ctx.fillStyle = canoeGrad;
      ctx.fill();

      // Gloss reflection highlight across the canoe track
      ctx.beginPath();
      ctx.arc(cx, cy, 328, -Math.PI * 0.8, -Math.PI * 0.2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.stroke();

      // -------------------------------------------------------------
      // ZONE 4: Outer Rotor Machined Bezel (Radius 306 down to 302)
      // -------------------------------------------------------------
      ctx.beginPath();
      ctx.arc(cx, cy, 306, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#e2e8f0';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 302, 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#94a3b8';
      ctx.stroke();

      // -------------------------------------------------------------
      // ZONE 5: Rotor Assembly (Numbers + 3D Pocket Wells + Sunburst Cone)
      // -------------------------------------------------------------
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(currentRotorAngle);

      // --- Part A: Outer Number Ring (Radius 302 down to 252) ---
      for (let i = 0; i < numPockets; i++) {
        const startA = i * pocketArc;
        const endA = startA + pocketArc;
        const p = seq[i];
        const isRed = RED_SET.has(Number(p));
        const isGreen = String(p) === '0' || String(p) === '00';

        // Number Pocket Background
        ctx.beginPath();
        ctx.arc(0, 0, 302, startA, endA);
        ctx.arc(0, 0, 252, endA, startA, true);
        ctx.closePath();
        ctx.fillStyle = isGreen ? '#007a33' : isRed ? '#9e1318' : '#11151a';
        ctx.fill();

        // Thin polished separator pinstripe between numbers
        ctx.beginPath();
        ctx.moveTo(Math.cos(startA) * 252, Math.sin(startA) * 252);
        ctx.lineTo(Math.cos(startA) * 302, Math.sin(startA) * 302);
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.stroke();

        // Pocket Number (clean, unbolded typography per user request)
        ctx.save();
        const midA = startA + pocketArc / 2;
        ctx.rotate(midA);
        ctx.translate(277, 0);
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = '#ffffff';
        const numStr = String(p);
        ctx.font = numStr.length > 1 ? '500 23px Inter, sans-serif' : '500 25px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(numStr, 0, 0);
        ctx.restore();
      }

      // --- Part B: Inner Pocket Wells & 3D Metal Frets (Radius 252 down to 192) ---
      for (let i = 0; i < numPockets; i++) {
        const startA = i * pocketArc;
        const endA = startA + pocketArc;
        const p = seq[i];
        const isRed = RED_SET.has(Number(p));
        const isGreen = String(p) === '0' || String(p) === '00';

        // Recessed pocket trough floor with inward depth gradient
        const troughGrad = ctx.createRadialGradient(0, 0, 192, 0, 0, 252);
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

        ctx.beginPath();
        ctx.arc(0, 0, 252, startA, endA);
        ctx.arc(0, 0, 192, endA, startA, true);
        ctx.closePath();
        ctx.fillStyle = troughGrad;
        ctx.fill();

        // 3D Metallic Fret (Pocket Separator)
        // Shadow line on right side
        const cosA = Math.cos(startA);
        const sinA = Math.sin(startA);
        ctx.beginPath();
        ctx.moveTo(cosA * 192 + 0.8, sinA * 192 + 0.8);
        ctx.lineTo(cosA * 252 + 0.8, sinA * 252 + 0.8);
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.stroke();

        // Specular highlight line on left side
        ctx.beginPath();
        ctx.moveTo(cosA * 192 - 0.8, sinA * 192 - 0.8);
        ctx.lineTo(cosA * 252 - 0.8, sinA * 252 - 0.8);
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        // Main metallic fret body
        ctx.beginPath();
        ctx.moveTo(cosA * 192, sinA * 192);
        ctx.lineTo(cosA * 252, sinA * 252);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = '#cbd5e1';
        ctx.stroke();
      }

      // Fret ring dividing collars
      ctx.beginPath();
      ctx.arc(0, 0, 252, 0, Math.PI * 2);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#cbd5e1';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, 192, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#f59e0b';
      ctx.stroke();

      // --- Part C: Sunburst Bookmatched Mahogany Cone (Radius 192 down to 86) ---
      // Segmented radial pie slices radiating outward from center turret
      for (let i = 0; i < numPockets; i++) {
        const startA = i * pocketArc;
        const endA = startA + pocketArc;
        const isEven = i % 2 === 0;

        ctx.beginPath();
        ctx.arc(0, 0, 192, startA, endA);
        ctx.arc(0, 0, 86, endA, startA, true);
        ctx.closePath();
        ctx.fillStyle = isEven ? '#6b250e' : '#421608';
        ctx.fill();

        // Delicate brass stringing inlay line between radial wood segments
        ctx.beginPath();
        ctx.moveTo(Math.cos(startA) * 86, Math.sin(startA) * 86);
        ctx.lineTo(Math.cos(startA) * 192, Math.sin(startA) * 192);
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
        ctx.stroke();
      }

      // Sweeping gloss reflection across the sunburst cone lacquer
      ctx.beginPath();
      ctx.arc(0, 0, 140, -Math.PI * 0.75, -Math.PI * 0.25);
      ctx.lineWidth = 24;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.stroke();

      // Inner brass retaining collar at base of turret
      ctx.beginPath();
      ctx.arc(0, 0, 86, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#d97706';
      ctx.stroke();

      // --- Part D: 3D Turned Metallic Turret (During Spin) ---
      const isReveal = elapsed >= SPIN_DURATION;
      if (!isReveal) {
        // Pedestal base with vertical reflection bands
        const baseGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 86);
        baseGrad.addColorStop(0, '#fef08a');
        baseGrad.addColorStop(0.35, '#d97706');
        baseGrad.addColorStop(0.7, '#78350f');
        baseGrad.addColorStop(1.0, '#381404');
        ctx.beginPath();
        ctx.arc(0, 0, 86, 0, Math.PI * 2);
        ctx.fillStyle = baseGrad;
        ctx.fill();

        // Stepped collar tier
        ctx.beginPath();
        ctx.arc(0, 0, 62, 0, Math.PI * 2);
        ctx.fillStyle = '#b45309';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fde047';
        ctx.stroke();

        // 4 Polished Brass Cross-Arms with spherical turned knobs
        for (let a = 0; a < 4; a++) {
          const armAngle = (a * Math.PI) / 2;
          ctx.save();
          ctx.rotate(armAngle);

          // Arm rod
          ctx.beginPath();
          ctx.moveTo(0, -3.5);
          ctx.lineTo(52, -2.5);
          ctx.lineTo(52, 2.5);
          ctx.lineTo(0, 3.5);
          ctx.closePath();
          ctx.fillStyle = '#eab308';
          ctx.fill();
          ctx.lineWidth = 0.8;
          ctx.strokeStyle = '#fef08a';
          ctx.stroke();

          // Spherical turned grip knob at end of arm
          const knobGrad = ctx.createRadialGradient(50, -2, 1, 52, 0, 7);
          knobGrad.addColorStop(0, '#ffffff');
          knobGrad.addColorStop(0.4, '#fde047');
          knobGrad.addColorStop(0.8, '#b45309');
          knobGrad.addColorStop(1, '#451a03');
          ctx.beginPath();
          ctx.arc(52, 0, 6.5, 0, Math.PI * 2);
          ctx.fillStyle = knobGrad;
          ctx.fill();

          ctx.restore();
        }

        // Fluted center neck
        ctx.beginPath();
        ctx.arc(0, 0, 38, 0, Math.PI * 2);
        ctx.fillStyle = '#78350f';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fef08a';
        ctx.stroke();

        // Central top domed crown with spherical 3D highlight
        const crownGrad = ctx.createRadialGradient(-6, -6, 2, 0, 0, 24);
        crownGrad.addColorStop(0, '#ffffff');
        crownGrad.addColorStop(0.3, '#fde047');
        crownGrad.addColorStop(0.7, '#b45309');
        crownGrad.addColorStop(1, '#451a03');
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.fillStyle = crownGrad;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }

      ctx.restore(); // end rotor

      // -------------------------------------------------------------
      // ZONE 6: Center Hub Outcome Medallion (Revealed Upon Landing)
      // -------------------------------------------------------------
      if (isReveal) {
        // Drop shadow for medallion over the cone
        ctx.beginPath();
        ctx.arc(cx, cy, 138, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 24;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Outer fluted metallic bezel
        const bezelGrad = ctx.createRadialGradient(cx - 20, cy - 20, 30, cx, cy, 136);
        bezelGrad.addColorStop(0, '#ffffff');
        bezelGrad.addColorStop(0.35, '#fde047');
        bezelGrad.addColorStop(0.7, '#d97706');
        bezelGrad.addColorStop(1, '#78350f');
        ctx.beginPath();
        ctx.arc(cx, cy, 136, 0, Math.PI * 2);
        ctx.fillStyle = bezelGrad;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        // Royal Jewel Enamel Disc matching winning color
        const hubGrad = ctx.createRadialGradient(cx - 15, cy - 15, 20, cx, cy, 128);
        if (spinResult.color === 'red') {
          hubGrad.addColorStop(0, '#b91c1c');
          hubGrad.addColorStop(0.7, '#881316');
          hubGrad.addColorStop(1, '#4f080a');
        } else if (spinResult.color === 'black') {
          hubGrad.addColorStop(0, '#263140');
          hubGrad.addColorStop(0.7, '#131922');
          hubGrad.addColorStop(1, '#080b0f');
        } else {
          hubGrad.addColorStop(0, '#059669');
          hubGrad.addColorStop(0.7, '#047857');
          hubGrad.addColorStop(1, '#064e3b');
        }

        ctx.beginPath();
        ctx.arc(cx, cy, 128, 0, Math.PI * 2);
        ctx.fillStyle = hubGrad;
        ctx.fill();

        // Inner white/gold pinstripe accent circle
        ctx.beginPath();
        ctx.arc(cx, cy, 120, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.stroke();

        // Winning outcome number prominently in center (clean typography)
        ctx.fillStyle = '#ffffff';
        ctx.font = '500 100px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 16;
        ctx.fillText(String(spinResult.pocketNumber), cx, cy);
        ctx.shadowBlur = 0;
      }

      // -------------------------------------------------------------
      // ZONE 7: Photorealistic 3D Ball (Radius 15px)
      // -------------------------------------------------------------
      const BALL_RADIUS = 15;
      const bx = cx + Math.cos(currentBallAngle) * currentBallRadius;
      const by = cy + Math.sin(currentBallAngle) * currentBallRadius;

      // Contact drop shadow on track / pocket floor beneath the ball
      ctx.beginPath();
      ctx.ellipse(bx + 3, by + 4, BALL_RADIUS * 1.1, BALL_RADIUS * 0.85, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Pearly ivory 3D sphere with off-center specular hotspot
      const ballGrad = ctx.createRadialGradient(bx - 5, by - 5, 1, bx - 2, by - 2, BALL_RADIUS + 2);
      ballGrad.addColorStop(0, '#ffffff');
      ballGrad.addColorStop(0.25, '#f8fafc');
      ballGrad.addColorStop(0.60, '#e2e8f0');
      ballGrad.addColorStop(0.85, '#94a3b8');
      ballGrad.addColorStop(1.0, '#475569');

      ctx.beginPath();
      ctx.arc(bx, by, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = ballGrad;
      ctx.fill();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isOpen, spinResult?.id]);

  if (!isOpen || !spinResult) return null;

  const handleModalClick = () => {
    // Wheel is completely non-clickable while spinning!
    // Wheel can only close POST the spin is complete and the ball has landed.
    if (!canDismissRef.current) return;
    onCompleteRef.current?.();
  };

  return (
    <div
      onClick={handleModalClick}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/72 backdrop-blur-[3px] select-none animate-fade-in ${
        isLanded ? 'cursor-pointer' : 'cursor-default'
      }`}
    >
      <div className="relative flex items-center justify-center w-full h-full p-4">
        {/* Hot Numbers List on Left (Matches Reference Image) */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="hidden lg:flex flex-col items-center absolute left-8 top-1/2 -translate-y-1/2 bg-black/60 backdrop-blur-md border border-white/20 rounded-2xl p-4 space-y-3 shadow-2xl pointer-events-auto"
        >
          <span className="text-xs font-black text-rose-400 uppercase tracking-widest">
            HOT
          </span>
          <div className="flex flex-col space-y-2">
            {hotNumbers.slice(0, 5).map((num, i) => {
              const isRed = RED_SET.has(Number(num));
              const isGreen = String(num) === '0' || String(num) === '00';
              return (
                <div
                  key={i}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-base text-white border border-white/30 shadow-md ${
                    isGreen ? 'bg-[#008f39]' : isRed ? 'bg-[#c8191d]' : 'bg-[#111417]'
                  }`}
                >
                  {num}
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Roulette Wheel (840x840) */}
        <div
          className={`relative flex items-center justify-center rounded-full shadow-[0_0_120px_rgba(0,0,0,0.95)] ${
            isLanded ? 'cursor-pointer' : 'pointer-events-none cursor-default'
          }`}
        >
          <canvas
            ref={canvasRef}
            width={840}
            height={840}
            className="w-[460px] h-[460px] sm:w-[620px] sm:h-[620px] md:w-[740px] md:h-[740px] lg:w-[840px] lg:h-[840px] max-w-[94vw] max-h-[94vh] rounded-full drop-shadow-[0_25px_80px_rgba(0,0,0,0.95)]"
          />
        </div>

        {/* Cold Numbers List on Right */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="hidden lg:flex flex-col items-center absolute right-8 top-1/2 -translate-y-1/2 bg-black/60 backdrop-blur-md border border-white/20 rounded-2xl p-4 space-y-3 shadow-2xl pointer-events-auto"
        >
          <span className="text-xs font-black text-sky-400 uppercase tracking-widest">
            COLD
          </span>
          <div className="flex flex-col space-y-2">
            {coldNumbers.slice(0, 5).map((num, i) => {
              const isRed = RED_SET.has(Number(num));
              const isGreen = String(num) === '0' || String(num) === '00';
              return (
                <div
                  key={i}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-base text-white border border-white/30 shadow-md ${
                    isGreen ? 'bg-[#008f39]' : isRed ? 'bg-[#c8191d]' : 'bg-[#111417]'
                  }`}
                >
                  {num}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom-right audio & fullscreen controls */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-6 right-6 flex items-center space-x-3 text-white/70 pointer-events-auto"
        >
          <button
            onClick={() => {
              const next = !isMuted;
              setIsMuted(next);
              audioService.setMuted(next);
            }}
            className="p-3 bg-black/60 hover:bg-black/90 rounded-full border border-white/20 transition cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
                setIsFullscreen(true);
              } else {
                document.exitFullscreen().catch(() => {});
                setIsFullscreen(false);
              }
            }}
            className="p-3 bg-black/60 hover:bg-black/90 rounded-full border border-white/20 transition cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
