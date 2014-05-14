var Promise = require('bluebird'),
	github = new (require('github'))({version: '3.0.0'}),
	whenPageRepos = Promise.promisify(github.repos.getAll),
	whenReadme = Promise.promisify(github.repos.getReadme),
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
	}).return(repos);
}

module.exports = function (options) {
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
				console.warn('%s has no readme.', repo.name);
				return repo;
			});
		})
		// filter out repos without readmes or with very short readmes
		.filter(function (repo) {
			return repo.readme && repo.readme.length > 140;
		});

	// convert repos to Ghost post structures
	var whenPosts = whenRepos.map(function (repo) {
		return {
			id: repo.id,
			title: (repo.description.length >= repo.name.length && repo.description.length < 140) ? repo.description : repo.name,
			slug: 'gh-' + repo.name,
			markdown: repo.readme.replace(/^```(\w+)$/gm, '```lang-$1'),
			status: repo.private ? 'draft' : 'published',
			author_id: 1,
			created_at: new Date(repo.created_at).valueOf(),
			created_by: 1,
			updated_at: new Date(repo.updated_at).valueOf(),
			updated_by: 1,
			published_at: new Date(repo.pushed_at).valueOf(),
			published_by: 1
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
			slug: lang.replace(/#/g, '-sharp').replace(/\+/g, '-plus'),
			description: '',
			created_at: repo.created_at
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