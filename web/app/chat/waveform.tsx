"use client";

import { useEffect, useRef } from "react";

type WaveformProps = {
  /** The active mic stream. Null = idle (flat low bars). */
  stream: MediaStream | null;
  /** Number of bars rendered. Default 28. */
  bars?: number;
  /** Tailwind class controlling bar fill. */
  barClassName?: string;
};

/**
 * Audio-reactive waveform powered by a Web Audio AnalyserNode.
 * Bars animate from 6% min height up to ~95% based on the mic frequency
 * spectrum. When `stream` is null we just show flat low bars.
 */
export default function Waveform({
  stream,
  bars = 28,
  barClassName = "bg-[var(--accent-contrast)]/80",
}: WaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    if (!stream) {
      // Reset bars to baseline.
      if (containerRef.current) {
        for (const el of Array.from(containerRef.current.children)) {
          (el as HTMLElement).style.height = "12%";
        }
      }
      return;
    }

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    sourceRef.current = source;

    const data = new Uint8Array(analyser.frequencyBinCount);
    // Take an even slice of the lower-mid spectrum (where speech lives).
    const start = 2;
    const end = Math.min(data.length, start + bars * 2);
    const step = Math.max(1, Math.floor((end - start) / bars));

    const draw = () => {
      analyser.getByteFrequencyData(data);
      if (containerRef.current) {
        const children = containerRef.current.children;
        for (let i = 0; i < bars; i++) {
          const v = data[start + i * step] ?? 0;
          // Curve: emphasise mid-range so quiet talking still moves.
          const norm = Math.pow(v / 255, 0.7);
          const height = Math.max(8, Math.min(95, norm * 100));
          (children[i] as HTMLElement).style.height = `${height}%`;
        }
      }
      animationRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      try {
        source.disconnect();
      } catch {
        /* ignore */
      }
      try {
        audioContext.close();
      } catch {
        /* ignore */
      }
      animationRef.current = null;
      audioContextRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
    };
  }, [stream, bars]);

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center gap-[3px] h-10 w-full"
      aria-hidden
    >
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={`${barClassName} flex-1 rounded-full transition-[height] duration-75 ease-out`}
          style={{ height: "12%" }}
        />
      ))}
    </div>
  );
}
