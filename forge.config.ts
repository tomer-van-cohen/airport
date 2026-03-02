import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerZIP } from '@electron-forge/maker-zip';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: 'Airport',
  },
  hooks: {
    preStart: async () => {
      process.env.AIRPORT_DEV = '1';
      const plist = resolve(require.resolve('electron/package.json'), '..', 'dist/Electron.app/Contents/Info.plist');
      execSync(`plutil -replace CFBundleIdentifier -string com.airport.dev "${plist}"`);
      execSync(`plutil -replace CFBundleDisplayName -string "Airport Dev" "${plist}"`);
      execSync(`plutil -replace CFBundleName -string "Airport Dev" "${plist}"`);
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerZIP({}, ['darwin']),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
