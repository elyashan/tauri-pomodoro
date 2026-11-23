import type { BioEventType } from "../db";
import { IconCoffee, IconPill, IconSun, IconUtensils } from "./Icons";

export function renderBioIcon(evType: BioEventType, size = 12) {
  switch (evType) {
    case "wake":
      return <IconSun size={size} />;
    case "coffee":
      return <IconCoffee size={size} />;
    case "meds":
      return <IconPill size={size} />;
    case "meal":
      return <IconUtensils size={size} />;
  }
}
