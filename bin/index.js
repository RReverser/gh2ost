var Promise = require('bluebird'),
	read = require('read'),
	whenRead = function (options) {
		var defer = Promise.defer();
		
		read(options, function (err, input) {
			defer.callback(err, input);
		});
		
		return defer.promise;
	},
	whenUsername = whenRead({prompt: 'Github username: '}),
	whenPassword = whenUsername.then(function () {
		return whenRead({prompt: 'Github password: ', silent: true, replace: '*'});
	}),
	whenFilename = whenPassword.then(function () {
		return whenRead({prompt: 'Save to: ', default: 'export.json', edit: true});
	});

Promise.props({
	username: whenUsername,
	password: whenPassword,
	filename: whenFilename
})
.then(function (options) {
	console.log('Fetching data...');
	return options;
})
.then(require('..'))
.then(function () {
	console.log('Finished successfully!');
});