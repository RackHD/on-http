# Copyright 2016, EMC, Inc.

if [ ! -d './node_modules/on-tasks/' ]; then
    echo 'on-tasks folder not found, please run npm install.'
    exit 1
fi

# Generate task doc from task schemas
cd ./node_modules/on-tasks/
node task-annotation-generator.js

# Parse task doc data json to api_data.js so that it can be `require` by template
echo 'define({"api":' > api_data.js
cat task_doc_data.json >> api_data.js
echo '});' >> api_data.js

cd ../../
# Copy templates from apidoc, taskdoc leverage apidoc templates for html rendering
cp -rf ./node_modules/apidoc/template/* ./static/taskdoc/

# Copy generated json file to ./static folder, override existing files
mv -f ./node_modules/on-tasks/api_data.js ./static/taskdoc
mv -f ./node_modules/on-tasks/task_doc_data.json ./static/taskdoc/api_data.json
