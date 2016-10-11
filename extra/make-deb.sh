#!/bin/bash
set -ex

# Ensure we're always in the right directory.
SCRIPT_DIR="$( cd "$( dirname "$0" )" && pwd )"
cd $SCRIPT_DIR/..

# Use the TRAVIS_BRANCH var if defined as travis vm
# doesn't run the git symbolic-ref command.
if [ -z "$TRAVIS_BRANCH" ]; then
   BRANCH=$(git symbolic-ref --short -q HEAD)
else
   BRANCH=${TRAVIS_BRANCH}
fi

# this appends a datestring formatting specifically to be increasing
# based on the last date of the commit in this branch to provide increasing
# DCH version numbers for building debian packages for bintray.
GITCOMMITDATE=$(git show -s --pretty="format:%ci")
DATESTRING=$(date -d "$GITCOMMITDATE" -u +"%Y%m%d%H%M%SZ")

BRANCH="${BRANCH}-${DATESTRING}"

npm prune --production

if [ -d swagger-codegen ]; then rm -rf swagger-codegen/; fi
git clone --branch v2.1.5 https://github.com/swagger-api/swagger-codegen.git
pushd ./swagger-codegen && mvn package && popd
java -jar ./swagger-codegen/modules/swagger-codegen-cli/target/swagger-codegen-cli.jar generate -i static/monorail.yml -o on-http-api1.1 -l python --additional-properties packageName=on_http_api1_1
java -jar ./swagger-codegen/modules/swagger-codegen-cli/target/swagger-codegen-cli.jar generate -i static/monorail-2.0.yaml -o on-http-api2.0 -l python --additional-properties packageName=on_http_api2_0
java -jar ./swagger-codegen/modules/swagger-codegen-cli/target/swagger-codegen-cli.jar generate -i static/redfish.yaml -o on-http-redfish-1.0 -l python --additional-properties packageName=on_http_redfish_1_0


./build-package.bash python-client "${BRANCH}" "on-http-api1.1"
./build-package.bash python-client "${BRANCH}" "on-http-api2.0"
./build-package.bash python-client "${BRANCH}" "on-http-redfish-1.0"
./build-package.bash on-http "${BRANCH}"
if [ -d deb ]; then rm -rf deb/; fi
mkdir deb && cp -a *.deb deb/
