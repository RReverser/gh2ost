gh2ost
======

> Convert Github readmes into Ghost blog posts

This tool converts readmes from your Github repositories into blog posts for [Ghost](https://ghost.org/) blogging system.

Also it automatically filters out repositories without readmes or with readmes less than 140 characters length (tweet-fit description are not blog posts, are they? :) ).

## Usage

Install globally with npm:

```bash
$ npm install -g gh2ost
```

Run executable and follow instructions :)

```bash
$ gh2ost
```

Now you got Ghost-compliant JSON file which you can import at [http://yourblog.com/ghost/debug/](#).

## License

This tool is issued under MIT license.