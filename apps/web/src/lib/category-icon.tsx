import {
  CarIcon,
  FirstAidKitIcon,
  ForkKnifeIcon,
  GasPumpIcon,
  HouseIcon,
  MusicNoteIcon,
  ShoppingCartIcon,
  TagIcon,
} from "@phosphor-icons/react/ssr";

export function categoryIcon(label: string) {
  const l = label.toLowerCase();
  if (l.includes("arriendo") || l.includes("hogar")) return HouseIcon;
  if (l.includes("super")) return ShoppingCartIcon;
  if (l.includes("transporte") || l.includes("uber")) return CarIcon;
  if (l.includes("bencina") || l.includes("tag")) return GasPumpIcon;
  if (l.includes("comida") || l.includes("restaur")) return ForkKnifeIcon;
  if (l.includes("salud")) return FirstAidKitIcon;
  if (l.includes("entreten") || l.includes("suscrip")) return MusicNoteIcon;
  return TagIcon;
}
