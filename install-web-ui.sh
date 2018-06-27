# Copyright 2015-2017, Dell EMC, Inc.

cd ./static
rm -rf web-ui
githubUser=rackhd
repo=on-web-ui
curl --fail -L -o on-web-ui-gh-pages-2.0.zip https://github.com/${githubUser}/${repo}/archive/gh-pages-2.0.zip

if [ $? -ne 0 ]; then
    echo 'failed to download, retrying'
    curl --fail -L -o on-web-ui-gh-pages-2.0 https://github.com/${githubUser}/${repo}/archive/gh-pages-2.0.zip \
        || { echo "failed to download, exiting" && exit 1; }
fi

unzip on-web-ui-gh-pages-2.0.zip
rm on-web-ui-gh-pages-2.0.zip
mv on-web-ui-gh-pages-2.0 web-ui
