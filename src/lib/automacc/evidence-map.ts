// AutoMACC v3 evidence-map envelope (subset for playback rendering).
// Spec: qubit S1-D1-A7-Q8. One unified envelope shape across the three
// intake paths (chatbot / manual / upload); `source` varies by path.

export type IntakePath = 'chatbot' | 'manual' | 'upload';
export type Confidence = 'H' | 'M' | 'L';

export type ChatbotSource = {
  path: 'chatbot';
  turnId: string;
  userAnswer: string;
  shape: 'structured_pick' | 'closed_banded' | 'open_numeric' | 'boolean' | 'fallback';
  bandLabel: string | null;
  midpointUsed: boolean;
  fallbackTriggered: boolean;
  turnsUsed: number;
};

export type ManualSource = {
  path: 'manual';
  fieldKey: string;
  section: string;
  rawValue: number | string;
  rawUnit: string;
  conversionApplied: string | null;
};

export type UploadSource = {
  path: 'upload';
  sourceDoc: 'electricity_bill' | 'gas_bill' | 'fleet_log' | 'annual_report';
  filenameDisplay: string;
  pageNo: number;
  sourceText: string;
  extractedValue: number | string;
  extractedUnit: string | null;
  transformApplied: string | null;
};

export type EvidenceSource = ChatbotSource | ManualSource | UploadSource;

export type FactorBlock = {
  name: string;
  value: number;
  unit: string;
  edition: string;
  publisher: string;
  appliesToField: string;
};

export type ComputedBlock = {
  volumeUser: number | null;
  volumeUserUnit: string | null;
  volumeCanonical: number;
  tco2eEstimate: number;
  formulaRendered: string;
};

export type EvidenceRow = {
  rowId: string;
  label: string;
  path: IntakePath;
  source: EvidenceSource;
  factor: FactorBlock;
  computed: ComputedBlock;
  confidence: Confidence;
  userConfirmed: boolean;
  userEdited: boolean;
};

export type EvidenceEnvelope = {
  orgName: string;
  orgSector: string;
  totalBaselineTco2e: number;
  rows: EvidenceRow[];
  meta: {
    engineVersion: string;
    factorsEdition: string;
    producedAt: string;
  };
};

// Path-specific source line per Q9 §5.3.
export function renderSourceLine(row: EvidenceRow): string {
  const s = row.source;
  if (s.path === 'chatbot') {
    if (s.fallbackTriggered) {
      return `Estimated from your sector and size band (turn ${s.turnId}).`;
    }
    return `You said on turn ${s.turnsUsed}: "${s.userAnswer}"`;
  }
  if (s.path === 'manual') {
    if (s.rawValue === '(skipped)') {
      return `You skipped this field. We imputed it from your sector default.`;
    }
    return `You typed in ${s.section}, "${s.fieldKey}": ${s.rawValue} ${s.rawUnit}`;
  }
  if (s.extractedValue === '(not found)') {
    return `Not found in ${s.filenameDisplay}. We imputed this from your sector default.`;
  }
  return `Read from ${s.filenameDisplay} page ${s.pageNo}: "${s.sourceText}"`;
}
