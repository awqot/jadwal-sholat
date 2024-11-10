#!/bin/bash

set -eux

SCRIPT_PATH=$(realpath "${BASH_SOURCE[0]}")
SCRIPTS_DIR=$(dirname "$SCRIPT_PATH")
WORKING_DIR=$(dirname "$SCRIPTS_DIR")

rm -rf $WORKING_DIR/dist

npx --package typescript tsc --project $WORKING_DIR/tsconfig.json
