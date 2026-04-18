"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface FAQItem {
  q: string;
  a: string;
}

const ITEMS: FAQItem[] = [
  {
    q: "When does it arrive?",
    a: "Every morning before 6am AEST, seven days a week.",
  },
  {
    q: "What sources do you cover?",
    a: "Australian regulators and policy bodies (DCCEEW, AEMO, AER, CER, state equivalents), utilities, industry associations, trade press (RenewEconomy, pv magazine Australia, etc.), major mastheads, research institutions, and select international sources that affect Australian markets. Full list available on request.",
  },
  {
    q: "How does personalisation work?",
    a: "You pick sectors and topics during onboarding. Significance scoring gets boosted for your areas. The system refines over time based on what you open and read.",
  },
  {
    q: "What does it cost?",
    a: "Early access is free while we shape the product. Paid tiers will be introduced later — early access users will get preferential pricing.",
  },
  {
    q: "Is my data private?",
    a: "Yes. Your personalisation choices and engagement data are never shared or sold. Email delivery is via Resend over a custom domain.",
  },
  {
    q: "Who's behind it?",
    a: "A solo operator with a background in Australian energy strategy consulting. More on the About page.",
  },
];

export function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div className="divide-y divide-[#E8E5E0]">
      {ITEMS.map((item, idx) => {
        const isOpen = openIdx === idx;
        return (
          <div key={item.q}>
            <button
              type="button"
              onClick={() => setOpenIdx(isOpen ? null : idx)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:bg-[#F5F3F0]/50"
            >
              <span
                className="font-serif text-[17px] leading-snug text-[#1A1A1A] sm:text-[19px]"
                style={{ fontFamily: "'Crimson Pro', Georgia, serif", fontWeight: 500 }}
              >
                {item.q}
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-[#8C8C8C] transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {isOpen && (
              <div
                className="pb-6 text-[15px] leading-relaxed text-[#5C5C5C] sm:text-[16px]"
                style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
              >
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
