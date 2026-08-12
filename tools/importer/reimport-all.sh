#!/bin/bash
cd /backups/rrrragas/da-broadridge-cit/repo || exit 1
SDIR=/home/node/.excat-marketplaces/excat-marketplace/excat/skills/excat-content-import/scripts
run() {
  local name="$1"
  echo "### IMPORT $name ###"
  node "$SDIR/run-bulk-import.js" --import-script "tools/importer/import-$name.bundle.js" --urls "tools/importer/urls-$name.txt" 2>&1 \
    | grep -E "Saved|Completed|Success:|Failed"
}
run cit-landing
run cit-offerings
run cit-services
run broker-dealer-platform
run banks-and-trusts
run tpas-and-record-keepers
run financial-advisers
run about-us
run legal
run fund-detail
echo "### ALL DONE ###"
