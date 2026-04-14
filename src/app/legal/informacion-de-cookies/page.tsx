import type { Metadata } from "next";
import LegalDocumentEmbed, { buildLegalMetadata, type LegalSection } from "../../components/LegalDocumentEmbed";
import { siteConfig } from "../../../lib/siteConfig";

const sections: LegalSection[] = [
  {
    heading: "What cookies are",
    paragraphs: [
      "Cookies are small files used to remember preferences, measure website usage, and improve your browsing experience.",
    ],
  },
  {
    heading: "Cookie types we may use",
    items: [
      "Technical cookies required for basic website functionality.",
      "Preference cookies used to remember useful user settings.",
      "Analytics cookies, when applicable, to understand how the website is used.",
    ],
  },
  {
    heading: "User controls",
    paragraphs: [
      "You can accept, block, or delete cookies from your browser settings. Please note that disabling certain technical cookies may affect website functionality.",
    ],
  },
  {
    heading: "Third-party services",
    paragraphs: [
      "External integrations such as maps, analytics tools, and payment platforms may set their own cookies under their independent policies.",
    ],
  },
];

export const metadata: Metadata = buildLegalMetadata({
  title: "Cookie information",
  description: `Information about cookies and browsing on ${siteConfig.brandName}.`,
  sections,
});

export default function InformacionCookiesPage() {
  return (
    <LegalDocumentEmbed
      title="Cookie information"
      description={`Information about cookies and browsing on ${siteConfig.brandName}.`}
      sections={sections}
    />
  );
}
