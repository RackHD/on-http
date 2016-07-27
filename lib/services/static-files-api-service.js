// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di');
var fs = require('fs');
var path = require('path');
var walking = require('walk');

module.exports = staticFilesApiServiceFactory;

di.annotate(staticFilesApiServiceFactory, new di.Provide('Http.Services.Api.StaticFiles'));
di.annotate(staticFilesApiServiceFactory,
    new di.Inject(
      'Constants',
      'Logger',
      'Promise',
      'Services.Configuration',
      'Services.Waterline'
    )
);


function staticFilesApiServiceFactory(
    constants,
    Logger,
    Promise,
    configuration,
    waterline
) {
    var logger = Logger.initialize(staticFilesApiServiceFactory);
    var skuPath = constants.HttpStaticDir.skupack;
    var staticPath = constants.HttpStaticDir.systemDefault;
    var userPath = constants.HttpStaticDir.userDefault;
    var walker;
    var walk = Promise.promisifyAll(walking);
    Promise.promisifyAll(fs);

    function StaticFilesApiService() {
    }


    StaticFilesApiService.prototype.pairSkupackIds = function() {
        return fs.readdirAsync(skuPath).filter(function(item) {
            return (fs.lstatAsync(path.join(skuPath, item)))
            .then(function(stat) {
                return stat.isDirectory();
            }); 
        }).reduce(function(result, item) {
            return Promise.try(function() {
                return waterline.skus.findOne({id : item})
                .then(function(sku) {
                    result[item] = sku.name;
                    return result;
                });
            })
            .catch(function(e) {
                logger.debug("Directory " + skuPath + "/" + item + " is not in the database",
                    e);
                return result;
            });
        },{}).then(function(pairs) {
            return pairs;
        });
    };


    StaticFilesApiService.prototype.walkDirectory = function(dir) {
        return new Promise(function(resolve, reject) {
            var walkResults = [];
            if (typeof dir !== 'string') {
                console.error("[ERROR] Object of type " + typeof dir + 
                    " was passed to walkDirectory where a string was expected.");
                resolve(walkResults);
            }
            walker = walk.walk(dir, {followLinks: false});

            walker.on("file", function(root, fileStats, next) {
                Promise.resolve().then(function() {
                    var walkObj = {};
                    if (root.indexOf(userPath) > -1){
                        root = root.replace(userPath, '');
                        walkObj.uri = path.join(root, fileStats.name);
                        walkResults.push(walkObj);
                    } else if (root.indexOf(staticPath) > -1){
                        var longPath = path.join(root, fileStats.name).split("/");
                        var httpIndex = longPath.indexOf("http") + 1;
                        walkObj.uri = longPath.slice(httpIndex).join("/");
                        walkResults.push(walkObj);
                    } else if ((root.indexOf(skuPath) > -1) && 
                        (root.indexOf("static") > -1)){
                        var filePath = path.join(root, fileStats.name).split("/");
                        var skuId = filePath[1];
                        var skuUri = filePath.slice(3).join("/");
                        walkObj.uri = skuUri;
                        walkObj.sku = skuId;
                        walkResults.push(walkObj);
                    }
                }).then(function() {
                    next();
                }).catch(function(e) {
                    reject(e);
                });
            });

            walker.on("errors", function(root, nodeStatsArray, next) {
                nodeStatsArray.forEach(function (n) {
                    console.error("[ERROR] " + n.name);
                    console.error(n.error.message || (n.error.code + ": " + n.error.path));
                });
                next();
            });

            walker.on("end", function() {
                resolve(walkResults);
            });
        });
    };


    StaticFilesApiService.prototype.getAllStaticFiles = function() {

        var self = this;
        var directories = [staticPath,
                           configuration.get('httpStaticRoot', userPath),
                           skuPath];

        return self.pairSkupackIds(directories).then(function(skuInfo) {       
            return [Promise.map(directories, self.walkDirectory), skuInfo];
        }).spread(function(paths, skuInfo) {
            var flattenedPaths = [].concat.apply([], paths);
            flattenedPaths.forEach(function(staticFile) {
                if ("sku" in staticFile) {
                    if (skuInfo.hasOwnProperty(staticFile.sku)) {
                        staticFile.sku = skuInfo[staticFile.sku];
                    } else {
                        delete staticFile.sku;
                    }
                }
            });
            return flattenedPaths;
        });
    };


    return new StaticFilesApiService();

}
