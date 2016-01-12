# Copyright 2015, EMC, Inc.

cd ./static

rm -rf web-ui
curl -L -o on-web-ui-gh-pages.zip https://github.com/RackHD/on-web-ui/archive/gh-pages.zip

unzip on-web-ui-gh-pages.zip
rm on-web-ui-gh-pages.zip
mv on-web-ui-gh-pages web-ui
