// Copyright 2016, EMC Inc.

'use strict';
var injector = require('../../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var _ = injector.get('_'); // jshint ignore:line
var   skuPack= injector.get('Http.Services.SkuPack');

/**
 * @api {get} /api/2.0/skus/ GET /
 * @apiVersion 2.0.0
 * @apiDescription get specific catalog details
 * @apiName skus-get
 * @apiGroup skus
 * @apiSuccess {json} skus a list of all skus, or an empty object if there are none
 */
var skusGet = controller(function (req) {
     return skuPack.getSkus(req.swagger.params.query.value);
});

/**
 * @api {get} /api/2.0/skus/:identifier GET /:id
 * @apiVersion 2.0.0
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
var skusIdGet = controller( function (req) {
    return   skuPack.getSkusById(req.swagger.params.identifier.value);
});

/**
 * @api {get} /api/2.0/skus/:identifier/nodes GET /:id/nodes
 * @apiVersion 2.0.0
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
var skusIdGetNodes = controller(function(req) {
    return   skuPack.getNodesSkusById(req.swagger.params.identifier.value);
});

/**
 * @api {post} /api/2.0/skus POST /
 * @apiVersion 2.0.0
 * @apiDescription create a sku
 * @apiName sku-post
 * @apiGroup skus
 * @apiError E_VALIDATION attributes are invalid.
 */
var skusPost = controller({success: 201}, function(req) {
    return   skuPack.postSku(req.swagger.params.body.value);
});

/**
 * @api {put} /api/2.0/skus PUT /
 * @apiVersion 2.0.0
 * @apiDescription upsert a sku
 * @apiName sku-put
 * @apiGroup skus
 * @apiError E_VALIDATION attributes are invalid.
 */
var skusPut = controller({success: 201}, function(req) {
    return   skuPack.upsertSku(req.swagger.params.body.value);
});

/**
 * @api {post} /api/2.0/skus/pack POST /
 * @apiVersion 2.0.0
 * @apiDescription create a sku following the rules in the pack
 * @apiName skupacks-post
 * @apiGroup skupacks
 * @apiError E_VALIDATION attributes are invalid.
 */
var skuPackPost = controller({success: 201}, function(req, res) {
    return   skuPack.skuPackHandler(req,res);
});

/**
 * @api {patch} /api/2.0/skus/:identifier PATCH /:id
 * @apiVersion 2.0.0
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
var skusPatch = controller( function (req) {
    return   skuPack.patchSku(req.swagger.params.identifier.value, req.swagger.params.body.value);
});

/**
 * @api {put} /api/2.0/skus/:identifier/pack PUT /:id/pack
 * @apiVersion 2.0.0
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
var skusIdPutPack = controller({success: 201}, function (req,res) {
    return   skuPack.putPackBySkuId(req,res);
});

/**
 * @api {delete} /api/2.0/skus/:identifier/pack DELETE /:id
 * @apiVersion 2.0.0
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
var skusIdDeletePack = controller({success: 204}, function (req) {
    return  skuPack.deleteSkuPackById(req.swagger.params.identifier.value);
});

/**
 * @api {delete} /api/2.0/skus/:identifier DELETE /:id
 * @apiVersion 2.0.0
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
var skusIdDelete = controller({success: 204}, function (req) {
    return   skuPack.deleteSkuById(req.swagger.params.identifier.value);
});


module.exports = {
    skusGet: skusGet,
    skusIdGet: skusIdGet,
    skusPost: skusPost,
    skusPut: skusPut,
    skusIdGetNodes: skusIdGetNodes,
    skuPackPost: skuPackPost,
    skusPatch: skusPatch,
    skusIdPutPack : skusIdPutPack,
    skusIdDeletePack: skusIdDeletePack,
    skusIdDelete: skusIdDelete
};
