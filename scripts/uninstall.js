/**
 * [solc-native]{@link https://github.com/CoinFabrik/solc-native}
 *
 * @version 1.0.0
 * @author Mauro H. Leggieri
 * @copyright CoinFabrik, 2018
 * @license MIT
 */
const path = require('path');
const fs = require('fs');

var nativeCompilerFolder = path.resolve(__dirname, '../native_compiler');

deleteNativeSolcFolder().then(() => {
	process.exit(0);
});

//------------------------------------------------------------------------------

function deleteNativeSolcFolder()
{
	return new Promise((resolve, reject) => {
		deleteFolder(nativeCompilerFolder);
		resolve();
	});
}

function deleteFolder(path)
{
	if (fs.existsSync(path)) {
		fs.readdirSync(path).forEach(function(file, index) {
			var curPath = path + "/" + file;
			if (fs.lstatSync(curPath).isDirectory()) { // recurse
				deleteFolder(curPath);
			}
			else {
				fs.unlinkSync(curPath);
			}
		});
		fs.rmdirSync(path);
	}
}
