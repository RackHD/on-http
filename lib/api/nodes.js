// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint node: true */
'use strict';

var di = require('di'),
    express = require('express'),
    parser = require('body-parser');

module.exports = nodesRouterFactory;

di.annotate(nodesRouterFactory, new di.Provide('Http.Api.Nodes'));
di.annotate(nodesRouterFactory, new di.Inject(
        'Services.Waterline',
        'Protocol.TaskGraphRunner',
        'common-api-presenter',
        'Services.Configuration',
        'Task.Services.OBM',
        'Logger',
        '_'
    )
);

function nodesRouterFactory (
    waterline,
    taskGraphProtocol,
    presenter,
    configuration,
    obmService,
    Logger,
    _
) {
    var router = express.Router();

    var logger = Logger.initialize(nodesRouterFactory);

    /**
     * @api {get} /api/1.1/nodes/ GET /
     * @apiVersion 1.1.0
     * @apiDescription get list of nodes
     * @apiName nodes-get
     * @apiGroup nodes
     * @apiSuccess {json} nodes List of all nodes or if there are none an empty object.
     */

    router.get('/nodes', presenter.middleware(function (req) {
        return waterline.nodes.find(req.query);
    }));


    /**
     * @api {post} /api/1.1/nodes/?identifiers= POST /
     * @apiVersion 1.1.0
     * @apiDescription create a node
     * @apiName nodes-post
     * @apiParam {String} identifiers Mac addresses and unique aliases to
     *                                         identify the node by
     * @apiParam {String[]} identifiers Mac addresses and unique aliases to
     *                                         identify the node by
     * @apiParam {String} profile Default profile to set for the node
     * @apiGroup nodes
     * @apiSuccess node the node that was created with the <code>identifiers</code>
     * @apiError E_VALIDATION <codeidentifiers</code> expect a string or an array of strings.
     * @apiErrorExample E_VALIDATION:
     * {
     *      "error": "E_VALIDATION",
     *      "status": 400,
     *      "summary": "1 attribute is invalid",
     *      "model": "nodes",
     *      "invalidAttributes": {
     *         "name": [
     *           {
     *               "rule": "string",
     *               "message":
     *                   "`undefined` should be a string (instead of \"null\", which is a object)"
     *           },
     *           {
     *              "rule": "required",
     *               "message": "\"required\" validation rule failed for input: null"
     *           }
     *        ]
     *    }
     * }
     */

    router.post('/nodes', parser.json(), presenter.middleware(function (req) {
        return waterline.nodes.create(req.body);
    }, { success: 201 }));


    /**
     * @api {get} /api/1.1/nodes/:identifier GET /:id
     * @apiVersion 1.1.0
     * @apiDescription get specific node details
     * @apiName node-get
     * @apiGroup nodes
     * @apiParam {String} identifier node identifier
     * @apiSuccess {json} node the nodes that have the <code>identifier</code>
     * @apiError NotFound The node with the <code>identifier</code> was not found.
     * @apiErrorExample {json} Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *      }
     */

    router.get('/nodes/:identifier', presenter.middleware(function (req) {
        return waterline.nodes.findByIdentifier(req.param('identifier'));
    }));


    /**
     * @api {patch} /api/1.1/nodes/:identifier PATCH /:id
     * @apiVersion 1.1.0
     * @apiDescription patch specific node details
     * @apiName node-patch
     * @apiGroup nodes
     * @apiParam {String} identifier node identifier
     * @apiSuccess {json} node the node that has the <code>identifier</code> that was patched
     * @apiError NotFound The node with the <code>identifier</code> was not found.
     * @apiErrorExample {json} Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *      }
     */

    router.patch('/nodes/:identifier', parser.json(), presenter.middleware(function (req) {
       return waterline.nodes.updateByIdentifier(
            req.param('identifier'),
            req.body
        );
    }));



    /**
     * @api {delete} /api/1.1/nodes/:identifier DELETE /:id
     * @apiVersion 1.1.0
     * @apiDescription Delete specific node details.
     * @apiName node-delete
     * @apiGroup nodes
     * @apiParam {String} identifier node identifier
     * @apiSuccess {json} node the node that has the <code>identifier</code> that was patched
     * @apiError NotFound The node with the <code>identifier</code> was not found.
     * @apiErrorExample {json} Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *      }
     */

    router.delete('/nodes/:identifier', presenter.middleware(function (req) {
        return waterline.nodes.destroyByIdentifier(
            req.param('identifier')
        ).then(function (node) {
            if (node) {
                return waterline.workitems.destroy({ node: node.id }).then(function () {
                    return node;
                });
            }
        });
    }));


    /**
     * @api {get} /api/1.1/nodes/:identifier/obm GET /:id/obm
     * @apiVersion 1.1.0
     * @apiDescription Get obm settings for specified node.
     * @apiName node-obm-get
     * @apiGroup nodes
     * @apiParam {String} identifier node identifier
     * @apiSuccess {json} obmSettings The list of ObmSettings that the node with
     *                    <code>identifier</code> has.
     * @apiError NotFound1 The node with the <code>identifier</code> was not found.
     * @apiError NotFound2 The node with the <code>identifier</code> does not have any ObmSettings.
     * @apiErrorExample {json} Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *      }
     */

    router.get('/nodes/:identifier/obm', presenter.middleware(function (req) {
        return waterline.nodes.findByIdentifier(req.param('identifier'))
        .then(function (node) {
            if (node) {
                return node.obmSettings;
            }
        });
    }));


    /**
     * @api {post} /api/1.1/nodes/:identifier/obm POST /:id/obm
     * @apiVersion 1.1.0
     * @apiDescription Set obm settings for specified node.
     * @apiName node-obm-post
     * @apiGroup nodes
     * @apiParam {String} identifier node identifier
     * @apiSuccess {json} node The updated node with <code>identifier</code> with
     *                    the added ObmSetting.
     * @apiError NotFound The node with the <code>identifier</code> was not found.
     * @apiErrorExample {json} Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *      }
     */

    router.post('/nodes/:identifier/obm', parser.json(), presenter.middleware(function (req) {
        return waterline.nodes.findByIdentifier(req.param('identifier'))
        .then(function (node) {
            if (node) {
                var obmSettings = node.obmSettings || [];
                obmSettings.push(req.body);
                return waterline.nodes.updateByIdentifier(
                    req.param('identifier'),
                    { obmSettings: obmSettings }
                );
            }
        });
    }, { success: 201 }));


    /**
     * @api {post} /api/1.1/nodes/:identifier/obm/identify POST /:id/obm/identify
     * @apiVersion 1.1.0
     * @apiDescription Enable or disable identify light on node through OBM (if supported)
     * @apiName node-obm-identify-post
     * @apiGroup nodes
     * @apiParam {String} identifier node identifier
     * @apiParam {boolean} posted object containing "value: true" or "value: false".
     * If not included, defaults to "false", which disables identify.
     * @apiError NotFound The node with the <code>identifier</code> was not found.
     * @apiErrorExample {json} Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *      }
     */

    router.post('/nodes/:identifier/obm/identify', parser.json(),
                presenter.middleware(function (req) {
        // TODO: Make this a taskGraph instead once we improve multiple task
        // graph handling per node.
        return waterline.nodes.findByIdentifier(req.param('identifier'))
        .then(function (node) {
            if (node) {
                if (req.body && req.body.value) {
                    return obmService.identifyOn(node.id);
                } else {
                    return obmService.identifyOff(node.id);
                }
            }
        });
    }));


    /**
     * @api {get} /api/1.1/nodes/:identifier/catalogs GET /:id/catalogs
     * @apiVersion 1.1.0
     * @apiDescription Get catalogs for specified node.
     * @apiName node-catalogs-get
     * @apiGroup nodes
     * @apiParam {String} identifier node identifier
     * @apiSuccess {json} catalogs all the catalogs or an empty obect if there are none.
     * @apiError NotFound The node with the <code>identifier</code> was not found.
     * @apiErrorExample {json} Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *      }
     */

    router.get('/nodes/:identifier/catalogs', presenter.middleware(function (req) {
        return waterline.nodes.findByIdentifier(req.param('identifier'))
        .populate('catalogs')
        .then(function (node) {
            if (node) {
                return node.catalogs;
            }
        });
    }));


    /**
     * @api {get} /api/1.1/nodes/:identifier/catalogs/:source GET /:id/catalogs/:source
     * @apiVersion 1.1.0
     * @apiDescription Get the latest catalogs for specified node.
     * @apiName node-catalogs-get-latest-source
     * @apiGroup nodes
     * @apiParam {String} identifier node identifier
     * @apiParam {String} source catalog source type
     * @apiSuccess {json} source The source information for the node with <code>identifier</code>.
     * @apiError NotFound1 The node with the <code>identifier</code> was not found.
     * @apiError NotFound2 The <code>source</code> was not found for the node.
     * @apiErrorExample {json} Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *      }
     */

    router.get('/nodes/:identifier/catalogs/:source', presenter.middleware(function (req, res) {
        return waterline.nodes.findByIdentifier(req.param('identifier'))
            .then(function(node) {
                if (node && node.id) {
                    return waterline.catalogs.findLatestCatalogOfSource(
                        node.id, req.param('source'));
                }
            })
            .catch(function(error) {
                logger.warning("Error searching for catalog " + req.param('source') +
                    " on node id " + req.param('identifier'), { error: error });
                res.status(404);
                return { 'error': 'Not Found' };
            });
    }));


    /**
     * @api {get} /api/1.1/nodes/:identifier/pollers GET /:id/pollers
     * @apiVersion 1.1.0
     * @apiDescription Get pollers for specified node.
     * @apiName node-pollers-get
     * @apiGroup nodes
     * @apiParam {String} identifier node identifier
     * @apiSuccess {json} pollers list the pollers or an empty object is there are none
     *                    for the node with <code>identifier</code>.
     * @apiError NotFound The node with the <code>identifier</code> was not found.
     * @apiErrorExample {json} Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *      }
     */

    router.get('/nodes/:identifier/pollers', presenter.middleware(function (req) {
        return waterline.nodes.findByIdentifier(req.param('identifier'))
        .then(function (node) {
            if (node) {
                return waterline.workitems.findPollers({ node: node.id });
            }
        });
    }, { serializer: 'poller' }));


    /**
     * @api {post} /api/1.1/nodes/:macaddress/dhcp/whitelist POST /:mac/dhcp/whitelist
     * @apiVersion 1.1.0
     * @apiDescription Post whitelist.
     * @apiName node-dhcp-whitelist-post
     * @apiGroup nodes
     * @apiParam {String} macaddress macaddress of node
     */

    router.post('/nodes/:macaddress/dhcp/whitelist', parser.json(), function(req, res) {
        // TODO: add this to DHCP protocol and send over that exchange
        var whitelist = configuration.get('whitelist') || [];
        whitelist.push(req.param('macaddress').replace(/:/g, '-'));
        configuration.set('whitelist', whitelist);
        res.status(201).end();
    });

    /**

     * @api {delete} /api/1.1/nodes/:macaddress/dhcp/whitelist DELETE /:mac/dhcp/whitelist
     * @apiVersion 1.1.0
     * @apiDescription Remove a whitelist of specified mac address
     * @apiName node-dhcp-whitelist-delete
     * @apiGroup nodes
     * @apiParam {String} macaddress macaddress of node
     */

    router.delete('/nodes/:macaddress/dhcp/whitelist', function(req, res) {
        // TODO: add this to DHCP protocol and send over that exchange
        var whitelist = configuration.get('whitelist');
        if (!whitelist || _.isEmpty(whitelist)) {
            res.status(204).end();
        } else {
            _.remove(whitelist, function(mac) {
                return mac === req.param('macaddress').replace(/:/g, '-');
            });
            configuration.set('whitelist', whitelist);
            res.status(204).end();
        }
    });

    /**
     * @api {get} /api/1.1/nodes/:identifier/workflows GET /:id/workflows
     * @apiVersion 1.1.0
     * @apiDescription Get workflows of node.
     * @apiName node-workflows-get
     * @apiGroup nodes
     * @apiParam {String} identifier of node
     * @apiSuccess {json} workflows the list of workflows or an empty object if
     *                    there isn't any for the node.
     * @apiError NotFound The node with the <code>identifier</code> was not found.
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */

    router.get('/nodes/:identifier/workflows', presenter.middleware(function (req) {
        //TODO(heckj) this is intended to show past workflows - not sure how
        // to do that with taskGraph Service
        return waterline.nodes.findByIdentifier(req.param('identifier'))
        .populate('workflows')
        .then(function (node) {
            if (node) {
                return node.workflows;
            }
        });
    }));


    /**
     * @api {post} /api/1.1/nodes/:identifier/workflows  POST /:id/workflows
     * @apiVersion 1.1.0
     * @apiDescription Create workflow for node.
     * @apiName node-workflows-post
     * @apiGroup nodes
     * @apiParam {String} identifier node identifier
     * @apiSuccess {json} workflow the workflow that was created
     * @apiError NotFound The node with the <code>identifier</code> was not found.
     * @apiError ErrorGraphName The Graph name does not exist.
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */

    router.post('/nodes/:identifier/workflows', parser.json(), presenter.middleware(function(req) {
        //TODO(heckj): how are we assigning a nodes to a workflow - through
        // options? Merge in req.param('identifier')?
        return waterline.nodes.findByIdentifier(req.param('identifier'))
        .then(function (node) {
            if (node) {
                return taskGraphProtocol.runTaskGraph(req.param('name'),
                    req.param('options') || {}, node.id);
            }
        });
    }, { success: 201 }));


    /**
     * @api {get} /api/1.1/nodes/:identifier/workflows/active GET /:id/workflows/active
     * @apiVersion 1.1.0
     * @apiDescription Fetch the  active workflow for the specified node
     * @apiName node-workflows-active-get
     * @apiGroup nodes
     * @apiParam {String} identifier node identifier
     * @apiSuccess {json} workflow  the active workflow for that node.
     * @apiError NotFound1 The node with the <code>identifier</code> was not found.
     * @apiError NotFound2 The node with the <code>identifier</code> does not have an
     *                     active workflow.
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */

    router.get('/nodes/:identifier/workflows/active', presenter.middleware(function (req) {
        return waterline.nodes.findByIdentifier(req.param('identifier'))
        .then(function (node) {
            if (node) {
                return taskGraphProtocol.getActiveTaskGraph( { target: node.id })
                .then(function (graph) {
                    if (graph) {
                        return waterline.graphobjects.findOne({ instanceId: graph.instanceId });
                    }
                });
            }
        });
    }));

    /**
     * @api {delete} /api/1.1/nodes/:identifier/workflows/active DELETE /:id/workflows/active
     * @apiVersion 1.1.0
     * @apiDescription delete the current active workflow for the specified node
     * @apiName node-workflows-active-delete
     * @apiGroup nodes
     * @apiParam {String} identifier node identifier
     * @apiSuccess {json} workflow  the deleted active workflow for that node.
     * @apiError NotFound1 The node with the <code>identifier</code> was not found.
     * @apiError NotFound2 The node with the <code>identifier</code> does not have an
     *                     active workflow.
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */

    router.delete('/nodes/:identifier/workflows/active', presenter.middleware(function (req) {
        return waterline.nodes.findByIdentifier(req.param('identifier'))
        .then(function (node) {
            if (node) {
                return taskGraphProtocol.cancelTaskGraph({ target: node.id });
            }
        });
    }));

    return router;
}
