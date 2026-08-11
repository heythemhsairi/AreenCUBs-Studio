import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  experimental: {
    serverActions: {
      // Review versions upload through a server action so the storage RLS
      // policy — not a bypassing service key — is what authorises the write.
      // The Next.js default body cap is 1 MB, which no video clears.
      bodySizeLimit: "210mb",
    },
  },
};

export default nextConfig;
