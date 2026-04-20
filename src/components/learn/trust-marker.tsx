export function TrustMarker({ label = "EDITOR REVIEWED" }: { label?: string }) {
  return (
    <span className="trust" title="Editor reviewed">
      <span className="tick" />
      <span>{label}</span>
    </span>
  );
}

export function AITag({ label = "AI DRAFT · UNREVIEWED" }: { label?: string }) {
  return (
    <span className="ai-tag" title="AI drafted">
      <span className="square" />
      <span>{label}</span>
    </span>
  );
}
