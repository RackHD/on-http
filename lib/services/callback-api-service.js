// Copyright © 2017 Dell Inc. or its subsidiaries.  All Rights Reserved.

'use strict';

var di = require('di');

module.exports = CallbackApiServiceFactory;
di.annotate(CallbackApiServiceFactory, new di.Provide('Http.Services.Api.Callback'));
di.annotate(CallbackApiServiceFactory,
    new di.Inject(
        'Protocol.Events'
    )
);

function CallbackApiServiceFactory(
    eventsProtocol
) {

    function CallbackApiService() {
    }

    CallbackApiService.prototype.publishHttpCallbackData = function(id, data) {
        return eventsProtocol.publishHttpResponseUuid(id, data);
    };

    return new CallbackApiService();
}
