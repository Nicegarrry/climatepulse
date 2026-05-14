'use client';

import { useState } from 'react';
import type { Fixture } from '@/lib/automacc/types';
import type { IntakePath } from '../OnboardingScreen';
import { ChatbotIntake } from './ChatbotIntake';
import { ManualIntake } from './ManualIntake';
import { UploadIntake } from './UploadIntake';

type Props = {
  initialPath: IntakePath;
  onComplete: (fixture: Fixture) => void;
  onBack: () => void;
};

const TABS: { id: IntakePath; label: string }[] = [
  { id: 'chatbot', label: 'Answer a few questions' },
  { id: 'manual', label: 'Fill in a form' },
  { id: 'upload', label: 'Upload your bills' },
];

const HEADLINE: Record<IntakePath, { title: string; sub: string }> = {
  chatbot: { title: 'Tell me about your business.', sub: 'Five to eight short questions.' },
  manual: { title: 'Fill in a form.', sub: 'Type your annual volumes by source.' },
  upload: { title: 'Upload your bills.', sub: 'We read the volumes; you confirm each one.' },
};

export function IntakeRouter({ initialPath, onComplete, onBack }: Props) {
  const [path, setPath] = useState<IntakePath>(initialPath);
  const head = HEADLINE[path];

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex flex-col">
      <div className="px-6 py-4 bg-white border-b border-[var(--color-border-light)] flex items-center gap-6">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink-sec)]"
        >
          ← Back
        </button>
        <div role="tablist" className="flex items-center gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={path === t.id}
              type="button"
              onClick={() => setPath(t.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                path === t.id
                  ? 'bg-[var(--color-ink)] text-white'
                  : 'text-[var(--color-ink-sec)] hover:bg-[var(--color-sage-tint)] hover:text-[var(--color-ink)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="ml-auto text-[11px] text-[var(--color-ink-muted)] hidden sm:block">
          You can switch paths at any time. Your answers carry across.
        </p>
      </div>

      <div className="flex-1 py-12 px-4">
        <div className="w-full max-w-3xl mx-auto mb-8">
          <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)] mb-1">
            AutoMACC v3
          </div>
          <h1 className="text-2xl font-display text-[var(--color-ink)]">{head.title}</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-sec)]">{head.sub}</p>
        </div>

        {path === 'chatbot' && (
          <ChatbotIntake orgName="My business" onComplete={onComplete} onAbort={onBack} />
        )}
        {path === 'manual' && <ManualIntake onComplete={onComplete} />}
        {path === 'upload' && <UploadIntake onComplete={onComplete} />}
      </div>
    </div>
  );
}
