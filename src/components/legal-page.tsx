import { Link } from 'wouter';
import { ArrowRight, Film } from 'lucide-react';

type LegalKind = 'privacy' | 'terms' | 'about';

const legalCopy = {
  privacy: {
    eyebrow: 'Privacy',
    title: 'Privacy Policy',
    intro: 'Ducere is a personal viewing archive. This policy explains what the current app stores, why it is used, and the controls available to you.',
    sections: [
      ['What we store', 'Ducere may store your account email through Supabase Auth, your chosen display name, country or region, selected streaming services, viewing-library entries, ratings, reviews, dates, and viewing progress.'],
      ['Why we use it', 'We use this information to authenticate you, keep your archive synchronized, personalize your library, and show region-specific availability results. We do not need your viewing history to host or distribute the underlying movies or shows.'],
      ['Third-party services', 'Ducere currently uses Supabase for authentication and application data, Watchmode for verified availability lookups, TVmaze for some TV metadata and artwork, AniList for anime metadata and artwork, and Wikipedia for some fallback artwork. Each service has its own terms and privacy practices.'],
      ['Local storage and cache', 'Ducere may keep a local copy of your signed-in archive and short-lived metadata caches in your browser. These are used for responsiveness and offline continuity; they are not a separate account database.'],
      ['Data sharing', 'Ducere does not intentionally sell your personal data. Availability requests may send the title, media type, year, and selected region to the availability provider so it can return matching services.'],
      ['Your controls', 'You can export your Ducere archive, import an archive, reset your saved archive, change your profile settings, and delete your account from Settings when the account-deletion control is available. Account deletion removes the Supabase Auth account and its dependent profile/library records configured for Ducere.'],
      ['Security', 'Ducere uses Supabase Auth and row-level security for account data. Publishable client keys are not treated as secrets; privileged keys remain server-side. No online service can promise absolute security.'],
      ['Changes', 'This policy may be updated when Ducere changes its data practices, providers, or legal requirements. The effective date shown below identifies the version currently shipped with the app.'],
    ],
  },
  terms: {
    eyebrow: 'Terms',
    title: 'Terms of Service',
    intro: 'These terms describe the intended use of the current Ducere application. They are product terms, not a substitute for jurisdiction-specific legal advice.',
    sections: [
      ['Use of Ducere', 'Ducere is a personal tracking and discovery service. You may use it to record your own viewing activity, organize a watchlist, track progress, and open links to legitimate viewing services.'],
      ['Third-party content', 'Ducere does not host, stream, download, or provide unauthorized copies of movies or television programs. Availability information, artwork, names, logos, ratings, and other metadata may belong to their respective providers and rights holders.'],
      ['Availability accuracy', 'Where to Watch results depend on third-party data and can change by country, subscription, title, or time. Ducere presents provider-backed results when available and does not guarantee that a title will remain available.'],
      ['Your account', 'You are responsible for keeping your account credentials secure and for activity performed through your account. Do not use Ducere to upload unlawful material, attempt unauthorized access, abuse third-party services, or interfere with the service.'],
      ['Your content', 'Ratings, reviews, dates, progress, and other information you enter remain your content. You are responsible for ensuring that anything you submit is lawful and does not violate another person’s rights.'],
      ['Third-party services', 'Supabase, Watchmode, TVmaze, AniList, Wikipedia, and streaming providers are independent services. Their own terms, licenses, availability, and privacy policies apply when Ducere interacts with them.'],
      ['Changes and availability', 'Ducere may change, suspend, or discontinue features as the product evolves. Third-party integrations can also change without notice.'],
      ['Disclaimer', 'Ducere is provided on an as-available basis. To the extent permitted by applicable law, Ducere does not guarantee uninterrupted service, error-free third-party data, or continuous availability of any streaming provider.'],
    ],
  },
  about: {
    eyebrow: 'About & credits',
    title: 'Ducere',
    intro: 'Track what you watched, what you want to watch, what you are watching, and where you can watch it.',
    sections: [
      ['What Ducere does', 'Ducere combines a personal viewing archive, watchlist, progress tracking, discovery, recommendations, and verified availability lookups in one place.'],
      ['Availability attribution', 'Verified availability data in Ducere is provided through Watchmode. Watchmode data and trademarks remain subject to Watchmode’s applicable API terms and plan requirements.'],
      ['Metadata & artwork', 'Ducere currently uses TVmaze, AniList, and Wikipedia for selected metadata and artwork fallbacks. Those services and the underlying rights holders retain their respective rights. Artwork returned by a third-party API is not assumed to be owned by Ducere.'],
      ['Provider brands', 'Streaming service names, logos, icons, and related branding belong to their respective owners. Their appearance in Ducere identifies a service and does not imply ownership or endorsement.'],
      ['Licensing note', 'Commercial deployment requires the applicable third-party API licenses and attribution terms to be satisfied. Watchmode’s current API terms distinguish non-image data from third-party images and require separate rights for third-party images.'],
      ['Effective date', '20 September 2026. This page reflects the current implementation and should be reviewed again before a commercial launch or material change in providers.'],
    ],
  },
} as const;

export function LegalPage({ kind }: { kind: LegalKind }) {
  const page = legalCopy[kind];
  return (
    <div className="mx-auto max-w-[900px] px-5 py-9 sm:px-8 lg:px-12">
      <Link href="/" className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-[#898b9b] hover:text-[#e47a58]">
        <ArrowRight size={14} className="rotate-180" /> Back to Ducere
      </Link>
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e47a58] text-[#17151f]"><Film size={19} /></span>
        <span className="font-display text-2xl">ducere</span>
      </div>
      <p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-[#df8265]">{page.eyebrow}</p>
      <h1 className="mt-2 font-display text-[clamp(2.6rem,6vw,5rem)] leading-[.95] tracking-[-.05em] text-[#f1e9dc]">{page.title}</h1>
      <p className="mt-5 max-w-2xl text-sm leading-7 text-[#9999a8]">{page.intro}</p>
      <div className="mt-9 space-y-4">
        {page.sections.map(([heading, body]) => (
          <section key={heading} className="panel rounded-2xl p-5 sm:p-7">
            <h2 className="text-sm font-bold text-[#e8dfd3]">{heading}</h2>
            <p className="mt-2 text-xs leading-6 text-[#9293a3]">{body}</p>
          </section>
        ))}
      </div>
      {kind === 'privacy' && <p className="mt-6 text-[10px] leading-5 text-[#6f7180]">For a commercial launch, the operator of Ducere should replace this product draft with a reviewed privacy notice containing the operator’s legal identity and appropriate contact/rights-request details.</p>}
      {kind === 'terms' && <p className="mt-6 text-[10px] leading-5 text-[#6f7180]">For a commercial launch, the operator of Ducere should have these terms reviewed for the countries in which the service is offered.</p>}
    </div>
  );
}
