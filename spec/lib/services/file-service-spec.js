// Copyright 2015, EMC, Inc.

'use strict';

require('../../helper');
var EventEmitter = require('events').EventEmitter,
    stream = require('stream');


var MockBack = function (){
    var self = this;

    this.readString = "Incredibly legible string";
    this.writeString = "";

    this.mockRdStream = new stream.Readable();
    this.mockWrStream = new stream.Writable();

    this.mockRdStream._read = function() {
        this.push(self.readString);
        this.push(null);
    };

    this.mockWrStream._write = function(chunk, encoding, done) {
        self.writeString += chunk.toString();
        done();
    };

    this.get = sinon.stub();
    this.put = sinon.stub();
    this.delete = sinon.stub();
    this.list = sinon.stub();
    this.getMeta = sinon.stub();

    return this;
   };

describe("File Service", function() {
    var injector,
        fileService,
        fakeStream,
        config;

    before(function() {
        helper.setupInjector(
            _.flattenDeep([
               helper.require('/lib/services/file-service'),
                helper.require('/lib/services/files/file-plugin'),
                dihelper.simpleWrapper(MockBack, 'Files.Mock')
                    ])
            );


        config = {
            MockFS: {
                type: 'MockFS'
            },

            defaultBackend: {
                 type: 'FileSystem',
                root: '.'
            },

            FileSystem: {
                type: 'FileSystem',
                root: '.'
            }
        };

        fileService = helper.injector.get('fileService');
        fileService.injectorMap.MockFS = 'Files.Mock';
        fileService.start(config);
    });

    it("should expose the appropriate methods", function() {


        fileService.should.have.property('get')
            .that.is.a('function').with.length(2);

        fileService.should.have.property('put')
            .that.is.a('function').with.length(3);

        fileService.should.have.property('list')
            .that.is.a('function').with.length(2);

        fileService.should.have.property('verify')
            .that.is.a('function').with.length(2);

        fileService.should.have.property('delete')
            .that.is.a('function').with.length(2);
    });

    describe("fileService startup", function() {
        beforeEach(function() {
            injector = helper.setupInjector(
                _.flattenDeep([
                    helper.require('/lib/services/file-service'),
                    helper.require('/lib/services/files/file-plugin'),
                    dihelper.simpleWrapper(MockBack, 'Files.Mock')
                        ])
                );

            fileService = helper.injector.get('fileService');
            config = {
                    MockFS: {
                        type: 'MockFS'
                    },

                    defaultBackend: {
                        type: 'MockFS'
                    },

                    FileSystem: {
                        type: 'FileSystem',
                        root:'someFileRoot'
                    }
            };

            fileService.injectorMap.MockFS = 'Files.Mock';
        });

        it("should initialize plugins with the config specified fields", function(){
            fileService.start(config);
            fileService.backEnds.FileSystem.root.should.equal('someFileRoot');
        });

        it("should initialize the defaultBackend", function() {
            fileService.start(config);
            fileService.backEnds.defaultBackend.should.have.property('put')
                .that.is.a('function');
        });

        it("should initialize other backend plugins", function() {
            fileService.start(config);
            fileService.backEnds.MockFS.should.have.property('put')
                .that.is.a('function');
        });

        it("should throw an error if there is no defaultBackend in config", function() {
            var config = {
                FileSystem: {
                        type: 'FileSystem',
                        root:'someFileRoot'
                    }
            };

            fileService.start.bind(fileService, config).should
            .throw("No defaultBackend in config");
        });

        it("should throw an error if the backend string is not in the injectorMap", function() {
            var config = {
                defaultBackend: {
                        type: 'notFileSystem',
                        root:'someFileRoot'
                    }
            };

            fileService.start.bind(fileService, config).should
            .throw("unrecognized back end string");
        });
    });

    describe("File Service Methods", function() {
        var Promise,
            mockBack;

        beforeEach(function() {
            injector = helper.setupInjector(
                _.flattenDeep([
                    helper.require('/lib/services/file-service'),
                    helper.require('/lib/services/files/file-plugin'),
                    dihelper.simpleWrapper(MockBack, 'Files.Mock')
                        ])
                );
            config = {
                    defaultBackend: {
                        type: 'MockFS'
                    }

                };

            Promise = helper.injector.get('Promise');
            fileService = helper.injector.get('fileService');
            fileService.injectorMap.MockFS = 'Files.Mock';
            fileService.start(config);
            fakeStream = new EventEmitter();
            mockBack = fileService.backEnds.defaultBackend;
        });

        it("should provide the correct hashes for uploaded files", function() {
            var crypto = require('crypto'),
                stringToHash = fileService.backEnds.defaultBackend.readString,
                md5Hash = crypto.createHash('md5'),
                shaHash = crypto.createHash('sha256'),
                emittedHash = {},
                hashes = {};

            return new Promise(function (resolve) {
                fileService.backEnds.defaultBackend.put.returns(Promise.resolve(
                    {
                        stream: mockBack.mockWrStream,
                        id: 'a uuid'
                    }
                ));

                md5Hash.update(stringToHash);
                shaHash.update(stringToHash);

                hashes = {
                    md5: md5Hash.digest('hex'),
                    sha: shaHash.digest('hex')
                };

                mockBack.mockWrStream.on('metadata', function(meta) {
                    emittedHash.md5 = meta.md5;
                    emittedHash.sha = meta.sha256;
                    resolve(emittedHash);
                });

                fileService.put(fakeStream, {filename:'unimportant'})
                .then(function(streamObj) {
                    mockBack.mockRdStream.pipe(streamObj.transformHashStream);
                });
            }).should.eventually.deep.equal(hashes);
        });


        it("should return a promise for a readstream on get ", function() {
            fileService.backEnds.defaultBackend.get
            .returns(Promise.resolve(mockBack.mockRdStream));

            return fileService.get({filename: 'unimportant.txt'})
            .should.eventually.deep
            .equal(fileService.backEnds.defaultBackend.mockRdStream);
        });

        it("should return a rejected promise " +
                "if the backend doesn't have a requested file", function() {
            mockBack.get.returns(Promise.reject('file not found'));

            return fileService.get({filename: 'notInDatabase.fake'})
            .should.be.rejectedWith('file not found');
        });

        it("should return a rejected promise for attemtps to delete " +
        "a not found file", function() {
            mockBack.delete.returns(Promise.reject('file not found'));

            return fileService.delete({filename: "notInDatabase.txt"})
            .should.be.rejectedWith('file not found');
        });

        it("should return a promise for an array of files " +
                "received from the backend on verify", function() {
            var aritraryArray = ["I'm a file", "I'm also a file", "I'm a file too"];
            mockBack.getMeta.returns(Promise.resolve(aritraryArray));

            return fileService.verify("aFile.txt").should.eventually
            .deep.equal(aritraryArray);
        });

        it("should return a promise for the list " +
        "received from call to backend's list method",function() {
            var fileList = ['aFile.txt', 'fauxFile.txt', 'falseFile.txt'];

            mockBack.list.returns(Promise.resolve(fileList));

            return fileService.list().should.eventually
            .deep.equal(fileList);
        });

    });
});
