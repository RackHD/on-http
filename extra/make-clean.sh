#!/bin/sh

# Ensure we're always in the right directory.
SCRIPT_DIR="$( cd "$( dirname "$0" )" && pwd )"
cd $SCRIPT_DIR/..

rm -rf swagger-codegen
rm -rf *.deb deb/
rm -rf node_modules/
rm -rf coverage/
rm -rf test/
rm commitstring.txt
rm -rf on-http-api2.0/
rm -rf on-http-redfish-1.0/
rm -rf on-http*.tar.gz*
rm -rf *.build
rm -rf packagebuild/
rm -rf python-on-http*
