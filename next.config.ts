import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["just-bash", "bash-tool", "node-liblzma", "@mongodb-js/zstd", "secure-exec", "@secure-exec/node", "@secure-exec/core"],
};

export default nextConfig;
