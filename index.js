const path = require('path');
const child_proc = require('child_process');
var obj_hash = require('object-hash');

var compilerApp = null;
var compilerVersion = null;

//------------------------------------------------------------------------------

/**
 * Returns the current compiler version.
 */
module.exports.version = function ()
{
	if (compilerVersion === null) {
		try {
			var ret = launchCompiler([ '--version'], null);

			//parse output
			ret.out = splitCompilerOutput(ret.out);
			compilerVersion = '';
			for (let idx = 0; idx < ret.out.length; idx++) {
				if (ret.out[idx].substr(0, 8).toLowerCase() == 'version:') {
					compilerVersion = superTrim(ret.out[idx].substr(8));
					break;
				}
			}
		}
		catch (err) {
			compilerVersion = '';
		}
	}
	return compilerVersion;
}

/**
 * Compiles the provided files.
 * 
 * @param {object} options
 *   Settings for the compilation.
 *   @property {string|string[]} option.file          - Source file name to compile
 *   @property {boolean}         option.optimize      - Enable or disable compiler optimizations
 *   @property {number}          option.optimize_runs - When enabled, the number of runs to use as optimization factor
 */
module.exports.compile = function (options)
{
	return new Promise(async (resolve, reject) => {
		let i, output, errors, errorsHashMap;
		let input = {
			"language": "Solidity",
			"sources": { },
			"settings": {
				"optimizer": {
					"enabled": false,
					"runs": 0
				},
				"evmVersion": "byzantium",
				"metadata": {
					"useLiteralContent": true
				},
				"outputSelection": {
					"*": {
						"*": [ "metadata", "evm.bytecode", "evm.bytecode.sourceMap", "legacyAST" ]
					}
				}
			}
		};

		//verify options
		if (typeof options !== 'object') {
			reject(new Error('Supplied options are invalid.'));
			return;
		}

		//check optimizer options
		if (typeof options.optimize !== 'undefined') {
			if (options.optimize) {
				input.settings.optimizer.enabled = true;
			}

			if (typeof options.optimize_runs !== 'undefined') {
				if (typeof options.optimize_runs !== 'number' && (options.optimize_runs % 1) != 0 || options.optimize_runs < 0) {
					reject(new Error('Invalid optimizer run option.'));
					return;
				}

				input.settings.optimizer.runs = options.optimize_runs;
			}
		}

		//verify input files
		if (typeof options.file !== 'string' || options.file.length == 0) {
			reject(new Error('Invalid input file.'));
			return;
		}
		if (!path.isAbsolute(options.file)) {
			reject(new Error('Input filename must be an absolute path.'));
			return;
		}
		let filename = path.normalize(options.file);

		//prepare output
		output = {};
		errors = [];
		errorsHashMap = {};

		//compile file and build final json
		input.sources[filename] = {};
		input.sources[filename].urls = [ filename ];

		try {
			var json, ret;

			try {
				ret = await launchCompilerAsync([
					'--standard-json', '--allow-paths', path.parse(filename).root
				], {
					cwd: path.dirname(filename),
					input: JSON.stringify(input)
				});
			}
			catch (err) {
				reject(new Error("Unable to execute run compiler [" + err.toString() + "]"));
				return;
			}
			//we cannot trust in exit code because it returns non-zero if there is any warning
			if (ret.out.length == 0) {
				reject(new Error("Unexpected output while compiling '" + filename + "'."));
				return;
			}
			try {
				json = JSON.parse(ret.out);
			}
			catch (err) {
				reject(new Error("Unexpected output while compiling '" + filename + "'."));
				return;
			}

			//process contracts
			if (typeof json.contracts === 'object') {
				//process each file
				var contractFiles = Object.keys(json.contracts);
				for (var cf_idx = 0; cf_idx < contractFiles.length; cf_idx++) {
				
					var contractNames = Object.keys(json.contracts[contractFiles[cf_idx]]);
					//process each contract inside the file
					for (var cn_idx = 0; cn_idx < contractNames.length; cn_idx++) {
						var contract = json.contracts[contractFiles[cf_idx]][contractNames[cn_idx]];

						if (typeof contract.evm === 'object' && typeof contract.evm.bytecode === 'object' && typeof contract.evm.bytecode.object === 'string' && contract.evm.bytecode.object.length > 0) {
							//if we have a bytecode, then process this stream
							var bytecode = contract.evm.bytecode.object;
							var obj;

							//process link references
							if (typeof contract.evm.bytecode.linkReferences === 'object') {
								var refs = [];
								var metadata;

								//gather references
								Object.keys(contract.evm.bytecode.linkReferences).forEach(function(libraryFile) {
									var libFile = contract.evm.bytecode.linkReferences[libraryFile];
									Object.keys(libFile).forEach(function(libraryName) {
										var libName = libFile[libraryName];
										for (i = 0; i < libName.length; i++) {
											refs.push({
												name: libraryName,
												start: libName[i].start * 2,
												len: libName[i].length * 2
											})
										}
									});
								});

								//replace with nicer name
								for (i = 0; i < refs.length; i++) {
									var newLibName = '__' + refs[i].name.substr(0, refs[i].len < 36 ? refs[i].len : 36);
									newLibName += '_'.repeat(40 - newLibName.length);

									bytecode = bytecode.substr(0, refs[i].start) + newLibName + bytecode.substr(refs[i].start + refs[i].len);
								}
							}

							obj = {};
							obj.contractName = contractNames[cn_idx];
							obj.bytecode = bytecode;
							obj.compiler = {};
							obj.compiler.name = "solc";
							obj.compiler.version = module.exports.version();

							try {
								metadata = JSON.parse(contract.metadata);
							}
							catch (err) {
								reject(new Error("Unexpected output while compiling '" + filename + "'."));
								return;
							}

							if (typeof metadata.output !== 'object' || typeof metadata.output.abi !== 'object') {
								reject(new Error("Unexpected output while compiling '" + filename + "'."));
								return;
							}
							//add abi
							obj.abi = metadata.output.abi;

							//add devdoc and userdoc if present
							if (typeof metadata.output.devdoc === 'object') {
								obj.devdoc = metadata.output.devdoc;
							}
							if (typeof metadata.output.userdoc === 'object') {
								obj.userdoc = metadata.output.userdoc;
							}

							//store contract data
							output[contractNames[cn_idx]] = obj;
						}
					}
				}
			}
			if (typeof json.errors === 'object' && Object.prototype.toString.call(json.errors) == '[object Array]') {
				for (i = 0; i < json.errors.length; i++) {
					var err = {
						message: json.errors[i].formattedMessage,
						severity: json.errors[i].severity
					};
					if (typeof json.errors[i].sourceLocation === 'object') {
						if (typeof json.errors[i].sourceLocation.file === 'string') {
							err.source = {};
							err.source.file = json.errors[i].sourceLocation.file;

							if (typeof json.errors[i].sourceLocation.start === 'number') {
								err.source.offset = json.errors[i].sourceLocation.start;
							}
						}
					}
					var err_hash = obj_hash(err);

					//skip duplicated errors
					if (typeof errorsHashMap[err_hash] === 'undefined') {
						errors.push(err);
						errorsHashMap[err_hash] = true;
					}
				}
			}
		}
		catch (err) {
			reject(err);
			return;
		}

		resolve({
			output: output,
			errors: errors
		});
	});
}

