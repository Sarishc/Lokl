import type { ComponentType } from 'react';
import { Armchair, Baby, BadgeCheck, Bike, BookOpen, BriefcaseBusiness, Building2, Car, Check, Circle, Dumbbell, Gamepad2, Lamp, Laptop, MessageCircle, PawPrint, Refrigerator, Shirt, SlidersHorizontal, Smartphone, Sparkles, Tag, Wrench } from 'lucide-react';

export type ChipIcon = ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;

const categoryIcons: Record<string, ChipIcon> = {
  Mobiles: Smartphone,
  Furniture: Armchair,
  Electronics: Laptop,
  Bikes: Bike,
  Fashion: Shirt,
  Books: BookOpen,
  'Home Decor': Lamp,
  Appliances: Refrigerator,
  Jobs: BriefcaseBusiness,
  Services: Wrench,
  Sports: Dumbbell,
  Pets: PawPrint,
  Kids: Baby,
  Gaming: Gamepad2,
  Cars: Car,
  Property: Building2,
};

const conditionIcons: Record<string, ChipIcon> = {
  New: Sparkles,
  'Like New': BadgeCheck,
  Good: Check,
  Fair: Circle,
};

const presetIcons: Record<string, ChipIcon> = {
  All: SlidersHorizontal,
  Free: Tag,
  Urgent: Sparkles,
  Negotiable: MessageCircle,
};

export function categoryIconFor(category: string) {
  return categoryIcons[category] ?? Tag;
}

export function conditionIconFor(condition: string) {
  return conditionIcons[condition] ?? Circle;
}

export function chipIconForLabel(label: React.ReactNode): ChipIcon | undefined {
  if (typeof label !== 'string') return undefined;
  return categoryIcons[label] ?? conditionIcons[label] ?? presetIcons[label] ?? Tag;
}
