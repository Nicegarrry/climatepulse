import type { Fixture, SourceRow } from './types';
import { getLeversForFixture } from './lever-db';

export type EmissionCategoryKey = string;

export type EmissionCategory = {
  key: EmissionCategoryKey;
  label: string;
  source: string;
  endUse: string | null;
  group: string;
};

export const EMISSION_CATEGORIES: EmissionCategory[] = [
  // ── Electricity (Scope 2) ──────────────────────────────────────────
  { key: 'elec_lighting_hvac', label: 'Electricity — HVAC & lighting', source: 'electricity', endUse: 'lighting_hvac', group: 'Electricity' },
  { key: 'elec_office', label: 'Electricity — office equipment', source: 'electricity', endUse: 'office_equipment', group: 'Electricity' },
  { key: 'elec_data', label: 'Electricity — data centre / servers', source: 'electricity', endUse: 'data', group: 'Electricity' },
  { key: 'elec_general', label: 'Electricity — general use', source: 'electricity', endUse: null, group: 'Electricity' },
  { key: 'elec_steel', label: 'Electricity — steel manufacturing', source: 'electricity', endUse: 'steel_manufacturing', group: 'Electricity' },
  { key: 'elec_aluminium', label: 'Electricity — aluminium smelting', source: 'electricity', endUse: 'aluminium_smelting', group: 'Electricity' },
  { key: 'elec_mining', label: 'Electricity — mining operations', source: 'electricity', endUse: 'mining', group: 'Electricity' },

  // ── Stationary combustion / Gas (Scope 1) ─────────────────────────
  { key: 'gas_space_heating', label: 'Natural gas — space heating', source: 'stationary_combustion', endUse: 'space_heating', group: 'Combustion' },
  { key: 'gas_hvac', label: 'Natural gas — process HVAC', source: 'stationary_combustion', endUse: 'hvac', group: 'Combustion' },
  { key: 'gas_general', label: 'Stationary combustion — general', source: 'stationary_combustion', endUse: null, group: 'Combustion' },
  { key: 'gas_cement', label: 'Combustion — cement manufacturing', source: 'stationary_combustion', endUse: 'cement_manufacturing', group: 'Combustion' },
  { key: 'gas_steel', label: 'Combustion — steel manufacturing', source: 'stationary_combustion', endUse: 'steel_manufacturing', group: 'Combustion' },
  { key: 'gas_ammonia', label: 'Gas — ammonia production', source: 'stationary_combustion', endUse: 'ammonia_production', group: 'Combustion' },
  { key: 'gas_petrochem', label: 'Gas — petrochemical manufacturing', source: 'stationary_combustion', endUse: 'petrochemical_manufacturing', group: 'Combustion' },

  // ── Mobile combustion / Transport (Scope 1) ───────────────────────
  { key: 'fleet_light', label: 'Fleet — light vehicles (cars / utes)', source: 'mobile_combustion', endUse: 'fleet_light_vehicles', group: 'Transport' },
  { key: 'fleet_heavy', label: 'Fleet — heavy vehicles (trucks)', source: 'mobile_combustion', endUse: 'fleet_heavy_vehicles', group: 'Transport' },
  { key: 'fleet_mixed', label: 'Fleet — mixed vehicle types', source: 'mobile_combustion', endUse: 'fleet', group: 'Transport' },
  { key: 'air_travel', label: 'Air travel — staff', source: 'mobile_combustion', endUse: 'business_travel', group: 'Transport' },
  { key: 'freight', label: 'Freight transport', source: 'mobile_combustion', endUse: 'freight_transport', group: 'Transport' },
  { key: 'passenger_transport', label: 'Passenger transport services', source: 'mobile_combustion', endUse: 'passenger_transport', group: 'Transport' },
  { key: 'mining_haulage', label: 'Mining — haulage', source: 'mobile_combustion', endUse: 'mining_haulage', group: 'Transport' },

  // ── Process emissions (Scope 1) ───────────────────────────────────
  { key: 'process_cement', label: 'Process — cement clinker', source: 'process', endUse: 'cement_clinker', group: 'Process' },
  { key: 'process_steel', label: 'Process — steel / ironmaking', source: 'process', endUse: 'ironmaking', group: 'Process' },
  { key: 'process_aluminium', label: 'Process — aluminium smelting', source: 'process', endUse: 'aluminium_smelting', group: 'Process' },
  { key: 'process_construction', label: 'Process — construction materials', source: 'process', endUse: 'construction_materials', group: 'Process' },

  // ── Fugitive (Scope 1) ────────────────────────────────────────────
  { key: 'fugitive_coal', label: 'Fugitive — coal mine methane', source: 'fugitive', endUse: 'coal_mine_methane', group: 'Fugitive' },
];

export type SectorOption = { key: string; label: string };

export const SECTOR_OPTIONS: SectorOption[] = [
  { key: 'professional_services', label: 'Professional services / consulting' },
  { key: 'finance', label: 'Finance & banking' },
  { key: 'retail', label: 'Retail' },
  { key: 'warehouse', label: 'Warehousing & distribution' },
  { key: 'transport', label: 'Transport operations' },
  { key: 'industrial', label: 'Manufacturing / industrial' },
  { key: 'construction', label: 'Construction' },
  { key: 'mining', label: 'Mining & resources' },
  { key: 'power', label: 'Power & energy generation' },
  { key: 'agriculture', label: 'Agriculture & food production' },
  { key: 'waste', label: 'Waste management' },
  { key: 'built_environment', label: 'Property / facilities management' },
  { key: 'services', label: 'Other services' },
];

export type IntakeRow = {
  id: string;
  categoryKey: EmissionCategoryKey;
  tco2eEstimate: number;
  labelOverride?: string;
};

export type IntakeFormData = {
  orgName: string;
  orgSector: string;
  rows: IntakeRow[];
};

export function buildFixture(data: IntakeFormData): Fixture {
  const categoryMap = new Map(EMISSION_CATEGORIES.map(c => [c.key, c]));
  const baselineRows: SourceRow[] = data.rows
    .filter(r => r.categoryKey && r.tco2eEstimate > 0)
    .map((r, i) => {
      const cat = categoryMap.get(r.categoryKey)!;
      return {
        rowId: `R${i + 1}`,
        source: cat.source,
        endUse: cat.endUse,
        label: r.labelOverride?.trim() || cat.label,
        tco2eEstimate: r.tco2eEstimate,
      };
    });

  return {
    orgName: data.orgName,
    orgSector: data.orgSector,
    baselineRows,
    levers: getLeversForFixture(
      data.orgSector,
      baselineRows.map(r => ({ source: r.source, endUse: r.endUse })),
    ),
  };
}
