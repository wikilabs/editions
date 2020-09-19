const fs = require('fs')
const resolve = require('path').resolve
const join = require('path').join
const exec = require('child-process-promise').exec

const PromisePool = require('@supercharge/promise-pool')

// get library path
const lib = resolve(__dirname, '../../')

const mods = fs.readdirSync(lib)
console.log(mods)

function buildModule(mod) {
    var modPath = join(lib, mod)

    // console.log(modPath)
    // ensure path has package.json
    if (!fs.existsSync(join(modPath, 'package.json'))) return

    // check if batch processing should be skipped
    if (fs.existsSync(join(modPath, 'skip-build'))) return

    // install folder
    console.log("\nenter directory:\n--> " + modPath + "\n--> build started\n");

    exec('npm run build', { env: process.env, cwd: modPath }, (e, stdout, stderr) => {
		if (e instanceof Error) {
			console.error(e)
			throw e
		}

		if (stdout) console.log('finished: ', stdout);
		if (stderr) console.log('error ', stderr);
    })
}

async function run () {
  const { results, errors } = await PromisePool
    .withConcurrency(4)
    .for(mods)
    .process(buildModule)

  console.log('Results ->')
  console.log(results)

  console.log(`Errors -> ${errors.length ? errors : 'none'}`)
}

run()