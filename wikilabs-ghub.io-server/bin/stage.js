var fs = require('fs')
var resolve = require('path').resolve
var join = require('path').join
var cp = require('child_process')

// get library path
var lib = resolve(__dirname, '../../')

fs.readdirSync(lib)
  .forEach(function (mod) {
    var modPath = join(lib, mod)

    // ensure path has package.json
    if (!fs.existsSync(join(modPath, 'package.json'))) return

    // check if batch processing should be skipped
    if (fs.existsSync(join(modPath, 'skip-stage'))) return

    // install folder
    cp.exec('npm run stage', { env: process.env, cwd: modPath}, (e, stdout, stderr)=> {
        if (e instanceof Error) {
            console.error(e);
            throw e;
        }

        if (stdout) console.log('finished: ', stdout);
        if (stderr) console.log('error ', stderr);
    })
})
