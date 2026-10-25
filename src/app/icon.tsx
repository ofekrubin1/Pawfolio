import { pawIcon } from "@/lib/og/icon";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return pawIcon(64, { rounded: true, pad: 0.12 });
}
