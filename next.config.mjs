/** @type {import('next').NextConfig} */
const nextConfig = {
  // The rulebook JSON is read from disk at runtime, so ship it with every API function.
  outputFileTracingIncludes: { '/api/**': ['./rulebook/**/*.json'] },
};

export default nextConfig;
