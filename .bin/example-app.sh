#!/usr/bin/env bash

action="$1" # e.g. link, build, start
app="$2" # e.g. vue, svelte

APP_DIR="$PWD/examples/$app"
BUILD_TARGET="$PWD/examples/output/$app"
NPM_LINK_TARGET="$PWD/npm-packages/meteor-vite"
export METEOR_PACKAGE_DIRS="$PWD/packages"
export METEOR_VITE_TSUP_BUILD_WATCHER="true"

install() {
  cd "$APP_DIR" || exit 1
  meteor npm i
}

build() {
    (link)
    (cleanOutput)
    cd "$APP_DIR" || exit 1
    meteor build "$BUILD_TARGET" --directory
}

cleanOutput() {
  rm -rf "$BUILD_TARGET"
}

link() {
  cd "$APP_DIR" || exit 1
  meteor npm link "$NPM_LINK_TARGET"
}

start() {
  cd "$APP_DIR" || exit 1
  meteor npm run
}

set -x
"$action" || exit 1;