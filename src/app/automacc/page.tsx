import { MaccWorkbench } from "@/components/automacc/v4/MaccWorkbench";

export const metadata = {
  title: "AutoMACC v4 (Demo)",
};

export default function AutomaccPage() {
  return (
    <>
      {/* AutoMACC is an open demo (no login required). Make that unmistakable. */}
      <div
        style={{
          background: "#1E4D2B",
          color: "#FFFFFF",
          textAlign: "center",
          fontFamily: "'Source Sans 3', system-ui, sans-serif",
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          padding: "9px 14px",
        }}
      >
        Demo only — illustrative figures, not investment advice
      </div>
      <MaccWorkbench />
    </>
  );
}
