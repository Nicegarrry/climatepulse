'use client';

import {
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline';

export type IntakePath = 'chatbot' | 'manual' | 'upload';

type Props = {
  onPick: (path: IntakePath) => void;
  onSkipToDemo: () => void;
};

const BULLETS = [
  'Answer five to eight short questions about your business',
  'Type your numbers into a structured form, with units you can pick',
  'Drop in an electricity bill, gas bill, fleet statement, or annual report',
  'See the factor applied, the arithmetic, and the source on every line',
  'Edit or remove any line before you continue to lever recommendations',
];

const TILES: {
  id: IntakePath;
  title: string;
  description: string;
  Icon: typeof ChatBubbleLeftRightIcon;
}[] = [
  {
    id: 'chatbot',
    title: 'Answer a few questions',
    description:
      "A short structured chat. Best if you don't have bills handy and want a directional estimate.",
    Icon: ChatBubbleLeftRightIcon,
  },
  {
    id: 'manual',
    title: 'Fill in a form',
    description:
      'Type your annual volumes into a structured form. Best if you know your numbers and want exact control.',
    Icon: DocumentTextIcon,
  },
  {
    id: 'upload',
    title: 'Upload your bills',
    description:
      'Drop in a PDF or photo. We read the volumes, you confirm each one. Best if you have your bills.',
    Icon: ArrowUpTrayIcon,
  },
];

export function OnboardingScreen({ onPick, onSkipToDemo }: Props) {
  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-start justify-center py-16 px-4">
      <div className="w-full max-w-3xl space-y-10">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)] mb-2">
            AutoMACC v3
          </div>
          <h1 className="text-3xl font-display text-[var(--color-ink)]">
            Estimate your business carbon footprint.
          </h1>
          <p className="mt-3 text-base text-[var(--color-ink-sec)]">
            Three ways in. Pick the one that fits the records you actually have.
          </p>
        </div>

        <p className="text-sm leading-relaxed text-[var(--color-ink)] max-w-2xl">
          AutoMACC asks for the numbers behind your operations - power, gas, fuel, refrigerant, waste -
          and converts them into tonnes of CO2-e using the 2025 NGER factors published by DCCEEW. You
          see every calculation before it commits. You can correct any line. Nothing leaves your
          browser without you accepting it first.
        </p>

        <section className="space-y-3">
          <h2 className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)]">
            What you can do on the next screen
          </h2>
          <ul className="space-y-1.5">
            {BULLETS.map((b, i) => (
              <li key={i} className="flex gap-3 text-sm text-[var(--color-ink)]">
                <span className="text-[var(--color-forest-mid)] mt-0.5">·</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)]">
            Pick a path
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {TILES.map(({ id, title, description, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => onPick(id)}
                className="text-left p-5 rounded-md border border-[var(--color-border-light)] bg-white hover:border-[var(--color-forest-mid)] hover:bg-[var(--color-sage-tint)] transition-colors group"
              >
                <Icon className="w-5 h-5 text-[var(--color-forest)] mb-3" />
                <div className="text-sm font-medium text-[var(--color-ink)] mb-1.5">{title}</div>
                <p className="text-xs leading-relaxed text-[var(--color-ink-sec)]">{description}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--color-ink-muted)] pt-1">
            You can switch paths at any time. Your answers carry across.
          </p>
        </section>

        <div className="pt-2">
          <button
            type="button"
            onClick={onSkipToDemo}
            className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-forest)] underline underline-offset-4 decoration-dotted"
          >
            Show me what a finished estimate looks like first.
          </button>
        </div>
      </div>
    </div>
  );
}
