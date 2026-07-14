import { jsPDF } from "jspdf";
import type { AnalysisRecord, LandCover, Recommendation } from "./types";
import { LAND_COVER_META } from "./types";
import { classifyFloodRisk, riskLabel } from "./absorption";
import {
  INTERVENTIONS,
  INTERVENTION_ORDER,
  formatCompactUSD,
  formatVolumeM3,
  type ScenarioExport,
} from "./scenario";

interface PDFExportOptions {
  includeMapImage?: boolean;
  /** When set, appends a Scenario & Investment Analysis section. */
  scenario?: ScenarioExport;
}

/**
 * Generate a professional PDF report for an urban resilience analysis
 */
export function generatePDFReport(
  analysis: AnalysisRecord,
  options: PDFExportOptions = {}
): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  let yPos = margin;

  // Colors (matching the app's theme)
  const colors = {
    primary: [41, 128, 115] as [number, number, number], // hsl(158 55% 45%)
    accent: [71, 206, 200] as [number, number, number], // hsl(190 75% 55%)
    destructive: [210, 77, 87] as [number, number, number],
    warning: [240, 160, 40] as [number, number, number],
    text: [51, 51, 51] as [number, number, number],
    muted: [128, 128, 128] as [number, number, number],
    border: [60, 60, 60] as [number, number, number],
  };

  // Helper functions
  const addHeader = () => {
    // Brand bar at top
    doc.setFillColor(...colors.primary);
    doc.rect(0, 0, pageWidth, 8, "F");

    // Logo text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Vers3Dynamics", margin, 5.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Urban Resilience Intelligence", margin + 48, 5.5);

    // Report title
    doc.setTextColor(...colors.text);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("Urban Resilience Analysis Report", margin, yPos + 15);

    yPos += 25;
  };

  const addDivider = () => {
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
  };

  const addSectionTitle = (title: string) => {
    doc.setTextColor(...colors.primary);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin, yPos);
    yPos += 8;
  };

  const addText = (text: string, fontSize = 10, bold = false) => {
    doc.setTextColor(...colors.text);
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", bold ? "bold" : "normal");

    const lines = doc.splitTextToSize(text, contentWidth);
    doc.text(lines, margin, yPos);
    yPos += lines.length * (fontSize === 10 ? 5 : 4);
  };

  const addMetric = (label: string, value: string, color?: [number, number, number]) => {
    doc.setTextColor(...colors.muted);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(label.toUpperCase(), margin, yPos);

    doc.setTextColor(...(color || colors.text));
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(value, margin + 50, yPos);

    yPos += 8;
  };

  const addBarChart = (data: { label: string; value: number; color: [number, number, number] }[]) => {
    const barHeight = 6;
    const maxBarWidth = contentWidth - 60;
    const startX = margin + 55;

    data.forEach((item) => {
      // Label
      doc.setTextColor(...colors.text);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(item.label, margin, yPos + 4);

      // Bar background
      doc.setFillColor(230, 230, 230);
      doc.rect(startX, yPos, maxBarWidth, barHeight, "F");

      // Bar value
      doc.setFillColor(...item.color);
      doc.rect(startX, yPos, (item.value / 100) * maxBarWidth, barHeight, "F");

      // Percentage text
      doc.setTextColor(...colors.text);
      doc.setFontSize(8);
      doc.text(`${item.value.toFixed(1)}%`, startX + maxBarWidth + 3, yPos + 4.5);

      yPos += barHeight + 3;
    });
  };

  // Check for page overflow and add new page if needed
  const checkPageOverflow = (neededSpace: number) => {
    if (yPos + neededSpace > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };

  // ===== BUILD THE REPORT =====

  // Header
  addHeader();

  // Site Information
  addSectionTitle("Site Information");
  addText(analysis.name, 12, true);
  if (analysis.location_label) {
    addText(`Location: ${analysis.location_label}`);
  }
  addText(
    `Coordinates: ${analysis.center_lat.toFixed(4)}, ${analysis.center_lng.toFixed(4)} (Zoom: ${analysis.zoom})`
  );
  addText(`Analysis Date: ${new Date(analysis.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })}`);
  yPos += 5;

  addDivider();

  // Urban Absorption Score
  addSectionTitle("Urban Absorption Score");

  const score = Number(analysis.absorption_score);
  const risk = classifyFloodRisk(score);

  // Score display
  const scoreColor =
    risk === "low"
      ? colors.primary
      : risk === "moderate"
      ? colors.warning
      : colors.destructive;

  // Score circle
  const circleCenterX = pageWidth / 2;
  const circleCenterY = yPos + 25;
  const circleRadius = 20;

  doc.setDrawColor(...scoreColor);
  doc.setLineWidth(2);
  doc.circle(circleCenterX, circleCenterY, circleRadius, "S");

  doc.setTextColor(...scoreColor);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text(score.toFixed(0), circleCenterX - 5, circleCenterY + 2);

  doc.setFontSize(10);
  doc.setTextColor(...colors.muted);
  doc.text("/100", circleCenterX + 10, circleCenterY + 2);

  // Status text
  const statusText =
    score >= 65 ? "RESILIENT" : score >= 40 ? "VULNERABLE" : "CRITICAL";
  const riskText = riskLabel(risk);

  doc.setTextColor(...scoreColor);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(statusText, circleCenterX - 25, circleCenterY + 40);

  doc.setTextColor(...colors.muted);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Flood Risk: ${riskText}`, circleCenterX - 25, circleCenterY + 48);

  yPos += 65;

  addDivider();

  // Land Cover Composition
  addSectionTitle("Land Cover Composition");

  const total = Object.values(analysis.land_cover).reduce((a, b) => a + b, 0) || 1;
  const landCoverData = Object.entries(analysis.land_cover).map(([key, value]) => ({
    label: LAND_COVER_META[key as keyof LandCover].label,
    value: (value / total) * 100,
    color: getLandCoverColor(key as keyof LandCover),
  }));

  addBarChart(landCoverData);
  yPos += 5;

  // AI Notes
  if (analysis.ai_notes) {
    checkPageOverflow(40);
    addDivider();
    addSectionTitle("AI Analysis Notes");
    addText(analysis.ai_notes);
    yPos += 5;
  }

  // Recommendations
  checkPageOverflow(100);
  addDivider();
  addSectionTitle("Adaptation Recommendations");

  if (analysis.recommendations && analysis.recommendations.length > 0) {
    analysis.recommendations.forEach((rec, index) => {
      checkPageOverflow(30);

      // Priority indicator
      const priorityColor =
        rec.priority === "high"
          ? colors.destructive
          : rec.priority === "medium"
          ? colors.warning
          : colors.muted;

      doc.setFillColor(...priorityColor);
      doc.circle(margin + 2, yPos, 2, "F");

      // Recommendation title
      doc.setTextColor(...colors.text);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(rec.title, margin + 8, yPos + 1);

      // Category badge
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const categoryText = rec.category.toUpperCase();
      const catColor =
        rec.category === "green"
          ? colors.primary
          : rec.category === "blue"
          ? colors.accent
          : colors.muted;
      doc.setTextColor(...catColor);
      doc.text(`[${categoryText}]`, margin + 8 + doc.getTextWidth(rec.title) + 4, yPos + 1);

      // Description
      yPos += 6;
      doc.setTextColor(...colors.muted);
      doc.setFontSize(9);
      const descLines = doc.splitTextToSize(rec.description, contentWidth - 8);
      doc.text(descLines, margin + 8, yPos);
      yPos += descLines.length * 4 + 8;
    });
  } else {
    addText("No recommendations available for this analysis.");
  }

  // Scenario & Investment Analysis
  if (options.scenario) {
    const { scenario, impact, assumptions } = options.scenario;

    checkPageOverflow(110);
    addDivider();
    addSectionTitle("Scenario & Investment Analysis");

    addText("Modeled interventions:", 10, true);
    INTERVENTION_ORDER.forEach((key) => {
      const fraction = scenario[key];
      if (fraction <= 0) return;
      const def = INTERVENTIONS[key];
      const area = impact.convertedAreaM2[key];
      const sized =
        area > 0 ? ` (~${Math.round(area).toLocaleString("en-US")} m²)` : "";
      addText(
        `• ${def.label} — ${Math.round(fraction * 100)}% of ${
          def.source
        } converted${sized} at $${def.unitCostUSD}/m²`,
        9
      );
    });
    yPos += 3;

    checkPageOverflow(60);
    addMetric(
      "Projected score",
      `${impact.baseScore.toFixed(0)} → ${impact.projectedScore.toFixed(
        0
      )} (+${impact.scoreDelta.toFixed(1)})`,
      colors.primary
    );
    addMetric(
      "Flood risk",
      `${riskLabel(impact.baseRisk)} → ${riskLabel(impact.projectedRisk)}`
    );
    if (impact.totalConvertedAreaM2 > 0) {
      addMetric(
        "Added retention",
        `${formatVolumeM3(impact.addedRetentionM3)} / year`,
        colors.accent
      );
      addMetric("Capital cost", formatCompactUSD(impact.capexUSD));
      addMetric(
        "Annual benefit",
        `${formatCompactUSD(impact.annualBenefitUSD)} / year`,
        colors.primary
      );
      addMetric(
        "Simple payback",
        impact.paybackYears === null
          ? "N/A"
          : impact.paybackYears > 100
          ? "Over 100 years"
          : `${impact.paybackYears.toFixed(1)} years`
      );
    }
    yPos += 2;
    addText(
      `Assumptions: ${assumptions.annualRainfallMm} mm mean annual rainfall; ` +
        `$${assumptions.benefitPerM3USD.toFixed(2)}/m³ monetized retention benefit. ` +
        "Planning-level estimates — calibrate unit costs and benefits to local data before underwriting.",
      8
    );
    yPos += 3;
  }

  // Footer
  const footerY = pageHeight - 12;
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

  doc.setTextColor(...colors.muted);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Generated by Vers3Dynamics Urban Resilience Intelligence Platform",
    margin,
    footerY
  );
  doc.text(
    "This report is for informational purposes only and should not be used as sole basis for engineering decisions.",
    margin,
    footerY + 4
  );
  doc.text(
    `Report ID: ${analysis.id}`,
    pageWidth - margin - doc.getTextWidth(`Report ID: ${analysis.id}`),
    footerY
  );

  return doc;
}

/**
 * Helper to get RGB color for land cover types
 */
function getLandCoverColor(key: keyof LandCover): [number, number, number] {
  const colors: Record<keyof LandCover, [number, number, number]> = {
    vegetation: [115, 160, 115], // hsl(130 45% 45%)
    soil: [165, 130, 105], // hsl(30 40% 45%)
    water: [71, 180, 200], // hsl(200 75% 55%)
    buildings: [100, 80, 70], // hsl(20 12% 42%)
    pavement: [150, 140, 135], // hsl(30 4% 55%)
  };
  return colors[key] || [128, 128, 128];
}

/**
 * Download a PDF report for an analysis
 */
export function downloadPDFReport(
  analysis: AnalysisRecord,
  options: PDFExportOptions = {},
  filename?: string
): void {
  const doc = generatePDFReport(analysis, options);
  const defaultFilename = `vers3dynamics-report-${analysis.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${new Date(analysis.created_at).toISOString().split("T")[0]}.pdf`;
  doc.save(filename || defaultFilename);
}