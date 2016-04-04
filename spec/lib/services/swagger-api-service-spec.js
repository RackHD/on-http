// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Services.Http.Swagger', function() {
    var swaggerService;
    var Promise;
    function MockSerializable() {}

    before('inject swagger service', function() {
        helper.setupInjector(_.flattenDeep([
                onHttpContext.prerequisiteInjectables,
                onHttpContext.injectables,
                dihelper.simpleWrapper(MockSerializable, 'Mock.Serializable')
            ])
        );

        swaggerService = helper.injector.get('Http.Services.Swagger');
        Promise = helper.injector.get('Promise');
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
            var req = { swagger: {} };
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
            var req = { swagger: {} };
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
                        middleName: {
                            parameterObject: {
                                in: 'query',
                                type: 'string',
                                definition: { name: 'middleName' }
                            },
                            value:'John+Paul+George'
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
                expect(req.swagger.query).to.have.property('middleName')
                    .and.to.deep.equal(['John', 'Paul', 'George']);
                expect(req.swagger.query).not.to.have.property('inBody');
                expect(req.swagger.query).not.to.have.property('undefinedName');
            });
        });

        it('should not call next after sending headers', function() {
            var req = { swagger: {} };
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
            var req = { swagger: {} };
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

    describe('serializer()', function() {
        var mockNext;
        var serializer;

        beforeEach(function() {
            // Create mock serializable.
            MockSerializable.prototype.serialize = sinon.stub();
            MockSerializable.prototype.deserialize = sinon.stub();
            MockSerializable.prototype.validateAsModel = sinon.stub();
            MockSerializable.prototype.validatePartial = sinon.stub();
            MockSerializable.prototype.validate = sinon.stub();

            mockNext = sinon.stub();
            serializer = swaggerService.serializer('Mock.Serializable');
        });

        it('should serialize a scalar', function() {
            var mockData = {
                data: 'some data'
            };
            var req = {};
            var res = {
                body: mockData
            };
            MockSerializable.prototype.serialize.resolves(mockData);
            MockSerializable.prototype.validateAsModel.resolves(mockData);

            expect(serializer).to.be.a('function');
            return serializer(req, res, mockNext).then(function() {
                expect(res.body).to.equal(mockData);
                expect(mockNext).to.be.called.once;
            });
        });

        it('should serialize an array', function() {
            var mockData = {
                data: 'some data'
            };
            var req = {};
            var res = {
                body: [ mockData, mockData ]
            };

            MockSerializable.prototype.serialize.resolves(mockData);
            MockSerializable.prototype.validateAsModel.resolves(mockData);

            expect(serializer).to.be.a('function');
            return serializer(req, res, mockNext).then(function() {
                expect(res.body).to.deep.equal([ mockData, mockData ]);
                expect(mockNext).to.be.called.once;
            });
        });

        it('should call next if serializer error occurs', function() {
            var mockData = {
                data: 'some data'
            };
            var req = {};
            var res = {
                body: mockData
            };
            var mockError = new Error('serializer error');
            MockSerializable.prototype.serialize.rejects(mockError);

            expect(serializer).to.be.a('function');
            return serializer(req, res, mockNext).then(function() {
                expect(mockNext).to.be.calledWith(mockError);
            });
        });

        it('should call next if validation error occurs', function() {
            var mockData = {
                data: 'some data'
            };
            var req = {};
            var res = {
                body: mockData
            };
            var mockError = new Error('serializer error');
            MockSerializable.prototype.serialize.resolves(mockData);
            MockSerializable.prototype.validateAsModel.rejects(mockError);

            expect(serializer).to.be.a('function');
            return serializer(req, res, mockNext).then(function() {
                expect(mockNext).to.be.calledWith(mockError);
            });
        });
    });

    describe('deserializer()', function() {
        var mockNext;
        var deserializer;

        beforeEach(function() {
            // Create mock serializable.
            MockSerializable.prototype.serialize = sinon.stub();
            MockSerializable.prototype.deserialize = sinon.stub();
            MockSerializable.prototype.validateAsModel = sinon.stub();
            MockSerializable.prototype.validatePartial = sinon.stub();
            MockSerializable.prototype.validate = sinon.stub();

            mockNext = sinon.stub();
            deserializer = swaggerService.deserializer('Mock.Serializable');
        });

        it('should deserialize scalar', function() {
            var mockData = {
                data: 'some data'
            };
            var req = {
                body: mockData
            };
            var res = {};

            expect(deserializer).to.be.a('function');
            MockSerializable.prototype.validate.resolves(mockData);
            MockSerializable.prototype.deserialize.resolves(mockData);
            return deserializer(req, res, mockNext).then(function() {
                expect(req.body).to.equal(mockData);
                expect(mockNext).to.be.called.once;
            });
        });

        it('should deserialize array', function() {
            var mockData = {
                data: 'some data'
            };
            var mockDataArray = [ mockData, mockData ];
            var req = {
                body: mockDataArray
            };
            var res = {};

            expect(deserializer).to.be.a('function');
            MockSerializable.prototype.validate.resolves(mockDataArray);
            MockSerializable.prototype.deserialize.resolves(mockDataArray);
            return deserializer(req, res, mockNext).then(function() {
                expect(req.body).to.equal(mockDataArray);
                expect(mockNext).to.be.called.once;
            });
        });

        it('should call next if validation error occurs', function() {
            var mockError = {
                message: 'validation error'
            };
            var mockData = {
                data: 'some data'
            };
            var req = {
                body: mockData
            };
            var res = {};
            var mockError = new Error('deserializer error');

            expect(deserializer).to.be.a('function');
            MockSerializable.prototype.validate.rejects(mockError);
            return deserializer(req, res, mockNext).then(function() {
                expect(mockNext).to.be.calledWith(mockError);
            });
        });

        it('should call next if deserialize error occurs', function() {
            var mockError = {
                message: 'validation error'
            };
            var mockData = {
                data: 'some data'
            };
            var req = {
                body: mockData
            };
            var res = {};
            var mockError = new Error('deserializer error');

            expect(deserializer).to.be.a('function');
            MockSerializable.prototype.validate.resolves(mockData);
            MockSerializable.prototype.deserialize.rejects(mockError);
            return deserializer(req, res, mockNext).then(function() {
                expect(mockNext).to.be.calledWith(mockError);
            });
        });
    });
});
