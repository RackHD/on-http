# Copyright 2017, Dell EMC, Inc.

cd ./static

rm -rf web-ui
curl --fail -L -o on-web-ui-gh-pages.zip https://github.com/RackHD/on-web-ui/archive/gh-pages.zip

if [ $? -ne 0 ]; then
    echo 'failed to download, retrying'
    curl --fail -L -o on-web-ui-gh-pages.zip https://github.com/RackHD/on-web-ui/archive/gh-pages.zip \
        || { echo "failed to download, exiting" && exit 1; }
fi

unzip on-web-ui-gh-pages.zip
rm on-web-ui-gh-pages.zip
mv on-web-ui-gh-pages web-ui
