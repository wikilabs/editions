# Easy to use TiddlyWiki 5 editions.

Just clone the repo into your lokal `wikilabs` directory. eg:

```
cd d:\
mkdir wikilabs
cd wikilabs
git clone https://github.com/wikilabs/editions.git
```


## Preparations for TiddlyWiki

Set your environment variables, so tiddlywiki command line can find them.

windows: list existing variables


```
ls env:

or

ls env: | findstr  TIDDLY
```

windows: temporarily set variables for one session

```
$env:TIDDLYWIKI_EDITION_PATH="LW:\your\full\path\editions"

eg:

$env:TIDDLYWIKI_EDITION_PATH="d:\wikilabs\editions"
```

It's possible to set several paths in the variable. eg:

```
$env:TIDDLYWIKI_EDITION_PATH="d:\wikilabs\editions;d:\pmario\editions"
```

HoTo set environment variables permanently [click this link](https://www.google.at/search?q=set+environment+variables+windows10)

To see, if tiddlywiki can see them, `tiddlywiki --editions | findstr template` should return something similar to this:

```
PS D:\wikilabs> tiddlywiki --editions | findstr template

    edition-template: Edition Boilerplate - CHANGE THIS!
    plugin-template: Plugin Boilerplate - read the text!```


## Usage

```
mkdir d:\test
cd d:\test
mkdir editions

tiddlywiki editions/my-edition --init template-editions
```

Start your favorite editor and happy hacking!

have fun!
mario