// Copyright 2016, EMC, Inc.

'use strict';

var yaml = require('js-yaml');
var fs = require('fs');
var pdf = require('html-pdf');
var path = require('path');

var swaggerFiles = [
    'static/monorail-2.0.yaml',
    'static/redfish.yaml'
];

swaggerFiles.forEach(function(currentFile) {
    generatePdf(currentFile);
});

function generatePdf(swaggerFile) {
    fs.readFile(swaggerFile, {encoding: 'utf8'}, function (err, swaggerData) {
        if (err) {
            return console.log(err);
        }

        var docDir = 'build/swagger-doc';
        var swaggerDef = yaml.safeLoad(swaggerData);
        var swaggerTitle = swaggerDef.info.title.replace(/ /g, '-');
        var workDir = docDir + swaggerTitle + swaggerDef.info.version;
        require('bootprint')
            .load(require('bootprint-swagger'))
            .build(swaggerFile, workDir)
            .generate()
            .done(function (data) {
                var html = fs.readFileSync(data[0], 'utf-8');
                var options = {
                    base: 'file://' + path.resolve(data[0]),
                    format: 'Letter'
                };
                var pdfFile = docDir +
                    '/rackhd-api-' +
                    swaggerTitle +
                    '-' +
                    swaggerDef.info.version +
                    '.pdf';

                pdf.create(html, options)
                    .toFile(pdfFile, function (err, res) {
                        if (err) {
                            return console.log(err);
                        }
                        console.log(res);
                    });
            });
    });
}
