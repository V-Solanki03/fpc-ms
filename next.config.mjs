import path from "path";
import { fileURLToPath } from "url";
const root = path.dirname(fileURLToPath(import.meta.url));
/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg", "nodemailer", "xlsx"],
  eslint: { ignoreDuringBuilds: true },
  webpack(config) {
    config.resolve.alias = { ...config.resolve.alias, "@": path.join(root, "src") };
    return config;
  },
};
export default nextConfig;
