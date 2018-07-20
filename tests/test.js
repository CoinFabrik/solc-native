var compiler = require("../index.js");
const path = require('path');
const fs = require('fs');

console.log("Compiler version: " + compiler.version());

compiler.compile({
	files : [
		__dirname + path.sep + 'SampleToken.sol'
	]
}).then((ret) => {
	var s = __dirname + path.sep + 'build';
	try {
		fs.mkdirSync(s);
	}
	catch (err)
	{ }
	try {
		fs.writeFileSync(s + path.sep + "output.json", JSON.stringify(ret.output, null, 2));

		console.log("Compilation succeeded!");
	}
	catch (err)
	{
		console.log("Error while saving output: " + err.toString());
	}
}).catch((err) => {
	console.log("Error while compiling: " + err.toString());
})