//------------------------------------------------------------------------------

function getCompilerApp()
{
	if (!compilerApp) {
		compilerApp = path.resolve(__dirname, './native_compiler') + path.sep;
		if (process.platform == 'win32') {
			compilerApp += 'solc.exe';
		}
		else if (process.platform == 'linux') {
			compilerApp += 'solc';
		}
		else {
			throw new Error("Unsupported platform.");
		}
	}
	return compilerApp;
}

function launchCompiler(params, options)
{
	if (!params)
		params = [];
	try {
		var ret = {
			out: '',
			err: ''
		};
		if (!options)
			options = {};
		options = Object.assign({
				maxBuffer: 4 * 1048576,
				windowsHide: true,
				encoding: 'utf8'
			}, options);

		var inst = child_proc.spawnSync(getCompilerApp(), params, options);
		if (inst.error)
			throw inst.error;

		ret.out = inst.stdout;
		ret.err = inst.stderr;
		ret.exitcode = inst.status;
		return ret;
	}
	catch (err) {
		if (!(err instanceof Error))
			err = new Error(err.toString());
		throw err;
	}
}

function launchCompilerAsync(params, options)
{
	return new Promise((resolve, reject) => {
		let ret = {
			out: '',
			err: ''
		};
		let input = null;

		if (!params)
			params = [];
		if (!options)
			options = {};
		options = Object.assign({
				maxBuffer: 4 * 1048576,
				windowsHide: true,
				encoding: 'utf8'
			}, options);

		if (options.input) {
			input = options.input;
			delete options.input;
		}

		let inst = child_proc.spawn(getCompilerApp(), params, options);
		inst.stdout.on('data', (data) => {
			ret.out += data;
		});
		
		inst.stderr.on('data', (data) => {
			ret.err += data;
		});
		
		inst.on('close', (code) => {
			ret.exitcode = code;

			resolve(ret);
		});
		inst.on('error', (err) => {
			if (!(err instanceof Error))
				err = new Error(err.toString());
			reject(err);
		});

		inst.stdin.write(input);
		inst.stdin.end();
	});
}

function splitCompilerOutput(text)
{
	var i;

	text = text.split("\n");
	for (i = 0; i < text.length; i++)
		text[i] = text[i].replace(/[\x00-\x1F]/g, "");
	return text;
}

function superTrim(str)
{
	return str.replace(/^\s+|\s+$/gm,'');
}
