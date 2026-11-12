"use client";

import { useEffect, useRef, useState } from "react";

type SauceVideoLabels = { video: string; soundOn: string; soundOff: string };

/** Hochformat-Clip, läuft stumm in Schleife. Ton per Knopf; bei "weniger Bewegung" startet er nicht von selbst. */
export function SauceVideo({ src, poster, labels }: { src: string; poster: string; labels: SauceVideoLabels }) {
  const video = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const el = video.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.play().catch(() => {});
  }, []);

  function toggleSound() {
    const el = video.current;
    if (!el) return;
    el.muted = !muted;
    setMuted(!muted);
    if (el.paused) el.play().catch(() => {});
  }

  return (
    <figure className="sauce-video">
      <video ref={video} src={src} poster={poster} muted loop playsInline preload="metadata" aria-label={labels.video} />
      <button type="button" className="sauce-sound" onClick={toggleSound} aria-pressed={!muted}>
        {muted ? `🔊 ${labels.soundOn}` : `🔇 ${labels.soundOff}`}
      </button>
    </figure>
  );
}
