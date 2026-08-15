import { Link } from 'react-router-dom';
import { Scale, ShieldCheck } from 'lucide-react';
import { GlassCard, Page } from '../components/common';
import { LEGAL_CONSENT_VERSION } from '../lib/legal';

function LegalNotice() {
  return (
    <GlassCard className="mb-4 border-[color:var(--color-warning)]/25 bg-[color:var(--color-warning)]/8 p-4">
      <div className="flex items-start gap-3">
        <Scale className="mt-0.5 text-[color:var(--color-warning)]" size={20} />
        <p className="text-sm leading-6 text-[color:var(--color-text-soft)]">
          Draft for human legal review. This text is tailored to Lokl&apos;s current product behavior, but it is not legal advice and should not be treated as final until reviewed by a qualified lawyer.
        </p>
      </div>
    </GlassCard>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <div className="space-y-3 text-sm leading-6 text-[color:var(--color-text-soft)]">{children}</div>
    </section>
  );
}

export function PrivacyPolicyPage() {
  return (
    <Page title="Privacy Policy" subtitle={`Draft version ${LEGAL_CONSENT_VERSION}`}>
      <LegalNotice />
      <GlassCard className="space-y-6 p-5">
        <Section title="What Lokl collects">
          <p>Lokl collects account details you provide, including phone number when you use OTP, Google OAuth profile details when you choose Google sign-in, full name, optional bio, optional phone, avatar image, locality, city, approximate coordinates, listings, listing photos, prices, descriptions, chats, offers, reports, reviews, wishlist activity, notifications, and basic device data needed for push notifications.</p>
          <p>When you use current-location detection, your browser shares coordinates with Lokl so nearby listings can be sorted. You can enter locality and city manually instead.</p>
        </Section>
        <Section title="Why Lokl uses it">
          <p>Lokl uses this data to create and protect accounts, show nearby marketplace listings, enable chat and offers, upload and display photos, send notifications, prevent spam and abuse, investigate reports, apply bans, and maintain trust and safety records.</p>
        </Section>
        <Section title="Third parties">
          <p>Lokl uses Supabase for authentication, database, storage, realtime updates, and server functions; Google for Google OAuth, maps, Firebase Cloud Messaging, and optional image safety review; and the configured SMS provider, currently Twilio in the verification setup, for phone OTP delivery. These providers process the data needed to deliver their services.</p>
        </Section>
        <Section title="Retention and deletion">
          <p>Account, profile, listing, chat, report, review, notification, and media data is retained while your account exists or while needed for safety, fraud prevention, disputes, or legal obligations. The app includes a Delete account flow in Profile settings. It removes the public profile, listings, chats, saved listings, notifications, reviews tied by account references, and the Supabase Auth identity through the delete-account Edge Function.</p>
          <p>Some safety records may be kept in anonymized or aggregated form where needed to prevent abuse. Media uploaded before the user-scoped storage path change may need operator cleanup if no longer associated with a user folder.</p>
        </Section>
        <Section title="Your rights">
          <p>Users should be able to request access, correction, and deletion of personal data. For launch, Lokl must provide a monitored privacy contact address before accepting real public users. Account data can be corrected in Profile, and deletion can be started from Profile settings.</p>
        </Section>
        <Section title="India DPDP Act note">
          <p>Lokl collects phone numbers, location, photos, chats, and marketplace activity from users in India, so the Digital Personal Data Protection Act may apply. Consent wording, lawful uses, notices, grievance handling, retention, and transfer/localization posture need legal review before production launch.</p>
        </Section>
        <div className="border-t border-white/10 pt-4 text-sm">
          <Link to="/terms" className="font-semibold text-[color:var(--color-primary)]">Read Terms of Service</Link>
        </div>
      </GlassCard>
    </Page>
  );
}

export function TermsPage() {
  return (
    <Page title="Terms of Service" subtitle={`Draft version ${LEGAL_CONSENT_VERSION}`}>
      <LegalNotice />
      <GlassCard className="space-y-6 p-5">
        <Section title="Who can use Lokl">
          <p>Lokl is intended for users who are at least 18 years old and able to enter into local marketplace transactions. Users are responsible for keeping account access secure and for the accuracy of profile and listing information.</p>
        </Section>
        <Section title="Marketplace role">
          <p>Lokl is a platform that helps neighbours discover listings, chat, make offers, and arrange transactions. Lokl is not a buyer, seller, broker, payment escrow, delivery provider, or party to transactions between users.</p>
        </Section>
        <Section title="Prohibited listings and conduct">
          <p>Users must not list illegal goods, weapons, controlled substances, counterfeit goods, stolen property, explicit sexual content, unsafe services, regulated items without required authorization, or anything that violates applicable law. Users must not harass others, spam, scam, evade in-app chat for fraud, post repeated duplicate listings, embed phone numbers to avoid moderation, or send money-first scams.</p>
        </Section>
        <Section title="Moderation and bans">
          <p>Lokl may flag, hide, delete, review, or restrict listings and accounts. The app includes automated spam/scam checks, image safety checks when configured, user reports, and a human admin queue. Accounts marked banned cannot post listings or send messages.</p>
        </Section>
        <Section title="Disputes and safety">
          <p>Users should meet in public places, inspect items before paying, and use in-app chat where possible. Disputes between buyers and sellers are primarily between those users, though Lokl may review reports and take platform safety action.</p>
        </Section>
        <Section title="Liability">
          <p>Lokl is provided as-is. To the extent allowed by law, Lokl is not responsible for user listings, user conduct, transaction outcomes, lost profits, indirect damages, or issues outside the platform&apos;s reasonable control. Final wording and enforceability need legal review.</p>
        </Section>
        <div className="flex items-center gap-3 border-t border-white/10 pt-4 text-sm">
          <ShieldCheck size={16} className="text-[color:var(--color-secondary)]" />
          <Link to="/privacy" className="font-semibold text-[color:var(--color-primary)]">Read Privacy Policy</Link>
        </div>
      </GlassCard>
    </Page>
  );
}
