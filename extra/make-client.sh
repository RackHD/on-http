#!/bin/bash

# DESCRIPTION: This script is used to create a client library
#              of choice by the user and generate documentation.

# enable to fail on errors in script or failure to run any command
#set -e
# enable to see script debug output
#set -x

#changing directory to on-http
SCRIPT_DIR=$(cd $(dirname $0) && pwd)
pushd $SCRIPT_DIR/..

# help function to show usage of this script
# 1>&2 redirects stdout to stderr
help() { echo "Usage: $0 [-l <python | go | java>]" 1>&2; exit 0; }

# ensuring "-l" matches a client library to generate
# only takes "-l" as an arg
# requires language of choice after invoking "-l"
while getopts ":l:" opts; do
    case "${opts}" in
        l)
            CLIENT_LIB=${OPTARG}
            if [ "$CLIENT_LIB" == "python" ] || [ "$CLIENT_LIB" == "go" ] ||
               [ "$CLIENT_LIB" == "java" ] ; then
               echo "creating client library for $CLIENT_LIB"
            else
                help
            fi
            ;;
        \?)
            echo "Invalid option: -$OPTARG"
            exit 1
            ;;
        :)
            echo "Option -$OPTARG requires an argument"
            help
            exit 1
            ;;
    esac
done

#checking if $CLIENT_LIB string is empty
if [ -z $CLIENT_LIB ]; then
    help
fi

#removing existing on-http-api2.0 directory if it exists
if [ -d on-http-api2.0 ]; then
    echo "removing existing 2.0 api client library"
    rm -rf on-http-api2.0/;
fi

#removing existing on-http-redfish-1.0 directory if it exists
if [ -d on-http-redfish-1.0 ]; then
    echo "removing existing redfish client library"
    rm -rf on-http-redfish-1.0/;
fi

#removing existing swagger-codegen directory if it exists
if [ -d swagger-codegen ]; then
    echo "removing existing swagger-codegen directory"
    rm -rf swagger-codegen/;
fi

#if language chosen is go, use go-swagger to generate client library
if [ $CLIENT_LIB == "go" ]; then

#2.0 API Client Library
    mkdir on-http-api2.0 && pushd on-http-api2.0
    apt-get install jq
    LATESTV=$(curl -s https://api.github.com/repos/go-swagger/go-swagger/releases/latest | jq -r .tag_name)
    if [ -d swagger_linux_amd64 ]; then
        rm -rf swagger_linux_amd64
    fi
    wget https://github.com/go-swagger/go-swagger/releases/download/$LATESTV/swagger_linux_amd64
    chmod +x swagger_linux_amd64
    cp ../static/monorail-2.0.yaml .
    swagger generate client -f ./monorail-2.0.yaml -A on-http-api2.0
    popd

#Redfish API Client Library
    mkdir on-http-redfish-1.0 && pushd on-http-redfish-1.0
    LATESTV=$(curl -s https://api.github.com/repos/go-swagger/go-swagger/releases/latest | jq -r .tag_name)
    if [ -d swagger_linux_amd64 ]; then
        rm -rf swagger_linux_amd64
    fi
    wget https://github.com/go-swagger/go-swagger/releases/download/$LATESTV/swagger_linux_amd64
    chmod +x swagger_linux_amd64
    cp ../static/redfish.yaml .
    swagger generate client -f ./redfish.yaml -A on-http-redfish-1.0
    popd

#if not go, use swagger-codegen to generate client libraries
else
    git clone https://github.com/swagger-api/swagger-codegen
    pushd ./swagger-codegen && mvn package && popd

    echo "creating client library based on 2.0 api"
    VERSION=$(awk -F \" '/version: +"[0-9]+.[0-9]+.[0-9]+"/{print $2;exit}' static/monorail-2.0.yaml)
    java -jar ./swagger-codegen/modules/swagger-codegen-cli/target/swagger-codegen-cli.jar generate \
        -i static/monorail-2.0.yaml \
        -o on-http-api2.0 \
        -l $CLIENT_LIB \
        --additional-properties packageName=on_http_api2_0,packageVersion=${VERSION}

    echo "creating client library based on redfish api"
    VERSION=$(awk -F \" '/version: +"[0-9]+.[0-9]+.[0-9]+"/{print $2;exit}' static/redfish.yaml)
    java -jar ./swagger-codegen/modules/swagger-codegen-cli/target/swagger-codegen-cli.jar generate \
        -i static/redfish.yaml \
        -o on-http-redfish-1.0 \
        -l $CLIENT_LIB \
        --additional-properties packageName=on_http_redfish_1_0,packageVersion=${VERSION}
fi

popd