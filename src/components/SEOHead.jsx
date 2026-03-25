import { Helmet } from 'react-helmet-async';

const DEFAULTS = {
  title: 'MySetlists | Your Show History',
  description: 'Track every show you\'ve attended, rate setlists, and share your concert history with friends.',
  ogImage: 'https://mysetlists.net/og-image.svg',
  siteUrl: 'https://mysetlists.net',
};

/**
 * Reusable SEO head component. Renders <title>, meta description,
 * Open Graph, Twitter Card, and canonical link tags.
 *
 * @param {string}  title        – Page title (falls back to DEFAULTS.title)
 * @param {string}  description  – Meta description (falls back to DEFAULTS.description)
 * @param {string}  [ogImage]    – Open Graph image URL
 * @param {string}  [canonicalUrl] – Canonical URL for this page
 * @param {string}  [ogType]     – og:type value (default "website")
 * @param {React.ReactNode} [children] – Extra tags (e.g. JSON-LD <script>)
 */
export default function SEOHead({
  title = DEFAULTS.title,
  description = DEFAULTS.description,
  ogImage = DEFAULTS.ogImage,
  canonicalUrl,
  ogType = 'website',
  children,
}) {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:type" content={ogType} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      {children}
    </Helmet>
  );
}
