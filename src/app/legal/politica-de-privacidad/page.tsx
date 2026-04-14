import type { Metadata } from "next";
import LegalDocumentEmbed, { buildLegalMetadata, type LegalSection } from "../../components/LegalDocumentEmbed";
import { siteConfig } from "../../../lib/siteConfig";

const sections: LegalSection[] = [
  {
    heading: "Data we collect",
    paragraphs: [
      "We may collect your name, email, phone number, message details, and booking-related data required to respond to inquiries and manage reservations.",
    ],
    items: [
      "Contact details provided through forms or direct communication channels.",
      "Travel details such as requested dates, number of travelers, and trip interests.",
      "Operational details needed to confirm reservations and validate payments.",
    ],
  },
  {
    heading: "How we use your data",
    paragraphs: [
      "We use personal data only to respond to requests, coordinate experiences, send confirmations, and improve traveler support.",
    ],
  },
  {
    heading: "Retention and access",
    paragraphs: [
      "We retain information only for the time reasonably required to process inquiries, deliver booked experiences, and meet operational or administrative obligations.",
    ],
  },
  {
    heading: "Your rights",
    paragraphs: [
      `You may request access, correction, or deletion of your personal data by contacting ${siteConfig.supportEmail}.`,
    ],
  },
  {
    heading: "Security",
    paragraphs: [
      "We apply reasonable safeguards to protect personal information and restrict its use to legitimate service-related purposes.",
    ],
  },
];

export const metadata: Metadata = buildLegalMetadata({
  title: "Privacy policy",
  description: `Privacy policy and data handling practices for ${siteConfig.brandName}.`,
  sections,
});

export default function PoliticaPrivacidadPage() {
  return (
    <LegalDocumentEmbed
      title="Privacy policy"
      description={`Privacy policy and data handling practices for ${siteConfig.brandName}.`}
      sections={sections}
    />
  );
}
