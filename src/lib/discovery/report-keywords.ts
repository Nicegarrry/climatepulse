/**
 * Keywords that indicate a major report. If any keyword appears in an article
 * title (case-insensitive), the article is flagged as is_major_report = true.
 */
export const REPORT_KEYWORDS: string[] = [
  "World Energy Outlook",
  "Global Renewables",
  "Tracking Clean Energy",
  "Energy Technology Perspectives",
  "Global Status Report",
  "Renewables Global Status",
  "Global Energy Review",
  "Net Zero Roadmap",
  "Power Sector Transformation",
  "Renewable Capacity Statistics",
  "World Energy Transitions",
  "Global Hydrogen Review",
  "Critical Minerals",
  "Global EV Outlook",
  "Electricity Market Report",
];

/**
 * Check if a title matches any major report keyword.
 */
export function isMajorReport(title: string): boolean {
  const lowerTitle = title.toLowerCase();
  return REPORT_KEYWORDS.some((kw) => lowerTitle.includes(kw.toLowerCase()));
}
