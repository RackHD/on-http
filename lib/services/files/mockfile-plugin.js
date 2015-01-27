"use strict";

var di = require('di'),
    stream = require('stream'),
    _ = require('lodash');

di.annotate(factory, new di.Provide('Files.Mock'));
di.annotate(factory, new di.Inject('Q'));
module.exports = factory;

function factory(q) {

    function PseudoManager(config) {
        var self = this;
        this.writableString = '';
        this.readableString = 'this is the test string';

        this.config = config;
        this.mockRdStream = new stream.Readable();
        this.mockWrStream = new stream.Writable();


        this.mockRdStream._read = function() {
            this.push(self.readableString);
            this.push(null);
        };

        this.mockWrStream._write = function(chunk, encoding, done) {
            this.writableString += chunk.toString();
            done();
        };

        this.metadata = {};

        this.fileList = ['fake.txt', 'unreal.txt', 'faux.txt'];

        return this;
    }

    PseudoManager.prototype.get = function(query) {
        return (_.contains(this.fileList, query)) ?
            q.resolve(this.mockRdStream) : q.reject('file not found');
    };

    PseudoManager.prototype.put = function(query) {
        var self = this;

        this.mockWrStream.on('metadata', function(meta){
            self.metadata = meta;
        });

        return !(_.contains(this.fileList, query)) ?
            q.resolve(this.mockWrStream) : q.reject('file already exists');
    };

    PseudoManager.prototype.delete = function(query) {
         return (_.contains(this.fileList, query)) ?
             q.resolve('file deleted') : q.reject('file not found');
    };

    PseudoManager.prototype.getMeta = function(query) {
        return query ? q.resolve(this.metadata) : q.reject('file not found');
    };

    PseudoManager.prototype.list = function() {
        return q.resolve(this.fileList);
    };

    return PseudoManager;
}
