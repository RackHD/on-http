# Copyright 2015-2017, Dell EMC, Inc.

cd ./static
rm -rf web-ui
version=$(curl https://raw.githubusercontent.com/rackhd/rackhd-ui-2.0/version/version)
curl --fail -L -o on-web-ui-gh-pages.zip https://github.com/rackhd/rackhd-ui-2.0/archive/${version}.zip

if [ $? -ne 0 ]; then
    echo 'failed to download, retrying'
    curl --fail -L -o on-web-ui-gh-pages.zip https://github.com/rackhd/rackhd-ui-2.0/archive/${version}.zip \
        || { echo "failed to download, exiting" && exit 1; }
fi

unzip on-web-ui-gh-pages.zip
rm on-web-ui-gh-pages.zip
mv rackhd-ui-2.0-${version} web-ui

pushd web-ui
npm install webpack-dev-server rimraf webpack -g
npm install
npm run build:aot
popd
