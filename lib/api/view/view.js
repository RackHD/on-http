// Copyright 2015, EMC, Inc.
var di = require('di');

'use strict';

module.exports = viewServiceFactory;

di.annotate(viewServiceFactory, new di.Provide('Views'));
di.annotate(viewServiceFactory, new di.Inject(
        'Constants',
        'DbRenderableContent',
        'Util'
));

function viewServiceFactory(Constants, DbRenderable, Util) {
    Util.inherits(ViewService, DbRenderable);

    function ViewService() {
        DbRenderable.call(this, {
            directory: Constants.Views.Directory,
            collectionName: 'views'
        });
    }

    return new ViewService();
}

