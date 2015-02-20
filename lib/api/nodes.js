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
        'gridfs',
        'Task.Services.OBM',
        'Logger',
        'Tracer',
        '_'
    )
);

function nodesRouterFactory (
    waterline,
    taskGraphProtocol,
    presenter,
    configuration,
    gridfsService,
    obmService,
    Logger,
    _
) {
    var router = express.Router();

    var logger = Logger.initialize(nodesRouterFactory);

    /**
     * @api {get} /api/common/nodes/ GET /
     * @apiDescription get list of nodes
     * @apiName nodes-get
     * @apiGroup nodes
     */

    router.get('/nodes', presenter.middleware(function (req) {
        return waterline.nodes.find(req.query);
    }));

    /**
     * @api {post} /api/common/nodes/?identifiers= POST /
     * @apiDescription create a node
     * @apiName nodes-post
     * @apiParam {String} identifiers Mac addresses and unique aliases to
     *                                         identify the node by
     * @apiParam {String[]} identifiers Mac addresses and unique aliases to
     *                                         identify the node by
     * @apiParam {String} profile Default profile to set for the node
     * @apiGroup nodes
     */

    router.post('/nodes', parser.json(), presenter.middleware(function (req) {
        return waterline.nodes.create(req.body);
    }, { success: 201 }));

    /**
     * @api {get} /api/common/nodes/:identifier GET /:id
     * @apiDescription get specific node details
     * @apiName node-get
     * @apiGroup nodes
     * @apiParam {String} identifier node identifier
     */

    router.get('/nodes/:identifier', presenter.middleware(function (req) {
        return waterline.nodes.findByIdentifier(req.param('identifier'));
    }));

    /**
     * @api {patch} /api/common/nodes/:identifier PATCH /:id
     * @apiDescription patch specific node details
     * @apiName node-patch
     * @apiGroup nodes
     * @apiParam {String} identifier node identifier
     */

    router.patch('/nodes/:identifier', parser.json(), presenter.middleware(function (req) {
       return waterline.nodes.updateByIdentifier(
            req.param('identifier'),
            req.body
        );
    }));

    /**
     * @api {delete} /api/common/nodes/:identifier DELETE /:id
     * @apiDescription Delete specific node details.
     * @apiName node-delete
     * @apiGroup nodes
     * @apiParam {String} identifier node identifier
     */

    router.delete('/nodes/:identifier', presenter.middleware(function (req) {
        return waterline.nodes.destroyByIdentifier(
            req.param('identifier')
        ).then(function (nodes) {
            if (nodes.length) {
                return waterline.workitems.destroy({ node: nodes[0].id }).then(function () {
                    return nodes;
                });
            }
            return nodes;
        });
    }, { success: 204 }));

    /**
     * @api {get} /api/common/nodes/:identifier/obm GET /:id/obm
     * @apiDescription Get obm settings for specified node.
     * @apiName node-obm-get
     * @apiGroup nodes
     * @apiParam {String} identifier node identifier
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
     * @api {post} /api/common/nodes/:identifier/obm POST /:id/obm
     * @apiDescription Set obm settings for specified node.
     * @apiName node-obm-post
     * @apiGroup nodes
     * @apiParam {String} identifier node identifier
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
     * @api {post} /api/common/nodes/:identifier/obm/identify POST /:id/obm/identify
     * @apiDescription Enable or disable identify light on node through OBM (if supported)
     * @apiName node-obm-identify-post
     * @apiGroup nodes
     * @apiParam {String} identifier node identifier
     * @aprParam {} posted object containing "value: true" or "value: false".
     * If not included, defaults to "false", which disables identify.
     */

    router.post('/nodes/:identifier/obm/identify', parser.json(),
                presenter.middleware(function (req) {
        // TODO: Make this a taskGraph instead once we improve multiple task
        // graph handling per node.
        return waterline.nodes.findByIdentifier(req.param('identifier'))
        .then(function (node) {
            if (req.body && req.body.value) {
                return obmService.identifyOn(node.id);
            } else {
                return obmService.identifyOff(node.id);
            }
        });
    }, { success: 201 }));

    /**
     * @api {get} /api/common/nodes/:identifier/catalogs GET /:id/catalogs
     * @apiDescription Get catalogs for specified node.
     * @apiName node-catalogs-get
     * @apiGroup nodes
     * @apiParam {String} identifier node identifier
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
     * @api {get} /api/common/nodes/:identifier/catalogs/:source GET /:id/catalogs/:source
     * @apiDescription Get the latest catalogs for specified node.
     * @apiName node-catalogs-get-latest-source
     * @apiGroup nodes
     * @apiParam {String} identifier node identifier
     * * @apiParam {String} source catalog source type
     */

    router.get('/nodes/:identifier/catalogs/:source', presenter.middleware(function (req, res) {
        return waterline.nodes.findByIdentifier(req.param('identifier'))
            .then(function(node) {
                if (node && node.id) {
                    return waterline.catalogs.findLatestCatalogOfSource(node.id, req.param('source'));
                }
            })
            .then(function (catalogs) {
                if (catalogs) {
                    return catalogs[0];
                }
            }).catch(function(error) {
                logger.warning("Error searching for catalog " + req.param('source') +
                    " on node id " + req.param('identifier'), { error: error });
                res.status(404);
                return { 'error': 'Not Found' };
            });
    }));

    /**
     * @api {get} /api/common/nodes/:identifier/pollers GET /:id/pollers
     * @apiDescription Get pollers for specified node.
     * @apiName node-pollers-get
     * @apiGroup nodes
     * @apiParam {String} identifier node identifier
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
     * @api {post} /api/common/nodes/:macaddress/dhcp/whitelist POST /:mac/dhcp/whitelist
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
     * @api {delete} /api/common/nodes/:macaddress/dhcp/whitelist DELETE /:mac/dhcp/whitelist
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
     * @api {get} /api/common/nodes/:identifier/files GET /:identifier/files
     * @apiDescription get a file associated with a node :identifier
     * @apiName nodes-files-get
     * @apiGroup nodes
     * @apiParam {String} filename - identifier Name of file.
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Node identifier does not exist."
     *     }
     */

    router.get('/nodes/:identifier/files', function(req, res) {
        logger.debug("Received request for file ", {
            filename: req.param('filename'),
            identifier: req.param('identifier')
        });

        waterline.nodes.findByIdentifier(req.param('identifier'))
        .then(function(node) {
            if (!node) {
                res.status(404).json({
                    error: 'Node identifier does not exist.'
                });
                return;
            }
            var query = {
                nodeId: node.id,
                filename: req.param('filename')
            };

            return gridfsService.apiDownloadFile(res, query);
        })
        .fail(function(err) {
            logger.error("Error creating gridfs read stream: ", {
                identifier: req.param('identifier'),
                filename: req.param('filename'),
                error: err.stack
            });

            res.status(500).json({
                error: "Error retrieving file from the database."
            });
        });
    });

    /**
     * @api {put} /api/common/nodes/:identifier/files PUT /:identifier/files
     * @apiDescription put a file associated with a node :identifier
     * @apiName nodes-files-put
     * @apiGroup nodes
     * @apiParam {String} filename - identifier Name of file.
     * @apiSuccessExample Completed-Response:
     *     HTTP/1.1 201 Created
     * @apiError Error Any problem was encountered, file was not written.
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 500 Error
     *     {
     *       "error": "File upload failed."
     *     }
     */

    router.put('/nodes/:identifier/files', parser.json(), function(req, res) {
        logger.debug("Receiving file " +
            req.param('filename') + " from " + req.param('identifier'));

        waterline.nodes.findByIdentifier(req.param('identifier'))
        .then(function(node) {
            if (!node) {
                res.status(404).json({
                    error: 'Node identifier does not exist.'
                });
                return;
            }

            var query = {
                nodeId: node.id,
                filename: req.param('filename')
            };

            gridfsService.apiUploadFile(req, res, query);
        })
        .fail(function(error) {
            logger.error("Error creating gridfs write stream: ", {
                identifier: req.param('identifier'),
                filename: req.param('filename'),
                error: error.stack
            });
            res.status(500).json({
                error: "Error saving file to the database."
            });
        });
    });

    /**
     * @api {delete} /api/common/nodes/:identifier/files DELETE /:identifier/files
     * @apiDescription delete a file associated with a node :identifier
     * @apiName nodes-files-delete
     * @apiGroup nodes
     * @apiParam {String} filename - identifier Name of file.
     * @apiSuccessExample Completed-Response:
     *     HTTP/1.1 204 Deleted
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Error
     *     {
     *       "error": "Node identifier does not exist."
     *     }
     */

    router.delete('/nodes/:identifier/files', function(req, res) {
        logger.debug("Receiving file " + req.param('filename') + " from " +
            req.param('identifier'));

        waterline.nodes.findByIdentifier(req.param('identifier'))
        .then(function(node) {
            if (!node) {
                res.status(404).json({
                    error: 'Node identifier does not exist.'
                });
                return;
            }
            var query = {
                nodeId: node.id,
                filename: req.param('filename')
            };

            return gridfsService.apiDeleteFile(res, query);
        })
        .fail(function(error) {
            logger.error("Error removing file from gridfs: ", {
                identifier: req.param('identifier'),
                filename: req.param('filename'),
                error: error.stack
            });
            res.status(500).json({
                error: "Error deleting file from the database."
            });
        });
    });

    /**
     * @api {get} /api/common/nodes/:identifier/workflows GET /:id/workflows
     * @apiDescription Get workflows of node.
     * @apiName node-workflows-get
     * @apiGroup nodes
     * @apiParam {String} identifier of node
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
     * @api {post} /api/common/nodes/:identifier/workflows  POST /:id/workflows
     * @apiDescription Create workflow for node.
     * @apiName node-workflows-post
     * @apiGroup nodes
     * @apiParam {String} identifier of node, must cast to ObjectId
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
     * @api {get} /api/common/nodes/:identifier/workflows/active GET /:id/workflows/active
     * @apiDescription Fetch the  active workflow for the specified node
     * @apiName node-workflows-active-get
     * @apiGroup nodes
     * @apiParam {String} identifier of node, must cast to ObjectId
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
     * @api {delete} /api/common/nodes/:identifier/workflows/active DELETE /:id/workflows/active
     * @apiDescription delete the current active workflow for the specified node
     * @apiName node-workflows-active-delete
     * @apiGroup nodes
     * @apiParam {String} identifier of node, must cast to ObjectId
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
