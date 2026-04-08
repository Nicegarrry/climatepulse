import {
  Zap,
  Battery,
  Network,
  Cloud,
  Car,
  Factory,
  Sprout,
  Building,
  Gem,
  Coins,
  Scale,
  Users,
  TrendingUp,
  Building2,
  Landmark,
  Wrench,
  Shield,
  Microscope,
  Globe,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const DOMAIN_ICONS: Record<string, LucideIcon> = {
  "energy-generation": Zap,
  "energy-storage": Battery,
  "energy-grid": Network,
  "carbon-emissions": Cloud,
  transport: Car,
  industry: Factory,
  agriculture: Sprout,
  "built-environment": Building,
  "critical-minerals": Gem,
  finance: Coins,
  policy: Scale,
  "workforce-adaptation": Users,
};

export const ROLE_ICONS: Record<string, LucideIcon> = {
  investor: TrendingUp,
  corporate_sustainability: Building2,
  policy_analyst: Landmark,
  project_developer: Wrench,
  board_director: Shield,
  researcher: Microscope,
  general: Globe,
};
