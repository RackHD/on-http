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
        this.push(self.readableString);
        this.push(null);
    };

    this.mockWrStream._write = function(chunk, encoding, done) {
        self.writableString += chunk.toString();
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
        FileService,
        fileService,
        fakeStream,
        config;

    before(function() {
        helper.setupInjector(
            _.flatten([
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

        var  FileService = helper.injector.get('fileService');
        fileService = new FileService();
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

    before(function() {
        injector = helper.setupInjector(
            _.flatten([
                helper.require('/lib/services/file-service'),
                helper.require('/lib/services/files/file-plugin'),
                dihelper.simpleWrapper(MockBack, 'Files.Mock')
                    ])
            );

        FileService = helper.injector.get('fileService');

    });

    it("should dynamically load the config specified backends", function() {
        var config = {
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
        },
        fileService = new FileService();
        fileService.injectorMap.MockFS = 'Files.Mock';
        fileService.start(config);

        fileService.backEnds.FileSystem.root.should.equal('someFileRoot');

        fileService.backEnds.FileSystem.should.have.property('put')
            .that.is.a('function');

        fileService.backEnds.MockFS.should.have.property('put')
            .that.is.a('function');
    });

    describe("File Service Methods", function() {
        var q,
            mockBack;

        beforeEach(function() {
            injector = helper.setupInjector(
                _.flatten([
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

            q = helper.injector.get('Q');
            FileService = helper.injector.get('fileService');
            fileService = new FileService();
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
                emittedHash = {};


            fileService.backEnds.defaultBackend.put.returns(q.resolve(
                {
                    stream: mockBack.mockWrStream,
                    id: 'a uuid'
                }
            ));

            md5Hash.update(stringToHash);
            shaHash.update(stringToHash);

            var hashes = {
                md5: md5Hash.digest('hex'),
                sha: shaHash.digest('hex')
            };

            mockBack.mockWrStream.on('metadata', function(meta) {

                emittedHash.md5 = meta.md5;
                emittedHash.sha = meta.sha256;
            });

            fileService.put(fakeStream, {filename:'unimportant'})
            .then(function(streamObj) {
                mockBack.mockRdStream.pipe(streamObj.stream);
            })
            .then(function() {
                emittedHash.should.deep.equal(hashes);
            });


        });


        it("should return a promise for a readstream on get ", function() {

            fileService.backEnds.defaultBackend.get
            .returns(q.resolve(mockBack.mockRdStream));

            return fileService.get({filename: 'unimportant.txt'})
            .should.eventually.deep
            .equal(fileService.backEnds.defaultBackend.mockRdStream);

        });

        it("should return a rejected promise " +
                "if the backend doesn't have a requested file", function() {
            mockBack.get.returns(q.reject('file not found'));

            return fileService.get({filename: 'notInDatabase.fake'})
            .should.be.rejectedWith('file not found');

        });

        it("should return a rejected promise for attemtps to delete " +
        "a not found file", function() {
            mockBack.delete.returns(q.reject('file not found'));

            return fileService.delete({filename: "notInDatabase.txt"})
            .should.be.rejectedWith('file not found');

        });


        it("should return a promise for the list " +
        "received from call to backend's list method",function() {
            var fileList = ['aFile.txt', 'fauxFile.txt', 'falseFile.txt'];

            mockBack.list.returns(q.resolve(fileList));

            return fileService.list().should.eventually
            .deep.equal(fileList);

        });

    });
});
