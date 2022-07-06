const fs = require('fs')
const resolve = require('path').resolve
const join = require('path').join
const exec = require('child-process-promise').exec

const PromisePool = require('@supercharge/promise-pool')

// get library path
const lib = resolve(__dirname, '../../')

const mods = fs.readdirSync(lib)
// console.log(mods)

async function run () {
  const { results, errors } = await PromisePool
    .withConcurrency(8)
    .for(mods)
    .process(async (mod) => {
			var modPath = join(lib, mod)

			// ensure path has package.json
			if (!fs.existsSync(join(modPath, 'package.json')))
				return

			// check if batch processing should be skipped
			if (fs.existsSync(join(modPath, 'skip-build')))
				return

			// install folder
			console.log("enter directory:\n--> " + modPath + "\n--> build started\n")

			await exec('npm run build', { env: process.env, cwd: modPath })
				.then ((result) => {
					var stdout = result.stdout;
					var stderr = result.stderr;

					if (stdout) {
						console.log("finished ->", stdout);
						return stdout;
					}
					if (stderr) {
						console.log("error ->", stderr);
						return stderr;
					}
				})
		})

  console.log(`Errors -> ${errors.length ? errors : 'none'}`)
}

run()