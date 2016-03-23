#!/bin/bash

# Ensure we're always in the right directory.
SCRIPT_DIR="$( cd "$( dirname "$0" )" && pwd )"
cd $SCRIPT_DIR/..

BRANCH=$(git symbolic-ref --short -q HEAD)

npm prune --production
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
