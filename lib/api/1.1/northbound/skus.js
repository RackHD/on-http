// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express'),
    parser = require('body-parser'),
    zlib = require('zlib'),
    tar = require('tar'),
    path = require('path');

module.exports = skusRouterFactory;

di.annotate(skusRouterFactory, new di.Provide('Http.Api.Skus'));
di.annotate(skusRouterFactory, new di.Inject(
        'Services.Waterline',
        'Http.Services.RestApi',
        'Http.Services.Api.Workflows',
        '_',
        'Promise',
        'uuid',
        'Http.Services.SkuPack',
        'osTmpdir',
        'rimraf'
    )
);

function skusRouterFactory (
    waterline,
    rest,
    workflowApiService,
    _,
    Promise,
    uuid,
    skuPack,
    tmp,
    rimraf
) {
    var router = express.Router();
    var rimrafAsync = Promise.promisify(rimraf);

    /**
     * @api {get} /api/1.1/skus/ GET /
     * @apiVersion 1.1.0
     * @apiDescription get list of skus
     * @apiName skus-get
     * @apiGroup skus
     * @apiSuccess {json} skus a list of all skus, or an empty object if there are none.
     */

    router.get('/skus', rest(function (req) {
        return waterline.skus.find(req.query);
    }));

    /**
     * @api {get} /api/1.1/skus/:identifier GET /:id
     * @apiVersion 1.1.0
     * @apiDescription get specific sku details
     * @apiName sku-get
     * @apiGroup skus
     * @apiParam {String} identifier of sku, must cast to ObjectId
     * @apiError NotFound There is no sku with the <code>identifier</code>
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */

    router.get('/skus/:identifier', rest(function (req) {
        return Promise.all([
            waterline.skus.needByIdentifier(req.params.identifier),
            skuPack.getPackInfo(req.params.identifier)
        ]).spread(function(sku, pack) {
            sku.packInfo = pack;
            return sku;
        });
    }));

    /**
     * @api {get} /api/1.1/skus/:identifier/nodes GET /:id/nodes
     * @apiVersion 1.1.0
     * @apiDescription get nodes for specific sku
     * @apiName sku-get-nodes
     * @apiGroup skus
     * @apiParam {String} identifier of sku, must cast to ObjectId
     * @apiError NotFound There is no sku with the <code>identifier</code>
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */

    router.get('/skus/:identifier/nodes', rest(function (req) {
        return waterline.skus.needByIdentifier(req.params.identifier).then(function (sku) {
            return waterline.nodes.find({ sku: sku.id });
        });
    }));

    /**
     * @api {post} /api/1.1/skus POST /
     * @apiVersion 1.1.0
     * @apiDescription create a sku
     * @apiName sku-post
     * @apiGroup skus
     * @apiError E_VALIDATION attributes are invalid.
     */

    router.post('/skus', parser.json(), rest(function (req) {
       return waterline.skus.create(req.body).then(function (sku) {
            return regenerateSkus().then(function () {
                return sku;
            });
        });
    }));

    /**
     * @api {post} /api/1.1/skus/pack POST /
     * @apiVersion 1.1.0
     * @apiDescription create a sku following the rules in the pack
     * @apiName sku-pack-put
     * @apiGroup skus
     * @apiError E_VALIDATION attributes are invalid.
     */

    router.post('/skus/pack', function(req, res) {
        skuPack.skuPackHandler(req,res)
        .then(function(obj) {
            res.status(201).json(obj);
        })
        .catch(function(e) {
            res.status(500).json({
                error: 'Failed to serve file request:' + e.message
            });
        });
    });

    /**
     * @api {patch} /api/1.1/skus/:identifier PATCH /:id
     * @apiVersion 1.1.0
     * @apiDescription patch specific sku
     * @apiName sku-patch
     * @apiGroup skus
     * @apiParam {String} identifier of sku, must cast to ObjectId
     * @apiError NotFound There is no sku with the <code>identifier</code>
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */

    router.patch('/skus/:identifier', parser.json(), rest(function (req) {
       return waterline.skus.updateByIdentifier(
            req.params.identifier,
            req.body
        ).then(function (sku) {
            return regenerateSkus().then(function () {
                return sku;
            });
        });
    }));

    /**
     * @api {put} /api/1.1/skus/:identifier/pack PUT /:id/pack
     * @apiVersion 1.1.0
     * @apiDescription post a sku pack to specific sku
     * @apiName sku-pack-id-put
     * @apiGroup skus
     * @apiParam {String} identifier of sku, must cast to ObjectId
     * @apiError NotFound There is no sku with the <code>identifier</code>
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 500 Internal Server Error
     *     {
     *       "error": "error message"
     *     }
     */

    router.put('/skus/:identifier/pack', function(req, res) {
        return waterline.skus.needByIdentifier(req.params.identifier)
            .then(function() {
                return skuPack.skuPackHandler(req,res,req.params.identifier);
            })
            .then(function(obj) {
                res.status(201).json(obj);
            })
            .catch(function(e) {
                res.status(500).json({
                    error: 'Failed to serve file request:' + e.message
                });
            });
    });

    /**
     * @api {delete} /api/1.1/skus/:identifier/pack DELETE /:id
     * @apiVersion 1.1.0
     * @apiDescription Delete a pack for a specific sku.
     * @apiName sku-delete-pack
     * @apiGroup skus
     * @apiParam {String} identifier of sku, must cast to ObjectId
     * @apiError NotFound There is no sku with the <code>identifier</code>
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */

    router.delete('/skus/:identifier/pack', function(req, res) {
        return waterline.skus.needByIdentifier(req.params.identifier)
            .then(function() {
                skuPack.deletePack(req.params.identifier);
            })
            .then(function() {
                res.status(204).end();
            })
            .catch(function() {
                res.status(500).json({
                    error: "Error removing package"
                });
            });
    });

    /**
     * @api {delete} /api/1.1/skus/:identifier DELETE /:id
     * @apiVersion 1.1.0
     * @apiDescription Delete specific sku.
     * @apiName sku-delete
     * @apiGroup skus
     * @apiParam {String} identifier of sku, must cast to ObjectId
     * @apiError NotFound There is no sku with the <code>identifier</code>
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */

    router.delete('/skus/:identifier', rest(function (req) {
        return waterline.skus.needByIdentifier(req.params.identifier)
        .then(function() {
            return skuPack.deletePack(req.params.identifier);
        })
        .then(function() {
            return waterline.skus.destroyByIdentifier(req.params.identifier)
            .then(function (sku) {
                return regenerateSkus().then(function () {
                    return sku;
                });
            });
        });
    }, { renderOptions: { success: 204 }}));

    function regenerateSkus() {
        return waterline.nodes.find({}).then(function (nodes) {
            return Promise.map(nodes, function (node) {
                return workflowApiService.createAndRunGraph({
                    name: 'Graph.GenerateSku',
                    options: {
                        defaults: {
                            nodeId: node.id
                        }
                    }
                });
            });
        });
    }

    return router;
}
