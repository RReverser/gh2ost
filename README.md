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

Run executable with optional parameters...

```bash
$ gh2ost --help

  Usage: gh2ost [--min-length 140] [--lang-prefix (none by default)] [--user-id 1] [filename]

  Options:

    -h, --help                  output usage information
    -V, --version               output the version number
    -m, --min-length <length>   Minimal length for READMEs markdowns to be considered as posts.
    -p, --lang-prefix <prefix>  ```<prefix>-[lang name] for code blocks to be used (i.e., "lang" for Prism)
    -u, --user-id <id>          Ghost User ID
```

...and enter credentials when requested.

```
Github username: RReverser
Github password: ********
```

Now you got Ghost-compliant JSON file which you can import at [http://yourblog.com/ghost/debug/](#).

## License

This tool is issued under MIT license.