import type { NextConfig } from 'next';

// The local Supabase stack is http on 127.0.0.1; the hosted projects are https.
// Hard-coding `https` here makes next/image refuse every locally uploaded banner
// and lot photo, so the protocol comes from the URL like the hostname does.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
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
    remotePatterns: supabaseUrl
      ? [
          {
            protocol: supabaseUrl.protocol === 'http:' ? ('http' as const) : ('https' as const),
            hostname: supabaseUrl.hostname,
            port: supabaseUrl.port || undefined,
            pathname: '/storage/v1/object/public/**',
          },
        ]
      : [],
  },
};

export default nextConfig;
