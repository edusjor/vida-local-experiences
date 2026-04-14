import type { Metadata } from "next";
import LegalDocumentEmbed, { buildLegalMetadata, type LegalSection } from "../../components/LegalDocumentEmbed";
import { siteConfig } from "../../../lib/siteConfig";

const sections: LegalSection[] = [
  {
    heading: "Service scope",
    paragraphs: [
      `${siteConfig.brandName} offers private travel experiences and related information for Costa Rica destinations, including Manuel Antonio, Dominical, and Uvita.`,
      "Website content may be updated according to seasonality, operational conditions, and supplier availability.",
    ],
  },
  {
    heading: "Requests and bookings",
    paragraphs: [
      "All requests are subject to availability and operational validation.",
      "A booking is considered confirmed only when our system or support team expressly confirms acceptance and the corresponding payment is successfully registered or validated.",
    ],
  },
  {
    heading: "Payments and receipts",
    paragraphs: [
      "Payment flows may involve automatic confirmation or manual validation depending on the selected payment method.",
      "When manual review is required, the booking remains pending until verification is completed.",
    ],
  },
  {
    heading: "Changes, cancellations, and weather",
    paragraphs: [
      "Nature-based experiences may be adjusted due to weather, safety, access conditions, or local provider decisions.",
      "If a material change is required, our team will communicate promptly to coordinate viable alternatives.",
    ],
  },
  {
    heading: "Traveler responsibilities",
    paragraphs: [
      "Travelers must provide accurate information, respect agreed times, follow safety guidance, and communicate relevant needs in advance.",
    ],
  },
];

export const metadata: Metadata = buildLegalMetadata({
  title: "General terms and conditions",
  description: `General conditions for requests and bookings on ${siteConfig.brandName}.`,
  sections,
});

export default function TerminosCondicionesPage() {
  return (
    <LegalDocumentEmbed
      title="General terms and conditions"
      description={`General conditions for requests and bookings on ${siteConfig.brandName}.`}
      sections={sections}
    />
  );
}
