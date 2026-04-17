"use client";

import { useEffect, useState, useCallback } from "react";
import { COLORS, FONTS } from "@/lib/design-tokens";
import { X } from "lucide-react";

type QuestionType = "scale" | "freeform" | "most_relevant";

const STORAGE_KEY = "cp_feedback_prompt_last_shown";
const SHOW_DELAY_MS = 2 * 60 * 1000;

export function DailyFeedbackPrompt({
  storyOptions,
}: {
  // Array of { id, headline } passed in from the briefing so the
  // "most_relevant" question can list today's stories.
  storyOptions?: { id: number | string; headline: string; url?: string }[];
}) {
  const [visible, setVisible] = useState(false);
  const [questionType, setQuestionType] = useState<QuestionType | null>(null);
  const [scaleValue, setScaleValue] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [selectedStory, setSelectedStory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    // Don't re-prompt on the same session/day if we've already shown it.
    const last = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const today = new Date().toISOString().slice(0, 10);
    if (last === today) return;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/feedback/daily");
        if (!res.ok) return;
        const data = (await res.json()) as {
          should_prompt?: boolean;
          question_type?: QuestionType;
        };
        if (data.should_prompt && data.question_type) {
          setQuestionType(data.question_type);
          setVisible(true);
          try {
            localStorage.setItem(STORAGE_KEY, today);
          } catch {
            /* no-op */
          }
        }
      } catch {
        /* swallow — the prompt is best-effort */
      }
    }, SHOW_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  const submit = useCallback(
    async (payload: { response?: unknown; dismissed?: boolean }) => {
      if (!questionType || submitting) return;
      setSubmitting(true);
      try {
        await fetch("/api/feedback/daily", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question_type: questionType,
            ...payload,
          }),
        });
        if (payload.dismissed) {
          setVisible(false);
        } else {
          setSubmitted(true);
          setTimeout(() => setVisible(false), 1400);
        }
      } catch {
        setVisible(false);
      } finally {
        setSubmitting(false);
      }
    },
    [questionType, submitting]
  );

  if (!visible || !questionType) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 50,
        width: 340,
        maxWidth: "calc(100vw - 40px)",
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderTop: `2px solid ${COLORS.plum}`,
        borderRadius: 8,
        padding: "16px 18px",
        boxShadow: "0 6px 24px rgba(0,0,0,0.08)",
        fontFamily: FONTS.sans,
      }}
      role="dialog"
      aria-label="Daily feedback"
    >
      <button
        type="button"
        onClick={() => submit({ dismissed: true })}
        aria-label="Dismiss"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: COLORS.inkFaint,
          padding: 4,
          lineHeight: 0,
        }}
      >
        <X size={14} />
      </button>

      {submitted ? (
        <div
          style={{
            fontSize: 13,
            color: COLORS.forest,
            padding: "8px 0",
            textAlign: "center",
          }}
        >
          Thanks — noted.
        </div>
      ) : (
        <>
          {questionType === "scale" && (
            <div>
              <div
                style={{
                  fontSize: 13,
                  color: COLORS.ink,
                  marginBottom: 12,
                  fontWeight: 500,
                }}
              >
                Was today&apos;s briefing useful?
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setScaleValue(n)}
                    style={{
                      width: 44,
                      height: 36,
                      borderRadius: 4,
                      border: `1px solid ${
                        scaleValue === n ? COLORS.plum : COLORS.border
                      }`,
                      background:
                        scaleValue === n ? "rgba(112,58,101,0.08)" : "transparent",
                      color: scaleValue === n ? COLORS.plum : COLORS.ink,
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 500,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 10,
                  color: COLORS.inkFaint,
                  marginBottom: 12,
                }}
              >
                <span>Not really</span>
                <span>Very useful</span>
              </div>
              <button
                type="button"
                disabled={scaleValue === null || submitting}
                onClick={() => submit({ response: { score: scaleValue } })}
                style={primaryButton(scaleValue !== null)}
              >
                Submit
              </button>
            </div>
          )}

          {questionType === "freeform" && (
            <div>
              <div
                style={{
                  fontSize: 13,
                  color: COLORS.ink,
                  marginBottom: 10,
                  fontWeight: 500,
                }}
              >
                Anything we missed today?
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="One line is fine."
                rows={3}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontSize: 13,
                  fontFamily: FONTS.sans,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 4,
                  resize: "vertical",
                  marginBottom: 10,
                  background: COLORS.paperDark,
                  color: COLORS.ink,
                }}
              />
              <button
                type="button"
                disabled={!text.trim() || submitting}
                onClick={() => submit({ response: { text: text.trim() } })}
                style={primaryButton(text.trim().length > 0)}
              >
                Send
              </button>
            </div>
          )}

          {questionType === "most_relevant" && (
            <div>
              <div
                style={{
                  fontSize: 13,
                  color: COLORS.ink,
                  marginBottom: 10,
                  fontWeight: 500,
                }}
              >
                Which story was most relevant?
              </div>
              {storyOptions && storyOptions.length > 0 ? (
                <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 10 }}>
                  {storyOptions.slice(0, 6).map((s) => {
                    const sid = String(s.id);
                    return (
                      <button
                        key={sid}
                        type="button"
                        onClick={() => setSelectedStory(sid)}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          padding: "8px 10px",
                          fontSize: 12,
                          border: `1px solid ${
                            selectedStory === sid ? COLORS.plum : COLORS.borderLight
                          }`,
                          background:
                            selectedStory === sid
                              ? "rgba(112,58,101,0.06)"
                              : "transparent",
                          borderRadius: 4,
                          marginBottom: 4,
                          cursor: "pointer",
                          color: COLORS.ink,
                          fontFamily: FONTS.serif,
                          lineHeight: 1.35,
                        }}
                      >
                        {s.headline}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: COLORS.inkFaint, marginBottom: 10 }}>
                  No stories available yet.
                </div>
              )}
              <button
                type="button"
                disabled={!selectedStory || submitting}
                onClick={() => {
                  const match = storyOptions?.find(
                    (s) => String(s.id) === selectedStory
                  );
                  submit({
                    response: { story_id: selectedStory, url: match?.url ?? null },
                  });
                }}
                style={primaryButton(!!selectedStory)}
              >
                Submit
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function primaryButton(enabled: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "8px 0",
    fontSize: 12,
    fontWeight: 600,
    color: "#fff",
    background: enabled ? COLORS.plum : `${COLORS.plum}55`,
    border: "none",
    borderRadius: 4,
    cursor: enabled ? "pointer" : "default",
    letterSpacing: "0.02em",
  };
}
