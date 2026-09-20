import type { NextConfig } from 'next';

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // CSV pastes and lot image uploads exceed the 1 MB default (BUILD-SPEC §11b).
      bodySizeLimit: '10mb',
    },
  },
  images: {
    // The logo is served at quality 90: it is a flat mark with fine lettering
    // and JPEG ringing at 75 is visible on the "Central University of
    // Technology" line. Next 16 requires declared qualities.
    qualities: [75, 90],
    remotePatterns: supabaseHost
      ? [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }]
      : [],
  },
};

export default nextConfig;
