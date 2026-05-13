'use client';

import { PlaybackScreen } from '@/components/automacc/PlaybackScreen';
import { consultcoEvidenceEnvelope } from '@/lib/automacc/fixture-evidence-map';

export default function PlaybackDemoPage() {
  return (
    <PlaybackScreen
      envelope={consultcoEvidenceEnvelope}
      onContinue={env => {
        // Stub handler. Real wiring to Stage 2 lands in D4.
        // eslint-disable-next-line no-console
        console.log('[playback-demo] continue clicked; confirmed envelope:', env);
      }}
      onBack={() => {
        // eslint-disable-next-line no-console
        console.log('[playback-demo] back clicked (stub)');
      }}
    />
  );
}
