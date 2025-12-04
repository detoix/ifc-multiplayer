/** @type {import('next').NextConfig} */
const CopyPlugin = require('copy-webpack-plugin');
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Copy web-ifc.wasm to the output directory where the library expects it
    if (!isServer) {
      config.plugins.push(
        new CopyPlugin({
          patterns: [
            {
              from: path.join(__dirname, 'node_modules/web-ifc-three/node_modules/web-ifc/web-ifc.wasm'),
              to: path.join(__dirname, '.next/static/chunks/wasm/web-ifc.wasm'),
            },
          ],
        })
      );
    }
    return config;
  },
};

module.exports = nextConfig;
