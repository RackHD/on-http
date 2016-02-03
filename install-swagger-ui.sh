# Copyright 2015, EMC, Inc.

cd ./static
rm -rf swagger-ui
curl -L -o swagger-ui.zip https://github.com/zyoung51/swagger-ui/archive/master.zip
unzip swagger-ui.zip swagger-ui-master/dist* -d swagger-ui
mv swagger-ui/swagger-ui-master/dist/* swagger-ui
rm swagger-ui.zip
