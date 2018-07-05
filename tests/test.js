/**
 * [solc-native]{@link https://github.com/CoinFabrik/solc-native}
 *
 * @version 1.0.0
 * @author Mauro H. Leggieri
 * @copyright CoinFabrik, 2018
 * @license MIT
 */
var compiler = require("../index.js");
const path = require('path');
const fs = require('fs');

console.log("Compiler version: " + compiler.version());

compiler.compile({
	files : [
		__dirname + path.sep + 'SampleToken.sol'
	]
}).then((output, errors) => {
	var s = __dirname + path.sep + 'build';
	try {
		fs.mkdirSync(s);
	}
	catch (err)
	{ }
	try {
		fs.writeFileSync(s + path.sep + "output.json", JSON.stringify(output, null, 2));
	}
	catch (err)
	{
		console.log("Error while saving output: " + err.toString());
	}
}).catch((err) => {
	console.log("Error while compiling: " + err.toString());
})