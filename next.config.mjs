/** @type {import('next').NextConfig} */
// Static export so the app can be hosted on GitHub Pages (or any static host).
// NEXT_PUBLIC_BASE_PATH is set to "/chess-learn" for the GitHub Pages build so that
// assets resolve correctly under https://<user>.github.io/chess-learn/.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
};

export default nextConfig;
