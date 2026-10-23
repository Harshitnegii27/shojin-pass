/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The rulebook JSON is read from disk at runtime, so ship it with every API function.
  outputFileTracingIncludes: { '/api/**': ['./rulebook/**/*.json'] },
  // HEIC decoding loads WebAssembly at runtime; keep it out of the bundle (sharp already is).
  serverExternalPackages: ['heic-decode', 'libheif-js'],
};

export default nextConfig;
