'use strict';

var di = require('di');
di.annotate(factory, new di.Provide('Files.DB'));

function factory() {

}
