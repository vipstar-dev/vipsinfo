import program from 'commander'
import Liftoff from 'liftoff'
import path from 'path'

import VipsNode from '@/node/cli/node'
import { ConfigFile } from '@/node/node'
import packageJson from '@/package.json'

process.on('unhandledRejection', (reason: object | null | undefined) =>
  console.error(reason)
)

const liftoff = new Liftoff({
  name: 'vipsinfo',
  moduleName: 'vipsinfo-node',
  configName: 'vipsinfo-node',
  processTitle: 'vipsinfo',
})
  .on('require', (name) => {
    console.log('Loading:', name)
  })
  .on('requireFail', (name, err) => {
    console.error('Unable to load:', name, err)
  })
  .on('respawn', (flags, child) => {
    console.log('Detected node flags:', flags)
    console.log('Respawned to PID', child.pid)
  })

liftoff.launch({ cwd: process.cwd() }, () => {
  program.version(packageJson.version)

  program
    .command('start')
    .description('Start the current node')
    .option(
      '-c, --config <dir>',
      'Specify the directory with Vipsinfo Node configuration'
    )
    .action((cmd: { [key: string]: string }) => {
      const config: ConfigFile = require(path.resolve(
        process.cwd(),
        ...(cmd.config ? [cmd.config] : []),
        'vipsinfo-node.json'
      )) as ConfigFile
      const node = new VipsNode({ path: process.cwd(), config })
      node.start()
    })

  program.parse(process.argv)
  if (process.argv.length === 2) {
    program.help()
  }
})
