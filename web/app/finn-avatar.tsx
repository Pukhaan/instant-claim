// Shared Finn mascot. The designer ships several emotional variants — each
// stage picks the one that fits its tone. Files live in /public/finn/* and
// are downloaded straight from the Figma file. Falling back to the default
// /finn.png if a variant file is missing keeps the page from showing a
// broken image while assets are being staged.

export type FinnMood =
  | "default"
  | "intro"        // chart-rich, used on bunq home Your Travel
  | "happy"        // greeting + decisions, soft smile
  | "thinking"     // asking a question, finger-on-chin pose
  | "surprised"    // listening, eyes wide + small "o"
  | "celebrating"; // approved payout, big crescent smile

const SRC: Record<FinnMood, string> = {
  default: "/finn.png",
  intro: "/finn/intro.png",
  happy: "/finn/happy.png",
  thinking: "/finn/thinking.png",
  surprised: "/finn/surprised.png",
  celebrating: "/finn/celebrating.png",
};

type Props = {
  /** Diameter in pixels. Defaults to 80, matching the in-flow stages. */
  size?: number;
  /** Pick the emotion appropriate to the moment. Defaults to `default`. */
  mood?: FinnMood;
  className?: string;
};

export default function FinnAvatar({
  size = 80,
  mood = "default",
  className,
}: Props) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={SRC[mood]}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "contain" }}
      aria-hidden
      // If a variant PNG isn't on disk yet, fall back to the canonical Finn
      // so the screen still looks finished while assets are being staged.
      onError={(e) => {
        const el = e.currentTarget;
        if (el.src.endsWith("/finn.png")) return;
        el.src = "/finn.png";
      }}
    />
  );
}
