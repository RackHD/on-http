"use strict";

var di = require('di');

di.annotate(factory, new di.Provide('Files.Base'));

module.exports = factory;

function factory() {

    function Backend(config) {
        this.config = config;
        return this;
    }

    Backend.prototype.get = function(query) {
        return;
    };

    Backend.prototype.put = function(query) {
        return;
    };

    Backend.prototype.list = function(query) {
        return;
    };

    Backend.prototype.delete = function(query) {
        return;
    };

    Backend.prototype.metadata = function() {
        return;
    };

    return Backend;
}
