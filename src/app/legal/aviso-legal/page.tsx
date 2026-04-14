import type { Metadata } from "next";
import LegalDocumentEmbed, { buildLegalMetadata, type LegalSection } from "../../components/LegalDocumentEmbed";
import { siteConfig } from "../../../lib/siteConfig";

const sections: LegalSection[] = [
  {
    heading: "Website owner",
    paragraphs: [
      `${siteConfig.brandName} operates this website as an information and booking channel for private travel experiences in Costa Rica.`,
      "Content published here is provided to help travelers understand destinations, experiences, availability, and contact options before booking.",
    ],
  },
  {
    heading: "Permitted use",
    paragraphs: [
      "You agree to use this website lawfully and respectfully, without disrupting security, stability, or availability.",
      "You may not copy, alter, or reuse website content for misleading or commercial purposes without prior authorization.",
    ],
  },
  {
    heading: "Intellectual property",
    paragraphs: [
      "The brand, written content, images, visual identity, and website structure belong to Vida Local Experiences or their respective owners when indicated.",
    ],
  },
  {
    heading: "External links",
    paragraphs: [
      "This website may include links to external platforms such as maps, payment services, and social channels. Each platform operates under its own terms and policies.",
    ],
  },
];

export const metadata: Metadata = buildLegalMetadata({
  title: "Legal notice",
  description: `General legal information for the ${siteConfig.brandName} website.`,
  sections,
});

export default function AvisoLegalPage() {
  return (
    <LegalDocumentEmbed
      title="Legal notice"
      description={`General legal information for the ${siteConfig.brandName} website.`}
      sections={sections}
    />
  );
}
