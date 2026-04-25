// Shared Finn mascot — sourced from the Figma asset library, exported as
// /public/finn.png. Replaces the earlier CSS conic-gradient + SVG smile
// recreation so every screen shows the exact illustration the designer made.

type Props = {
  /** Diameter in pixels. Defaults to 80, matching the in-flow stages. */
  size?: number;
  className?: string;
};

export default function FinnAvatar({ size = 80, className }: Props) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/finn.png"
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "contain" }}
      aria-hidden
    />
  );
}
