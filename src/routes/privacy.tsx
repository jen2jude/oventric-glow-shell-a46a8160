import { createFileRoute } from "@tanstack/react-router";
import { PublicChrome } from "@/components/oventric/PublicChrome";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Oventric" },
      { name: "description", content: "How Oventric collects, uses, and protects your data." },
      { property: "og:title", content: "Oventric Privacy Policy" },
      {
        property: "og:description",
        content: "How Oventric collects, uses, and protects your data.",
      },
      { property: "og:url", content: "https://oventric.com/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://oventric.com/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <PublicChrome>
      <div className="max-w-3xl mx-auto px-4 py-10 text-slate-200 md:text-slate-800">
        <h1 className="text-3xl md:text-4xl font-black text-white md:text-slate-900">
          Privacy Policy
        </h1>
        <p className="mt-2 text-xs text-slate-500">
          This page is maintained by the Oventric team to answer common privacy questions.
        </p>

        <section className="mt-8 space-y-4 text-sm text-slate-300 leading-relaxed md:text-slate-600">
          <h2 className="text-lg font-bold text-white md:text-slate-900">Information we collect</h2>
          <p>
            Account information (name, email, phone, country), profile content you upload (avatar,
            cover, posts, listings), transaction records (wallet activity, orders, payouts), and KYC
            materials when you complete verification.
          </p>

          <h2 className="text-lg font-bold text-white md:text-slate-900">How we use it</h2>
          <p>
            To operate the platform, process payments and payouts, verify identity, prevent fraud,
            and improve the product. We do not sell your personal data.
          </p>

          <h2 className="text-lg font-bold text-white md:text-slate-900">Sharing</h2>
          <p>
            We share limited information with vetted processors that help us run Oventric (payments,
            hosting, email delivery). Public content (posts, listings, profile) is visible to other
            users as expected.
          </p>

          <h2 className="text-lg font-bold text-white md:text-slate-900">Retention</h2>
          <p>
            We retain data while your account is active. Deleting your account starts a 30-day
            window during which the account is inactive and recoverable. After 30 days, associated
            personal data is permanently removed except where retention is required by law.
          </p>

          <h2 className="text-lg font-bold text-white md:text-slate-900">Your rights</h2>
          <p>
            You can access, correct, or export your data from your dashboard. Contact us to make a
            request that isn't self-serve.
          </p>

          <h2 className="text-lg font-bold text-white md:text-slate-900">Security</h2>
          <p>
            Passwords are hashed by our auth provider. Sensitive endpoints are protected by
            row-level security and per-user authentication.
          </p>

          <h2 className="text-lg font-bold text-white md:text-slate-900">Cookies</h2>
          <p>
            We use cookies for authentication and session continuity. Analytics cookies are minimal
            and used to improve the product.
          </p>
        </section>
      </div>
    </PublicChrome>
  );
}
