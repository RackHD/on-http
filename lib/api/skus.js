// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node: true */
'use strict';

var di = require('di'),
    express = require('express'),
    parser = require('body-parser');

module.exports = skusRouterFactory;

di.annotate(skusRouterFactory, new di.Provide('Http.Api.Skus'));
di.annotate(skusRouterFactory, new di.Inject(
        'Services.Waterline',
        'common-api-presenter',
        '_',
        'Q',
        'Protocol.TaskGraphRunner'
    )
);

function skusRouterFactory (waterline, presenter, _, Q, taskGraphProtocol) {
    var router = express.Router();

    /**
     * @api {get} /api/common/skus/ GET /
     * @apiDescription get list of skus
     * @apiName skus-get
     * @apiGroup skus
     */

    router.get('/skus', presenter.middleware(function (req) {
        return waterline.skus.find(req.query);
    }));

    /**
     * @api {get} /api/common/skus/:identifier GET /:id
     * @apiDescription get specific sku details
     * @apiName sku-get
     * @apiGroup skus
     * @apiParam {String} identifier of sku, must cast to ObjectId
     */

    router.get('/skus/:identifier', presenter.middleware(function (req) {
        return waterline.skus.findByIdentifier(req.param('identifier'));
    }));

    /**
     * @api {get} /api/common/skus/:identifier/nodes GET /:id/nodes
     * @apiDescription get nodes for specific sku
     * @apiName sku-get-nodes
     * @apiGroup skus
     * @apiParam {String} identifier of sku, must cast to ObjectId
     */

    router.get('/skus/:identifier/nodes', presenter.middleware(function (req) {
        return waterline.skus.findByIdentifier(req.param('identifier')).then(function (sku) {
            return waterline.nodes.find({ sku: sku.id });
        });
    }));

    /**
     * @api {post} /api/common/skus POST /
     * @apiDescription create a sku
     * @apiName sku-post
     * @apiGroup skus
     */

    router.post('/skus', parser.json(), presenter.middleware(function (req) {
       return waterline.skus.create(req.body).then(function (sku) {
            return regenerateSkus().then(function () {
                return sku;
            });
        });
    }));

    /**
     * @api {patch} /api/common/skus/:identifier PATCH /:id
     * @apiDescription patch specific sku
     * @apiName sku-patch
     * @apiGroup skus
     * @apiParam {String} identifier of sku, must cast to ObjectId
     */

    router.patch('/skus/:identifier', parser.json(), presenter.middleware(function (req) {
       return waterline.skus.updateByIdentifier(
            req.param('identifier'),
            req.body
        ).then(function (sku) {
            return regenerateSkus().then(function () {
                return sku;
            });
        });
    }));

    /**
     * @api {delete} /api/common/skus/:identifier DELETE /:id
     * @apiDescription Delete specific sku.
     * @apiName sku-delete
     * @apiGroup skus
     * @apiParam {String} identifier of sku, must cast to ObjectId
     */

    router.delete('/skus/:identifier', presenter.middleware(function (req) {
        return waterline.skus.destroyByIdentifier(
            req.param('identifier')
        ).then(function (sku) {
            return regenerateSkus().then(function () {
                return sku;
            });
        });
    }, { success: 204}));

    function regenerateSkus() {
        return waterline.nodes.find({}).then(function (nodes) {
            return Q.all(nodes.map(function (node) {
                return taskGraphProtocol.runTaskGraph(
                    'Graph.GenerateSku',
                    { defaults: { nodeId: node.id }}
                );
            }));
        });
    }

    return router;
}
