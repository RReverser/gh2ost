var Promise = require('bluebird'),
	github = new (require('github'))({version: '3.0.0'}),
	whenPageRepos = Promise.promisify(github.repos.getAll),
	whenReadme = Promise.promisify(github.repos.getReadme),
	whenReadFile = Promise.promisify(require('fs').readFile),
	whenWriteFile = Promise.promisify(require('fs').writeFile);

function whenAllRepos(options) {
	var repos = [];
	options.page = 1;

	return whenPageRepos(options).then(function onPageRepos(pageRepos) {
		repos = repos.concat(pageRepos);

		if (pageRepos.length === options.per_page) {
			options.page++;
			return whenPageRepos(options).then(onPageRepos);
		}

		return repos;
	});
}

module.exports = function (options) {
	var minLength = options.minLength || 140,
		normalizeCodeBlocks = (
			options.langPrefix
			? function (readme) { return readme.replace(/^```(\w+)$/gm, '```' + options.langPrefix + '-$1') }
			: function (readme) { return readme }
		),
		userId = options.userId || 1;

	github.authenticate({
		type: 'basic',
		username: options.username,
		password: options.password
	});

	var whenRepos =
		// get public user's repos
		whenAllRepos({type: 'all', sort: 'created', direction: 'asc', per_page: 100})
		// filter out forks
		.filter(function (repo) {
			return !repo.fork;
		})
		// get readmes 
		.map(function (repo, id) {
			return whenReadme({user: repo.owner.login, repo: repo.name, ref: repo.default_branch}).then(function (readme) {
				repo.readme = new Buffer(readme.content, readme.encoding).toString();
				return repo;
			}, function (err) {
				return repo;
			});
		})
		// filter out repos without readmes or with very short readmes
		.filter(function (repo) {
			return repo.readme && repo.readme.length > minLength;
		});

	if (options.diff) {
		var whenReadExisting = whenReadFile(options.filename, 'utf-8').then(
			function (contents) { return JSON.parse(contents).data.posts.map(function (post) { return post.id }) },
			function () { return [] }
		);

		whenRepos = Promise.props({
			repos: whenRepos,
			existing: whenReadExisting
		}).then(function (data) {
			return data.repos.filter(function (repo) {
				return data.existing.indexOf(repo.id) < 0;
			});
		});
	}

	// convert repos to Ghost post structures
	var whenPosts = whenRepos.map(function (repo) {
		return {
			id: repo.id,
			title: (repo.description.length >= repo.name.length && repo.description.length < 140) ? repo.description : repo.name,
			slug: 'gh-' + repo.name.toLowerCase(),
			markdown: '[View on GitHub](' + repo.html_url + ')\n\n' + normalizeCodeBlocks(repo.readme).replace(/\r\n/g, '\n').replace(/^\n*((#.*?)|(.*?\n=+))\n+/, ''),
			status: repo.private ? 'draft' : 'published',
			author_id: userId,
			created_at: new Date(repo.created_at).valueOf(),
			created_by: userId,
			updated_at: new Date(repo.updated_at).valueOf(),
			updated_by: userId,
			published_at: new Date(repo.pushed_at).valueOf(),
			published_by: userId
		};
	});

	// collect languages as tags
	var whenTags = whenRepos.reduce(function (acc, repo) {
		var lang = repo.language;

		if (!lang) {
			return acc;
		}

		if (lang in acc.hash) {
			repo.tagId = acc.hash[lang].id;
			return acc;
		}

		repo.tagId = acc.array.length + 1;

		acc.array.push(acc.hash[lang] = {
			id: repo.tagId,
			name: lang,
			slug: lang.replace(/#/g, '-sharp').replace(/\+/g, '-plus').toLowerCase(),
			description: ''
		});

		return acc;
	}, {hash: {}, array: []}).then(function (acc) {
		return acc.array;
	});

	// flatten repo->language mappings as posts<->tags mapping array
	var whenPostsTags = Promise.props({
		repos: whenRepos,
		tags: whenTags
	}).then(function (acc) {
		return acc.repos.filter(function (repo) { return repo.tagId }).map(function (repo) {
			return {
				tag_id: repo.tagId,
				post_id: repo.id
			};
		});
	});

	// Gather everything into Ghost's structure
	return Promise.props({
		posts: whenPosts,
		tags: whenTags,
		posts_tags: whenPostsTags
	}).then(function (data) {
		var json = JSON.stringify({
			meta: {
				exported_on: Date.now(),
				version: '000'
			},
			data: data
		});

		// and save to given file
		return whenWriteFile(options.filename, json);
	});
};