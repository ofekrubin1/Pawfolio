import { ImageResponse } from "next/og";

/** The app icon: white paw on teal. `pad` leaves room for maskable icons. */
export function pawIcon(size: number, { rounded = false, pad = 0.18 } = {}) {
  const inner = size * (1 - pad * 2);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f766e",
          borderRadius: rounded ? size * 0.22 : 0,
        }}
      >
        <svg width={inner} height={inner} viewBox="0 0 100 100">
          <ellipse cx="50" cy="66" rx="22" ry="19" fill="white" />
          <ellipse cx="22" cy="44" rx="9" ry="12" fill="white" transform="rotate(-20 22 44)" />
          <ellipse cx="78" cy="44" rx="9" ry="12" fill="white" transform="rotate(20 78 44)" />
          <ellipse cx="38" cy="24" rx="9" ry="12" fill="white" transform="rotate(-8 38 24)" />
          <ellipse cx="62" cy="24" rx="9" ry="12" fill="white" transform="rotate(8 62 24)" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
