// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Services.Http.Swagger.Serdes', function() {
    var bagpipes;
    var context;
    var nextStub = sinon.stub();
    var swaggerSerDes;
    var fittingDef;

    beforeEach('setup serdes test', function() {
        bagpipes = {
            config: {
                swaggerNodeRunner: {
                    config: {
                        swagger: {
                            appRoot: "."
                        }
                    }
                }
            }
        };

        context = {
            request: {
                swagger: {
                    operation: {
                        nameKey: 'mock',
                        operationId: "mockPost"

                    }
                },
                data: "hi"
            },
            response: {}
        };

        swaggerSerDes = require("../../../lib/fittings/swagger_serdes");

        fittingDef = {
            serdesDirs: ["lib/api/serdes"],
            serdesNameKey: "nameKey"
        };

        nextStub.reset();
    });

    it ('should test mock serdes', function () {
            var serdes = swaggerSerDes(fittingDef, bagpipes);
            serdes(context, nextStub);

            expect(context.response.data).to.equal(context.request.data);
            expect(nextStub).to.be.called.once;
            context.response.data = {};
            // call again to see if the cached version is used
            serdes(context, nextStub);
            expect(nextStub).to.be.called.twice;
            expect(context.response.data).to.equal(context.request.data);


    });
    it ('should test no serdes', function () {

        fittingDef.serdesKey = "notFound";

        var serdes = swaggerSerDes(fittingDef, bagpipes);
        serdes(context, nextStub);
        //expect.next.calledOnce();
        expect(nextStub).to.be.called.once;
    });
    it ('should test no bad serdes path', function () {

        fittingDef.serdesDirs = ["lib/api/serdesNotFound"];

        var serdes = swaggerSerDes(fittingDef, bagpipes);
        serdes(context, nextStub);
        expect(nextStub).to.be.called.once;
    });
});
