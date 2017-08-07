// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Services.Http.Swagger', function() {
    var swaggerService;
    var Promise;
    var views;
    function MockSerializable() {}
    function MockSchemaService() {}
    var mockWaterlineService = {
        test: {}
    };
    var taskProtocol = {activeTaskExists: sinon.stub().resolves({taskId: 'taskid'})}; 

    before('inject swagger service', function() {
        helper.setupInjector(_.flattenDeep([
                onHttpContext.prerequisiteInjectables,
                onHttpContext.injectables,
                dihelper.simpleWrapper(MockSerializable, 'Mock.Serializable'),
                dihelper.simpleWrapper(new MockSchemaService(), 'Http.Api.Services.Schema'),
                dihelper.simpleWrapper(mockWaterlineService, 'Services.Waterline'),
                dihelper.simpleWrapper(taskProtocol, 'Protocol.Task')
            ])
        );

        swaggerService = helper.injector.get('Http.Services.Swagger');
        views = helper.injector.get('Views');
        Promise = helper.injector.get('Promise');
        this.sandbox = sinon.sandbox.create();
    });

    describe('controller()', function() {
        var mockNext;
        var mockController;
        var controller;

        beforeEach(function() {
            mockNext = sinon.stub();
            mockController = sinon.stub();
            controller = swaggerService.controller(mockController);
        });

        it('should call controller callback', function() {
            var req = {
                swagger: {
                    params: {
                        sort: {
                        }
                    }
                },
                query: {}
            };
            var res = {
                headersSent: false
            };
            var mockData = {data: 'mock data'};

            expect(controller).to.be.a('function');
            mockController.resolves(mockData);
            return controller(req, res, mockNext).then(function() {
                expect(res.body).to.equal(mockData);
                expect(mockNext).to.be.called.once;
            });
        });

        it('should process options', function() {
            var req = {
                swagger: {
                    params: {
                        sort: {
                        }
                    }
                },
                query: {}
            };

            var res = {
                headersSent: false
            };
            var mockData = {data: 'mock data'};
            var optController = swaggerService.controller({success: 201}, mockController);

            expect(optController).to.be.a('function');
            mockController.resolves(mockData);
            return optController(req, res, mockNext).then(function() {
                expect(res.body).to.equal(mockData);
                expect(mockNext).to.be.called.once;
                expect(req.swagger.options).to.have.property('success')
                    .and.to.equal(201);
            });
        });

        it('should process query', function() {
            var req = {
                query: {},
                swagger: {
                    params: {
                        sort: {
                        },
                        firstName: {
                            parameterObject: {
                                in: 'query',
                                type: 'string',
                                definition: { name: 'firstName' }
                            },
                            value: 'Rack'
                        },
                        lastName: {
                            parameterObject: {
                                in: 'query',
                                type: 'string',
                                definition: { name: 'lastName' }
                            },
                            value: 'HD'
                        },
                        undefinedName: {
                            parameterObject: {
                                in: 'query',
                                type: 'string',
                                definition: { name: 'undefinedName' }
                            },
                            value: undefined
                        },
                        inBody: {
                            parameterObject: {
                                in: 'body',
                                type: 'string',
                            },
                            value: 'not a query'
                        }
                    }
                }
            };
            var res = {
                headersSent: false
            };
            var mockData = {data: 'mock data'};
            var optController = swaggerService.controller(mockController);

            expect(optController).to.be.a('function');
            mockController.resolves(mockData);
            return optController(req, res, mockNext).then(function() {
                expect(res.body).to.equal(mockData);
                expect(mockNext).to.be.called.once;
                expect(req.swagger.query).to.have.property('firstName')
                    .and.to.equal('Rack');
                expect(req.swagger.query).to.have.property('lastName')
                    .and.to.equal('HD');
                expect(req.swagger.query).not.to.have.property('inBody');
                expect(req.swagger.query).not.to.have.property('undefinedName');
            });
        });

        it('should process sort query', function() {
            var req = {
                query:{
                    sort:"id"
                },
                swagger: {
                    params: {
                        sort: {
                            raw: "id"
                        }
                    }
                }
            };
            var res = {
                headersSent: false
            };
            var mockData = [
                {
                    id: '1234',
                    name: 'dummy'
                },
                {
                    id: '5679',
                    name: 'dummy2'
                }];
            var optController = swaggerService.controller(mockController);

            expect(optController).to.be.a('function');
            mockController.resolves(mockData);
            return optController(req, res, mockNext).then(function() {
                expect(req.swagger.params.sort).to.have.property('raw');
                expect(res.body).to.deep.equal(mockData);
                expect(mockNext).to.be.called.once;

            });
        });

        it('should not process sort function, when not present', function() {
            var req = {
                query:{
                    id:"1234"
                },
                swagger: {
                    params: {
                        sort: {
                        }
                    }
                }
            };
            var res = {
                headersSent: false
            };
            var mockData = [
                {
                    id: '1234',
                    name: 'dummy'
                }];
            var optController = swaggerService.controller(mockController);

            expect(optController).to.be.a('function');
            mockController.resolves(mockData);
            return optController(req, res, mockNext).then(function() {
                expect(res.body).to.deep.equal(mockData);
                expect(mockNext).to.be.called.once;

            });
        });

        it('should not call next after sending headers', function() {
            var req = {
                swagger: {
                    params: {
                        sort: {
                        }
                    }
                },
                query: {}
            };

            var res = {
                headersSent: true
            };
            var mockData = {data: 'mock data'};

            expect(controller).to.be.a('function');
            mockController.resolves(mockData);
            return controller(req, res, mockNext).then(function() {
                expect(mockController).to.be.called.once;
                expect(mockNext).not.to.be.called;
            });
        });

        it('should call next if an error occurs', function() {
            var req = {
                swagger: {
                    params: {
                        sort: {
                        }
                    }
                },
                query: {}
            };

            var res = {
                headersSent: false
            };
            var mockError = new Error('mock error');

            expect(controller).to.be.a('function');
            mockController.rejects(mockError);
            return controller(req, res, mockNext).then(function() {
                expect(mockController).to.be.called.once;
                expect(mockNext).to.be.calledWith(mockError);
            });
        });
    });

    describe('validator()', function() {
        var mockNext;
        var validator;
        var mockData = { name: "123" };

        beforeEach(function() {
            mockNext = sinon.stub();
            MockSchemaService.prototype.addNamespace = sinon.stub();
            MockSchemaService.prototype.addNamespace.resolves('foo');
            MockSchemaService.prototype.validate = sinon.stub();
            validator = swaggerService.validator();
            expect(validator).to.be.a('function');
        });

        it('should skip validation if schema is undefined', function() {
            MockSchemaService.prototype.validate.resolves([]);
            validator(undefined, mockData, function() {
                expect(MockSchemaService.prototype.validate).not.to.be.called;
            });
        });

        it('should validate an object', function() {
            MockSchemaService.prototype.validate.resolves([]);
            validator(mockData, mockData, function() {
                expect(MockSchemaService.prototype.validate).to.be.called;
            });
        });

        it('should return error on validation error', function() {
            MockSchemaService.prototype.validate.resolves({error: "error message"});
            validator(mockData, mockData, function(err) {
                expect(err.message).to.equal('error message');
            });
        });
    });

    describe('renderer()', function() {
        var mockNext;
        var renderer;
        var send;
        var status;
        var set;
        var res;
        var req;

        beforeEach(function() {
            renderer = swaggerService.renderer;

            // Initialize stubs
            mockNext = sinon.stub();
            send = sinon.stub();
            status = sinon.stub();
            set = sinon.stub();

            // Mock request and response objects
            res = {
                headersSent: false,
                body: {},
                send: send,
                status: status,
                set: set,
                locals: "dummy"
            };
            req = {
                swagger: {
                    options: {},
                    operation:{
                        api:{
                            basePath: "nothing"
                        }
                    }
                }
            };

            // Monkey-patch sandbox stubs into view.get
            views.get = this.sandbox.stub();
            views.load = this.sandbox.stub().resolves();
            views.get.withArgs('collection.2.0.json').resolves({
                contents:
                    "[<% collection.forEach(function(element, i, arr) { %>" +
                    "<%- element %><%= ( arr.length > 0 && i < arr.length-1  ) ? ',' : '' %>" +
                    "<%  }); %>]"
            });
            views.get.withArgs('test.json').resolves({contents: '{ "message": "<%=message%>" }'});
            views.get.resolves();
        });

        afterEach(function() {
            this.sandbox.restore();
            mockNext.reset();
            status.reset();
            send.reset();
            set.reset();
        });

        it('should assert if headers sent', function() {
            res.headersSent = true;
            return renderer(req, res, 'foo', mockNext)
            .then(function() {
                expect(status).not.to.be.called;
                expect(mockNext).to.be.calledOnce;
            },
            function(err) {
                expect(err).to.be.undefined;
            });
        });

        it('should skip rendering if view is undefined', function() {
            res.body = { message: "foo" };
            return renderer(req, res, undefined, mockNext)
            .then(function() {
                expect(status).to.be.calledWith(200);
                expect(send).to.be.calledWith({ message: "foo" });
            },
            function(err) {
                expect(err).to.be.undefined;
            });
        });

        it('should render an object', function() {
            res.body = { message: "foo" };
            return renderer(req, res, 'test.json', mockNext)
            .then(function() {
                expect(status).to.be.calledWith(200);
                expect(set).to.be.calledWith('Content-Type', 'application/json');
                expect(send).to.be.calledWith('{"message":"foo"}');
            },
            function(err) {
                expect(err).to.be.undefined;
            });
        });

        it('should render a collection of objects()', function() {
            res.body = [{message: "foo"}, {message: "bar"}];
            return renderer(req, res, 'test.json', mockNext)
            .then(function() {
                expect(status).to.be.calledWith(200);
                expect(set).to.be.calledWith('Content-Type', 'application/json');
                expect(send).to.be.calledWith('[{"message":"foo"},{"message":"bar"}]');
            },
            function(err) {
                expect(err).to.be.undefined;
            });
        });

        it('should send 204 on empty', function() {
            req.swagger.options.send204OnEmpty = true;
            return renderer(req, res, 'foo', mockNext)
            .then(function() {
                expect(status).to.be.calledWith(204);
            },
            function(err) {
                expect(err).to.be.undefined;
            });
        });

        it('should throw 500 on invalid template', function() {
            res.body = { message: "foo" };
            return renderer(req, res, 'foo', mockNext)
            .then(function() {
                expect(mockNext).to.be.calledWithMatch({status: 500});
            },
            function(err) {
                expect(err).to.be.undefined;
            });
        });

        it('should throw 500 on render error', function() {
            res.body = { message: "foo" };
            views.render = this.sandbox.stub().rejects(new Error());
            return renderer(req, res, 'foo', mockNext)
            .then(function() {
                expect(mockNext).to.be.calledWithMatch({status: 500});
            },
            function(err) {
                expect(err).to.be.undefined;
            });
        });
    });

    describe('makeRenderableOptions()', function() {
        var makeRenderableOptions;
        var config;
        var env;
        var configGetStub;
        var envGetStub;
        var res;
        var req;

        before(function() {
            makeRenderableOptions = swaggerService.makeRenderableOptions;
            config = helper.injector.get('Services.Configuration');
            env = helper.injector.get('Services.Environment');
            envGetStub = sinon.stub(env, 'get');
            res = {
                locals: {
                    scope: ['global']
                }
            };
            req = {
                swagger: {
                    options: {},
                    operation:{
                        api:{
                            basePath: 'nothing'
                        }
                    }
                }
            };
        });

        afterEach(function() {
            configGetStub.restore();
            taskProtocol.activeTaskExists.reset();
        });

        it('should return file.server when configuring fileServerAddress', function() {
            configGetStub = sinon.stub(config, 'get', function(key, defaults) {
                var obj = {
                    apiServerAddress: '10.1.1.1',
                    apiServerPort: 80,
                    fileServerAddress: '10.1.1.2',
                    fileServerPort: 8080,
                    fileServerPath: '/static'
                };
                if (obj.hasOwnProperty(key)) {
                    return obj[key];
                } else {
                    return defaults;
                }
            });
            return makeRenderableOptions(req, res, {target: 'nodeId'}, true)
            .then(function(options) {
                expect(options.file.server).to.equal('http://10.1.1.2:8080/static');
                expect(options.taskId).to.equal('taskid');
                expect(taskProtocol.activeTaskExists).to.be.calledOnce;
                expect(taskProtocol.activeTaskExists).to.be.calledWith('nodeId');
            });
        });

        it('should return file.server when not configuring fileServerAddress', function() {
            configGetStub = sinon.stub(config, 'get', function(key, defaults) {
                var obj = {
                    apiServerAddress: '10.1.1.1',
                    apiServerPort: 80
                };
                if (obj.hasOwnProperty(key)) {
                    return obj[key];
                } else {
                    return defaults;
                }
            });
            return makeRenderableOptions(req, res, {}, true)
            .then(function(options) {
               expect(options.file.server).to.equal('http://10.1.1.1:80');
            });
        });
    });

    describe('addLinkHeader()', function() {
        var addLinksHeader;

        var res = {
            links: sinon.stub()
        };

        before(function() {
            addLinksHeader = swaggerService.addLinksHeader;
        });

        beforeEach(function() {
            res.links.reset();
        });

        it('should not add links without $skip or $top', function() {
            var req = {
                url: '/api/2.0/things',
                swagger: { query: { } }
            };

            mockWaterlineService.test.count = sinon.stub().resolves(10);
            return addLinksHeader(req, res, 'test')
            .then(function() {
                expect(res.links).not.to.be.called;
            });
        });

        it('should not add links if object count is less than $top', function() {
            var req = {
                url: '/api/2.0/things?$top=10',
                swagger: { query: { $top: 10} }
            };

            mockWaterlineService.test.count = sinon.stub().resolves(8);
            return addLinksHeader(req, res, 'test')
            .then(function() {
                expect(res.links).not.to.be.called;
            });
        });

        it('should not add links if object count is equal to $top', function() {
            var req = {
                url: '/api/2.0/things?$top=10',
                swagger: { query: { $top: 10} }
            };

            mockWaterlineService.test.count = sinon.stub().resolves(10);
            return addLinksHeader(req, res, 'test')
            .then(function() {
                expect(res.links).not.to.be.called;
            });
        });

        it('should add links with $top', function() {
            var req = {
                url: '/api/2.0/things?$top=10',
                swagger: { query: { $top: 10} }
            };
            var expected = {
                first: '/api/2.0/things?$skip=0&$top=10',
                next: '/api/2.0/things?$skip=10&$top=10',
                last: '/api/2.0/things?$skip=30&$top=10'
            };

            mockWaterlineService.test.count = sinon.stub().resolves(40);
            return addLinksHeader(req, res, 'test')
            .then(function() {
                expect(res.links).to.be.calledWith(expected);
            });
        });

        it('should add links with $skip and $top', function() {
            var req = {
                url: '/api/2.0/things?$top=10',
                swagger: { query: { $skip: 8, $top: 9} }
            };
            var expected = {
                first: '/api/2.0/things?$skip=0&$top=8',
                next: '/api/2.0/things?$skip=17&$top=9',
                prev: '/api/2.0/things?$skip=0&$top=8',
                last: '/api/2.0/things?$skip=36&$top=9'
            };

            mockWaterlineService.test.count = sinon.stub().resolves(37);
            return addLinksHeader(req, res, 'test')
            .then(function() {
                expect(res.links).to.be.calledWith(expected);
            });
        });

        it('should add links with $skip', function() {
            var req = {
                url: '/api/2.0/things?$skip=10',
                swagger: { query: { $skip: 10} }
            };
            var expected = {
                first: '/api/2.0/things?$skip=0&$top=10',
                prev: '/api/2.0/things?$skip=0&$top=10',
                last: '/api/2.0/things?$skip=10&$top=30'
            };

            mockWaterlineService.test.count = sinon.stub().resolves(40);
            return addLinksHeader(req, res, 'test')
            .then(function() {
                expect(res.links).to.be.calledWith(expected);
            });
        });

        it('should add links with $skip and $top', function() {
            var req = {
                url: '/api/2.0/things?$top=10',
                swagger: { query: { $skip: 20, $top: 10} }
            };
            var expected = {
                first: '/api/2.0/things?$skip=0&$top=10',
                next: '/api/2.0/things?$skip=30&$top=10',
                prev: '/api/2.0/things?$skip=10&$top=10',
                last: '/api/2.0/things?$skip=30&$top=10'
            };

            mockWaterlineService.test.count = sinon.stub().resolves(40);
            return addLinksHeader(req, res, 'test')
            .then(function() {
                expect(res.links).to.be.calledWith(expected);
            });
        });

        it('should add links with $skip and $top', function() {
            var req = {
                url: '/api/2.0/things?$top=10',
                swagger: { query: { $skip: 5, $top: 10} }
            };
            var expected = {
                first: '/api/2.0/things?$skip=0&$top=5',
                next: '/api/2.0/things?$skip=15&$top=10',
                prev: '/api/2.0/things?$skip=0&$top=5',
                last: '/api/2.0/things?$skip=30&$top=10'
            };

            mockWaterlineService.test.count = sinon.stub().resolves(40);
            return addLinksHeader(req, res, 'test')
            .then(function() {
                expect(res.links).to.be.calledWith(expected);
            });
        });

        it('should add links with $skip and $top', function() {
            var req = {
                url: '/api/2.0/things?$top=10',
                swagger: { query: { $skip: 0, $top: 8} }
            };
            var expected = {
                first: '/api/2.0/things?$skip=0&$top=8',
                next: '/api/2.0/things?$skip=8&$top=8',
                last: '/api/2.0/things?$skip=32&$top=8'
            };

            mockWaterlineService.test.count = sinon.stub().resolves(37);
            return addLinksHeader(req, res, 'test')
            .then(function() {
                expect(res.links).to.be.calledWith(expected);
            });
        });

        it('should add links with $skip and $top', function() {
            var req = {
                url: '/api/2.0/things?$top=10',
                swagger: { query: { $skip: 30, $top: 10} }
            };
            var expected = {
                first: '/api/2.0/things?$skip=0&$top=10',
                prev: '/api/2.0/things?$skip=20&$top=10',
                last: '/api/2.0/things?$skip=30&$top=10'
            };

            mockWaterlineService.test.count = sinon.stub().resolves(40);
            return addLinksHeader(req, res, 'test')
            .then(function() {
                expect(res.links).to.be.calledWith(expected);
            });
        });
    });
});
