import type { Metadata } from "next";
import { siteConfig } from "../../lib/siteConfig";

export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  items?: string[];
};

export type LegalPageConfig = {
  title: string;
  description?: string;
  sections: LegalSection[];
};

export function buildLegalMetadata(config: LegalPageConfig): Metadata {
  return {
    title: `${config.title} | ${siteConfig.brandName}`,
    description:
      config.description ??
      `Consulta ${config.title.toLowerCase()} de ${siteConfig.brandName}.`,
  };
}

export default function LegalDocumentEmbed({ title, description, sections }: LegalPageConfig) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mb-6 rounded-3xl border border-white/10 bg-[#202630]/92 p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand-gold)]">Menu legal</p>
        <h1 className="mt-2 text-3xl font-extrabold text-white">{title}</h1>
        {description ? <p className="mt-3 text-sm text-slate-300">{description}</p> : null}
      </div>

      <article className="rounded-3xl border border-white/10 bg-[#202630]/92 p-6 text-[15px] leading-7 text-slate-200 shadow-sm">
        {sections.map((section) => (
          <section key={section.heading} className="mb-8 last:mb-0">
            <h2 className="mb-3 text-xl font-bold text-white">{section.heading}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="mb-3 text-slate-300 last:mb-0">
                {paragraph}
              </p>
            ))}
            {section.items?.length ? (
              <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-300 marker:text-[var(--brand-gold)]">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        <div className="rounded-2xl border border-white/10 bg-[#171c24] p-4 text-sm text-slate-300">
          Para consultas sobre estas politicas y condiciones puedes escribirnos a{" "}
          <a className="font-semibold text-[var(--brand-gold)]" href={`mailto:${siteConfig.supportEmail}`}>
            {siteConfig.supportEmail}
          </a>
          .
        </div>
      </article>
    </section>
  );
}
