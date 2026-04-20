"use client";

/**
 * QuizRunner — lightweight per-surface quiz, rendered from
 * overlay.custom_quizzes. No server scoring in Phase 4; clicking "Check"
 * just highlights the correct answers and tallies the local score.
 */
import { useState } from "react";
import { CheckIcon } from "@heroicons/react/24/outline";
import { COLORS, FONTS } from "@/lib/design-tokens";

interface Quiz {
  id: string;
  title: string;
  questions: Array<{
    prompt: string;
    answers: string[];
    correct_index: number;
  }>;
}

export function QuizRunner({ quiz }: { quiz: Quiz }) {
  const [selected, setSelected] = useState<Record<number, number | null>>({});
  const [checked, setChecked] = useState(false);

  const score = checked
    ? quiz.questions.reduce(
        (acc, q, i) => (selected[i] === q.correct_index ? acc + 1 : acc),
        0,
      )
    : null;

  return (
    <article
      style={{
        border: `1px solid ${COLORS.border}`,
        background: COLORS.surface,
        padding: "20px 20px 16px",
        marginBottom: 20,
      }}
    >
      <h3
        style={{
          fontFamily: FONTS.serif,
          fontSize: 20,
          margin: "0 0 12px",
          fontWeight: 500,
          color: COLORS.ink,
        }}
      >
        {quiz.title}
      </h3>
      <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {quiz.questions.map((q, qi) => (
          <li
            key={qi}
            style={{
              padding: "14px 0",
              borderTop: qi === 0 ? "none" : `1px solid ${COLORS.borderLight}`,
            }}
          >
            <div
              style={{
                fontFamily: FONTS.serif,
                fontSize: 16,
                lineHeight: 1.45,
                color: COLORS.ink,
                marginBottom: 10,
              }}
            >
              {qi + 1}. {q.prompt}
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {q.answers.map((ans, ai) => {
                const isSelected = selected[qi] === ai;
                const isCorrect = checked && ai === q.correct_index;
                const isWrongSelected =
                  checked && isSelected && ai !== q.correct_index;
                const border = isCorrect
                  ? `1px solid ${COLORS.forest}`
                  : isWrongSelected
                  ? `1px solid ${COLORS.plum}`
                  : `1px solid ${COLORS.border}`;
                return (
                  <li key={ai} style={{ marginBottom: 6 }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 12px",
                        border,
                        cursor: "pointer",
                        background: isCorrect
                          ? COLORS.sageTint
                          : isWrongSelected
                          ? COLORS.plumLight
                          : COLORS.surface,
                        fontFamily: FONTS.sans,
                        fontSize: 14,
                        color: COLORS.ink,
                      }}
                    >
                      <input
                        type="radio"
                        name={`${quiz.id}:${qi}`}
                        checked={isSelected}
                        onChange={() =>
                          setSelected((s) => ({ ...s, [qi]: ai }))
                        }
                        style={{ accentColor: COLORS.forest }}
                      />
                      <span style={{ flex: 1 }}>{ans}</span>
                      {isCorrect && (
                        <CheckIcon
                          width={14}
                          height={14}
                          strokeWidth={2}
                          style={{ color: COLORS.forest }}
                        />
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginTop: 12,
          paddingTop: 12,
          borderTop: `1px solid ${COLORS.border}`,
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (checked) {
              setChecked(false);
              setSelected({});
            } else {
              setChecked(true);
            }
          }}
          style={{
            fontFamily: FONTS.sans,
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "8px 14px",
            border: `1px solid ${COLORS.forest}`,
            background: checked ? COLORS.surface : COLORS.forest,
            color: checked ? COLORS.forest : COLORS.surface,
            cursor: "pointer",
          }}
        >
          {checked ? "Reset" : "Check answers"}
        </button>
        {score !== null && (
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: 12,
              color: COLORS.inkSec,
              letterSpacing: "0.04em",
            }}
          >
            Score: {score} / {quiz.questions.length}
          </div>
        )}
      </div>
    </article>
  );
}
