# Copyright 2015, EMC, Inc.

cd ./static
rm -rf swagger-ui
curl --fail -L -o swagger-ui.zip https://github.com/rackhd/swagger-ui/archive/master.zip
if [ $? -ne 0 ]; then
    echo 'failed to download, retrying'
    curl --fail -L -o swagger-ui.zip https://github.com/rackhd/swagger-ui/archive/master.zip \
        || { echo "failed to download, exiting" && exit 1; }
fi
unzip swagger-ui.zip swagger-ui-master/dist* -d swagger-ui
mv swagger-ui/swagger-ui-master/dist/* swagger-ui
rm swagger-ui.zip
