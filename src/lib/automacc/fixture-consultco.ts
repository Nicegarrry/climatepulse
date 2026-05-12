import type { Fixture } from './types';
import { getLeversForFixture } from './lever-db';

const baselineRows: Fixture['baselineRows'] = [
  { rowId: 'R1', source: 'electricity', endUse: 'lighting_hvac', label: 'Electricity — lighting & HVAC', tco2eEstimate: 142 },
  { rowId: 'R2', source: 'electricity', endUse: 'office_equipment', label: 'Electricity — office equipment', tco2eEstimate: 86 },
  { rowId: 'R3', source: 'electricity', endUse: 'datacentre', label: 'Electricity — data centre', tco2eEstimate: 218 },
  { rowId: 'R4', source: 'stationary_combustion', endUse: 'space_heating', label: 'Gas — space heating', tco2eEstimate: 64 },
  { rowId: 'R5', source: 'mobile_combustion', endUse: 'fleet', label: 'Fleet — petrol & diesel', tco2eEstimate: 38 },
  { rowId: 'R6', source: 'mobile_combustion', endUse: 'business_travel', label: 'Air travel — staff', tco2eEstimate: 312 },
];

export const consultcoFixture: Fixture = {
  orgName: 'ConsultCo',
  orgSector: 'professional_services',
  baselineRows,
  levers: getLeversForFixture(
    'professional_services',
    baselineRows.map(r => ({ source: r.source, endUse: r.endUse })),
  ),
};
