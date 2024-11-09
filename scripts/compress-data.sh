#!/bin/bash

set -eux

SCRIPT_PATH=$(realpath "${BASH_SOURCE[0]}")
SCRIPTS_DIR=$(dirname "$SCRIPT_PATH")
WORKING_DIR=$(dirname "$SCRIPTS_DIR")

gzip --stdout --keep $WORKING_DIR/data/jadwal-sholat.ajs > $WORKING_DIR/data/jadwal-sholat.ajs.gz
gzip --stdout --keep $WORKING_DIR/data/jadwal-sholat.json > $WORKING_DIR/data/jadwal-sholat.json.gz
