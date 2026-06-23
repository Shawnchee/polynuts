import { Config } from '@remotion/cli/config';

/**
 * Remotion CLI config. Points the bundler at the demo entry and sets the H.264
 * defaults for the marketing render. This file is read only by the Remotion CLI
 * (`remotion render` / `remotion studio`) — the Next.js app never imports it.
 */
Config.setEntryPoint('./remotion/index.ts');
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
