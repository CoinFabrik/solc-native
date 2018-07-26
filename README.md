# Solidity native compiler binding for NodeJS

This module is a wrapper for the native [Solidity compiler](https://github.com/ethereum/solidity). It uses the original compiler binary which is faster than the Emscripted counterpart.

### Install

```
$ npm install solc-native
```

### Usage

```
var compiler = require("solc-native");

var options = {
	//options
};

compile(options).then((result) => {
	//handle result.output and result.errors
}).catch((err) => {
	//handle errors
});
```

Where `options` is an object containing the following values:

* `file` : The filename of the source file to compile.
* `optimize` : A boolean value indicating if optimizer should be enabled or not. (optional, defaults to false)
* `optimize_runs` : The number of runs to use as optimization factor. (optional)

On success, the promise resolve callback will receive an object with two fields.

`output` contains the json data of all compiled contracts. I.e., if you compile [Open-Zeppelin's](https://github.com/OpenZeppelin/openzeppelin-solidity) SafeMath library, you can access the abi thru `output.SafeMath.abi`

`errors` an array of errors and warnings found while compiling the file. Each element contains the following fields:
+ `message` : The message explaining the error or warning.
+ `severity` : Error class. May be `error`, `warning` or other. Treat `error` as hard errors.
+ `source.file` : File containing the error. Can be an imported dependency. (optional)
+ `source.offset` : Offset inside the source file containing the error.

The promise reject callback will only be called only on hard errors like if native compiler binary is not found. Errors produced by bugs in source files are notified in the resolve callback.

### License

MIT
