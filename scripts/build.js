//@ts-check
import { createBuilder, createFxmanifest } from '@overextended/fx-utils';

const watch = process.argv.includes('--watch');

createBuilder(
  watch,
  {
    keepNames: true,
    legalComments: 'inline',
    bundle: true,
    treeShaking: true,
  },
  [
    {
      name: 'server',
      options: {
        platform: 'node',
        target: ['node22'],
        format: 'cjs',
      },
    }
  ],
  async (outfiles) => {
    await createFxmanifest({
      server_scripts: [outfiles.server],
      dependencies: ['/server:13068', '/onesync'],
      metadata: {
        node_version: '22',
        server_only: 'yes',
        console_log_level: 'debug',
      },
    });

  }
);
