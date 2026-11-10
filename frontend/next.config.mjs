/** Proxy /api/* to the FastAPI backend so the session cookie is same-origin. */
let BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:8000";
if (!/^https?:\/\//.test(BACKEND)) BACKEND = `http://${BACKEND}`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND}/api/:path*` }];
  },
};
export default nextConfig;
