var yaml = require('js-yaml');
var fs = require('fs');
var pdf = require('html-pdf');
var path = require('path');

fs.readFile('static/monorail-2.0.yaml', { encoding: 'utf8'}, function(err, swaggerData) {
    if (err) return console.log(err);

    var swaggerDef = yaml.safeLoad(swaggerData);
    require('bootprint')
    .load(require('bootprint-swagger'))
    .build('static/monorail-2.0.yaml', 'build/swagger-doc')
    .generate()
    .done(function(data) {
        var html = fs.readFileSync(data[0], 'utf-8');
        var options = {
            base: 'file://' + path.resolve(data[0]),
            format: 'Letter'
        };
        var pdfFile = 'build/swagger-doc/rackhd-api-' + swaggerDef.info.version + '.pdf';

        pdf.create(html, options)
        .toFile(pdfFile, function(err, res) {
            if (err) return console.log(err);
            console.log(res);
        });
    });
});
