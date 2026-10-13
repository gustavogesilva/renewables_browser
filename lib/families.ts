// Technology families as stored in ref.technology.family, in display order.
// Colors: four validated categorical hues (yellow, blue, aqua, magenta) plus a neutral gray for "other".
export const FAMILIES = [
  { key: "solar", label: "Solar", color: "#eda100" },
  { key: "wind", label: "Wind", color: "#2a78d6" },
  { key: "hydro", label: "Hydro", color: "#1baf7a" },
  { key: "bio", label: "Bioenergy", color: "#e87ba4" },
  { key: "other", label: "Other", color: "#a3a29b" },
] as const;

export type FamilyKey = (typeof FAMILIES)[number]["key"];

export const FAMILY_KEYS: readonly string[] = FAMILIES.map((f) => f.key);

export function familyOf(key: string) {
  return FAMILIES.find((f) => f.key === key) ?? FAMILIES[FAMILIES.length - 1];
}
