import { useState } from 'preact/hooks';

type Props = { src: string | null; size: number; label?: string };

/** MGA photo, or a plain placeholder when there is none or it fails to load. */
export function Photo({ src, size, label = 'No photo' }: Props) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span class="no-photo">{label}</span>;
  return <img src={src} alt="" loading="lazy" width={size} height={size} onError={() => setFailed(true)} />;
}
