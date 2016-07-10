# Easy to use TiddlyWiki 5 editions.

Just clone the repo into your lokal `wikilabs` directory. eg:

```
cd d:\
mkdir wikilabs
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
$env:TIDDLYWIKI_EDITIONS_PATH="LW:\your\full\path\editions"

eg:

$env:TIDDLYWIKI_EDITIONS_PATH="d:\wikilabs\editions"
```

It's possible to set several paths in the variable. eg:

```
$env:TIDDLYWIKI_EDITIONS_PATH="d:\wikilabs\editions;d:\pmario\editions"
```

HoTo set environment variables permanently [click this link](https://www.google.at/search?q=set+environment+variables+windows10)

## Usage

```
cd d:\test
mkdir editions

tiddlywiki editions/my-edition --init template-editions
```