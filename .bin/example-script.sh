#!/usr/bin/env bash

action="$1" # e.g. link, build, start
app="$2" # e.g. vue, svelte

APP_DIR="./examples/$app"
BUILD_TARGET="$PWD/examples/output/$app"
NPM_LINK_TARGET="$PWD/npm-packages/meteor-vite"
export METEOR_PACKAGE_DIRS="$PWD/packages"
export BUILD_METEOR_VITE_DEPENDENCY="true"

build() {
    cd "$APP_DIR" || exit 1
    meteor build "$BUILD_TARGET" --directory
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