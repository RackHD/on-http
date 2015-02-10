"use strict";

var di = require('di'),
    Waterline = require('waterline'),
    disk = require('sails-disk'),
    util = require('util'),
    _ = require('lodash');

di.annotate(factory, new di.Provide('Files.Waterline'));
module.exports = factory;




var thing = {
    filename: 'name',
    uuid: 'blar',
    md5: 'foxyHash',
    sha: 'foxierHash'
};


function factory() {

    function FileWaterline() {
        this.service = new Waterline();

        return this;
    }
    util.inherits(FileWaterline, Waterline);
    FileWaterline.prototype.start = function() {
        var self = this;

        this.config = {
            adapters: {
                disk: disk
            },
            connections: {
                disk: {
                    adapter: 'disk'
                }
            }
        };


        var File = Waterline.Collection.extend({

            connection: 'disk',
            tableName: 'diskFiles',
            identity: 'Files',

            attributes: {

                basename: {
                    type: 'string',
                    required: true
                },

                filename: {
                    type: 'string',
                    required: true
                },

                uuid: {
                    type: 'string',
                    required: true
                },

                md5: {
                    type: 'string',
                    required: true
                },

                sha: {
                    type: 'string',
                    required: true
                },

                version: {
                    type: 'integer',
                    defaultsTo: 0
                },

                toJSON: function() {
                    var obj = this.toObject();
                    delete obj.id;
                    delete obj.createdAt;
                    delete obj.updatedAt;
                    return obj;
                }

            }

        });

        self.service.loadCollection(File);
        self.service.initialize(self.config, function(err, ontology) {
            _.forOwn(ontology.collections, function (collection, name) {
                self[name] = collection;
            });
        });

    };


    return FileWaterline;
}

