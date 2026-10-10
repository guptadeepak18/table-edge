import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { SpinResult } from '../../stores/simulator.store';
import { useSimulatorStore } from '../../stores/simulator.store';
import { audioService } from '../../services/audio.service';

const EUR_SEQUENCE = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const USA_SEQUENCE = [
  0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, '00',
  27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2
];

export const RouletteWheel3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    rules,
    isSpinning,
    triggerSpin,
    finalizeSpin,
    fastMode,
    rotationMode,
    currentSpinDirection,
    spinRequestId,
  } = useSimulatorStore();

  const [revealData, setRevealData] = useState<SpinResult | null>(null);

  // Three.js object references
  const rotorRef = useRef<THREE.Group | null>(null);
  const ballMeshRef = useRef<THREE.Mesh | null>(null);
  const animFrameId = useRef<number | null>(null);
  const physicsState = useRef<'IDLE' | 'LAUNCH' | 'DECEL' | 'CHATTER' | 'SETTLING' | 'REVEAL'>('IDLE');

  // Physics velocities and angles
  const rotorAngle = useRef(0);
  const rotorVelocity = useRef(0.2); // ambient drift
  const ballAngle = useRef(0);
  const ballRadius = useRef(2.3);
  const ballVelocity = useRef(0);
  const ballHeight = useRef(0.35);
  const targetPocketAngle = useRef(0);
  const activeSpinResult = useRef<SpinResult | null>(null);

  const seq = rules === 'USA' ? USA_SEQUENCE : EUR_SEQUENCE;
  const numPockets = seq.length;

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Scene, Camera, Renderer
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 4.6, 4.6);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xfff3d6, 2.5, 20);
    pointLight.position.set(2, 6, 4);
    pointLight.castShadow = true;
    scene.add(pointLight);

    const rimLight = new THREE.PointLight(0x00ff87, 0.8, 15);
    rimLight.position.set(-4, 3, -4);
    scene.add(rimLight);

    // 3. Wheel Geometry Setup
    const wheelGroup = new THREE.Group();
    scene.add(wheelGroup);

    // Outer Mahogany Bowl
    const bowlGeo = new THREE.CylinderGeometry(2.7, 2.5, 0.4, 48);
    const bowlMat = new THREE.MeshStandardMaterial({
      color: 0x2b1509,
      roughness: 0.35,
      metalness: 0.1,
    });
    const bowlMesh = new THREE.Mesh(bowlGeo, bowlMat);
    wheelGroup.add(bowlMesh);

    // Chrome Metal Rim
    const rimGeo = new THREE.TorusGeometry(2.52, 0.08, 16, 64);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.9,
      roughness: 0.15,
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = 0.2;
    wheelGroup.add(rimMesh);

    // Rotating Rotor Group
    const rotorGroup = new THREE.Group();
    wheelGroup.add(rotorGroup);
    rotorRef.current = rotorGroup;

    // Numbered Pockets Ring
    const rotorGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.25, 48);
    const rotorMat = new THREE.MeshStandardMaterial({
      color: 0x111417,
      roughness: 0.6,
      metalness: 0.3,
    });
    const rotorMesh = new THREE.Mesh(rotorGeo, rotorMat);
    rotorMesh.position.y = 0.1;
    rotorGroup.add(rotorMesh);

    // Pocket dividers (Frets)
    const fretMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.2 });
    for (let i = 0; i < numPockets; i++) {
      const angle = (i / numPockets) * Math.PI * 2;
      const fretGeo = new THREE.BoxGeometry(0.04, 0.12, 0.45);
      const fret = new THREE.Mesh(fretGeo, fretMat);
      fret.position.set(Math.cos(angle) * 1.9, 0.22, Math.sin(angle) * 1.9);
      fret.rotation.y = -angle;
      rotorGroup.add(fret);
    }

    // Center Turret
    const turretGeo = new THREE.ConeGeometry(0.7, 0.6, 32);
    const turretMat = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      metalness: 0.85,
      roughness: 0.2,
    });
    const turretMesh = new THREE.Mesh(turretGeo, turretMat);
    turretMesh.position.y = 0.45;
    rotorGroup.add(turretMesh);

    // Roulette Ball
    const ballGeo = new THREE.SphereGeometry(0.08, 24, 24);
    const ballMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0.8,
    });
    const ballMesh = new THREE.Mesh(ballGeo, ballMat);
    ballMesh.position.set(2.3, 0.35, 0);
    wheelGroup.add(ballMesh);
    ballMeshRef.current = ballMesh;

    // 4. Animation Loop
    let lastTime = performance.now();

    const animate = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      // Update rotor angle
      rotorAngle.current += rotorVelocity.current * dt;
      if (rotorRef.current) {
        rotorRef.current.rotation.y = rotorAngle.current;
      }

      // Physics State Machine
      const state = physicsState.current;

      if (state === 'IDLE') {
        // Slow gentle idle drift
        rotorVelocity.current = 0.3;
        ballAngle.current += 0.3 * dt;
        ballRadius.current = 1.9;
        ballHeight.current = 0.25;
      } else if (state === 'LAUNCH') {
        // Accelerating rotor and launching ball in opposite direction
        const dirSign = currentSpinDirection === 'ccw' ? -1 : 1;
        rotorVelocity.current = 3.8 * dirSign;
        ballVelocity.current = -9.2 * dirSign;
        ballRadius.current = 2.38; // high on rim
        ballHeight.current = 0.36;

        physicsState.current = 'DECEL';
      } else if (state === 'DECEL') {
        // Deceleration physics: domega/dt = -alpha, ball loses centrifugal grip
        rotorVelocity.current *= 0.994;
        ballVelocity.current *= 0.985;
        ballAngle.current += ballVelocity.current * dt;

        // Ball starts losing grip and spiral inwards towards deflectors
        if (Math.abs(ballVelocity.current) < 5.0) {
          ballRadius.current = Math.max(1.95, ballRadius.current - 0.35 * dt);
          ballHeight.current = Math.max(0.24, ballHeight.current - 0.12 * dt);
        }

        if (Math.abs(ballVelocity.current) < 2.5) {
          physicsState.current = 'CHATTER';
          audioService.playBallChatter();
        }
      } else if (state === 'CHATTER') {
        // Deflector bounces with damping & jitter
        ballAngle.current += ballVelocity.current * dt;
        ballVelocity.current *= 0.92;
        ballRadius.current = 1.9 + (Math.random() - 0.5) * 0.05;

        if (Math.random() < 0.2) {
          audioService.playBallChatter();
        }

        if (Math.abs(ballVelocity.current - rotorVelocity.current) < 0.8) {
          physicsState.current = 'SETTLING';
          audioService.playBallDrop();
        }
      } else if (state === 'SETTLING') {
        // Target pocket pulls ball into center cradle, dampens relative velocity to 0
        const currentTargetAbsAngle = rotorAngle.current + targetPocketAngle.current;
        const angleDiff = currentTargetAbsAngle - ballAngle.current;

        ballAngle.current += angleDiff * Math.min(1, 8.0 * dt);
        ballRadius.current = Math.max(1.88, ballRadius.current - 0.2 * dt);
        ballHeight.current = 0.22;

        if (Math.abs(angleDiff) < 0.03) {
          physicsState.current = 'REVEAL';
          if (activeSpinResult.current) {
            setRevealData(activeSpinResult.current);
            setTimeout(() => {
              if (activeSpinResult.current) {
                finalizeSpin(activeSpinResult.current);
                setRevealData(null);
                physicsState.current = 'IDLE';
              }
            }, 900);
          }
        }
      } else if (state === 'REVEAL') {
        // Ball locked to target pocket
        const currentTargetAbsAngle = rotorAngle.current + targetPocketAngle.current;
        ballAngle.current = currentTargetAbsAngle;
        ballRadius.current = 1.88;
        ballHeight.current = 0.22;
      }

      // Position Ball
      if (ballMeshRef.current) {
        ballMeshRef.current.position.x = Math.cos(ballAngle.current) * ballRadius.current;
        ballMeshRef.current.position.z = Math.sin(ballAngle.current) * ballRadius.current;
        ballMeshRef.current.position.y = ballHeight.current;
      }

      renderer.render(scene, camera);
      animFrameId.current = requestAnimationFrame(animate);
    };

    animFrameId.current = requestAnimationFrame(animate);

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [rules, numPockets, currentSpinDirection]);

  // Handle Spin Request
  const handleStartSpin = async () => {
    if (isSpinning) return;

    const result = await triggerSpin();
    if (!result) return;

    activeSpinResult.current = result;

    if (fastMode) {
      // 200ms instantaneous resolution
      setRevealData(result);
      setTimeout(() => {
        finalizeSpin(result);
        setRevealData(null);
      }, 250);
      return;
    }

    // Calculate angle for landed pocket
    const pocketIdx = seq.findIndex(p => String(p) === String(result.pocketNumber));
    const targetAngle = (pocketIdx / numPockets) * Math.PI * 2;
    targetPocketAngle.current = targetAngle;

    // Trigger Launch Physics
    physicsState.current = 'LAUNCH';
  };

  const lastHandledSpinReq = useRef(spinRequestId);
  useEffect(() => {
    if (spinRequestId > lastHandledSpinReq.current) {
      lastHandledSpinReq.current = spinRequestId;
      handleStartSpin();
    }
  }, [spinRequestId]);

  return (
    <div className="relative w-full h-[340px] md:h-[380px] bg-gradient-to-b from-[#030705] to-[#07120c] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex items-center justify-center">
      {/* 3D Canvas Mount */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Spin Button Overlay */}
      {!isSpinning && (
        <button
          onClick={handleStartSpin}
          className="absolute bottom-4 z-20 px-8 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-black font-extrabold text-lg tracking-wider uppercase rounded-full shadow-[0_0_25px_rgba(0,255,135,0.4)] transition-all transform active:scale-95"
        >
          Spin Wheel
        </button>
      )}

      {/* Rotation Mode Indicator Badge */}
      <div className="absolute top-3 left-4 z-10 px-3 py-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-xs font-mono text-emerald-400 flex items-center space-x-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>Rotation: {rotationMode.toUpperCase()} ({currentSpinDirection.toUpperCase()})</span>
      </div>

      {/* Center Winner Expansion Reveal Badge */}
      {revealData && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div
            className={`w-32 h-32 rounded-full flex flex-col items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.3)] border-4 border-white transform transition-transform animate-scale-up ${
              revealData.color === 'red'
                ? 'bg-[#d32027]'
                : revealData.color === 'black'
                ? 'bg-[#111417]'
                : 'bg-[#008f39]'
            }`}
          >
            <span className="text-white font-felt text-5xl font-black tracking-tight drop-shadow-lg">
              {revealData.pocketNumber}
            </span>
            <span className="text-white/80 font-mono text-xs uppercase tracking-widest mt-1">
              {revealData.color}
            </span>
          </div>

          <div
            className={`mt-4 px-6 py-2 rounded-xl text-lg font-extrabold shadow-lg backdrop-blur-md ${
              revealData.netWin > 0
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-red-500/20 text-red-400 border border-red-500/40'
            }`}
          >
            {revealData.netWin > 0 ? `+ $${revealData.netWin.toLocaleString()}` : `- $${Math.abs(revealData.netWin).toLocaleString()}`}
          </div>
        </div>
      )}
    </div>
  );
};
