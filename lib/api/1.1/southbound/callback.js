// Copyright 2016, DELL, Inc.

'use strict';

var di = require('di'),
	express = require('express'),
	parser = require('body-parser');

module.exports = DellWsmanCallbackRouter;
di.annotate(DellWsmanCallbackRouter, new di.Provide('Http.Api.Dell.Wsman.InventoryCallback'));
di.annotate(DellWsmanCallbackRouter, new di.Inject('Logger', 'Promise', 'Protocol.Events', '_'));

function DellWsmanCallbackRouter(Logger, Promise, eventsProtocol, _) {
    var logger = Logger.initialize(DellWsmanCallbackRouter);
    var router = express.Router();
    
        
    /**
     * @api {post} /api/1.1/callback/:identifier POST /:id
     * @apiVersion 1.1.0
     * @apiDescription Receive unique callback for wsman inventory request
     * @apiName callback
     * @apiGroup callback
     * @apiParam {String} request identifier
     * @apiError NotFound There is no request with the <code>identifier</code>
     * @apiErrorExample Error-Response:
     *     HTTP/1.1 404 Not Found
     *     {
     *       "error": "Not Found"
     *     }
     */
    router.post('/wsmanCallback/:identifier', function (req, res) {
        var name = req.body.options.defaults.type;
        var data = req.body.options.defaults;

    	if(name === null || _.isEmpty(name) || data === null || _.isEmpty(data)){
    		throw new Error('CALLBACK: Callback data is invalid.');
    	}
    	return Promise.resolve()
        .then(function() {
        	eventsProtocol.publishHttpResponseUuid(req.params.identifier, data);
        	res.status(200).end();
        }).catch(function(err) {
            logger.error("Error processing inventory callback.", {
                error: err,
                id: req.params.identifier
            });
        });
    });
    
    return router;
}
