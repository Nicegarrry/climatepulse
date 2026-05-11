export type LeverId = string;
export type SourceRowId = string;
export type AllocationId = string;

export type SourceRow = {
  rowId: SourceRowId;
  source: string;
  endUse: string | null;
  label: string;
  tco2eEstimate: number;
};

export type Lever = {
  leverId: LeverId;
  name: string;
  applicableTo: Array<{ source: string; endUse: string | null }>;
  typicalAbatementPct: number;
  capexAud: number;
  opexDeltaAudAnnual: number;
  sectorApplicability: string[];
  isEnabler: boolean;
  mutexPartners: LeverId[];
  evidence: { primarySource: string; primarySourceYear: number };
};

export type Allocation = {
  allocationId: AllocationId;
  leverId: LeverId;
  sourceRowIds: SourceRowId[];
  allocatedAt: string;
  isEnabler: boolean;
};

export type MaccRow = {
  rank: number;
  leverId: LeverId;
  leverName: string;
  costPerTco2e: number;
  tco2eAbatedAnnual: number;
  tco2eAbatedHorizon: number;
  cumulativeTco2eAbated: number;
  capexAud: number;
  opexDeltaAudAnnual: number;
  npvAud: number;
  zone: 'do_now' | 'at_carbon_price' | 'strategic';
  addressesRows: SourceRowId[];
  sensitivity: { base: number; energyHigh: number; capexHigh: number; zoneStable: boolean };
};

export type MaccPackage = {
  maccData: MaccRow[];
  top3Ids: LeverId[];
  totalAbatement: number;
};

export type SessionContext = {
  discountRate: number;
  horizonYears: number;
  carbonCeilingAud: number;
  orgSector: string;
};

export type Fixture = {
  orgName: string;
  orgSector: string;
  baselineRows: SourceRow[];
  levers: Lever[];
};
