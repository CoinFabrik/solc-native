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
var request = require("request");
var unzip = require("unzip");

var nativeCompilerFolder = path.resolve(__dirname, '../native_compiler');

createNativeSolcFolder().then(() => {
	return getLastestCompilerVersionUrl();
}).then((url) => {
	return downloadNativeCompiler(url);
}).then(() => {
	process.exit(0);
}).catch((err) => {
	console.log(err.toString());

	deleteNativeSolcFolder().then(() => {
		process.exit(1);
	});
});

//------------------------------------------------------------------------------

function createNativeSolcFolder()
{
	return new Promise((resolve, reject) => {
		fs.mkdir(nativeCompilerFolder, function (err) {
			if ((!err) || err.code == 'EEXIST') {
				resolve();
			}
			else {
				reject(err);
			}
		});
	});
}

//--------

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

//--------

function getLastestCompilerVersionUrl()
{
	return new Promise((resolve, reject) => {
		var package;

		if (process.platform == 'win32') {
			package = 'solidity-windows.zip';
		}
		else if (process.platform == 'linux') {
			package = 'solc-static-linux';
		}
		else {
			reject(new Error("Unsupported platform"));
		}
		request({
			url: "https://api.github.com/repos/ethereum/solidity/releases/latest",
			headers: {
				'User-Agent': 'Mozilla/4.0 (compatible; solc-native NodeJS module)'
			},
			json: true
		}, function (err, response, body) {
			if ((!err) && response.statusCode === 200 && typeof body === 'object') {
				var i, url;
	
				url = '';
				for (i = 0; i < body.assets.length; i++) {
					if (body.assets[i].name == package) {
						url = body.assets[i].browser_download_url;
						break;
					}
				}
				if (url.length > 0) {
					resolve(url);
				}
				else {
					reject(new Error("Not found"));
				}
			}
			else {
				if (!err)
					err = new Error('Unable to locate native compiler package');
				reject(err);
			}
		});
	});
}

function downloadNativeCompiler(url)
{
	return new Promise((resolve, reject) => {
		if (process.platform == 'win32') {
			request(url).pipe(unzip.Extract({
				path: nativeCompilerFolder
			})).on('close', function () {
				resolve();
			}).on('error', function (err) {
				reject(err);
			});
		}
		else if (process.platform == 'linux') {
			request(url, { encoding: 'binary' }, function(err, response, body) {
				if (!err) {
					fs.writeFile(nativeCompilerFolder + '/solc', body, 'binary', function (err) {
						if (!err) {
							fs.chmod(nativeCompilerFolder + '/solc', "755", function (err) {
								if (!err)
									resolve();
								else
									reject(err);
							});
						}
						else {
							reject(err);
						}
					});
				}
				else {
					reject(err);
				}
			});
		}
		else {
			reject(new Error("Unsupported platform"));
		}
	});
}
