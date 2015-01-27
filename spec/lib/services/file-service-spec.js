'use strict';

require('../../helper');
var _ = require('lodash'),
    EventEmitter = require('events').EventEmitter;





describe("File Service", function() {
    var injector,
        FileService,
        fileService,
        fakeStream,
        config;

    before(function() {
        injector = helper.baseInjector.createChild(
            _.flatten([
               helper.require('/lib/services/file-service'),
                helper.require('/lib/services/files/file-plugin'),
                helper.require('/lib/services/files/mockfile-plugin')
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

        var  FileService = injector.get('fileService');
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
            .that.is.a('function').with.length(1);

        fileService.should.have.property('verify')
            .that.is.a('function').with.length(2);

        fileService.should.have.property('delete')
            .that.is.a('function').with.length(2);
    });

    before(function() {
        injector = helper.baseInjector.createChild(
            _.flatten([
                helper.require('/lib/services/file-service'),
                helper.require('/lib/services/files/file-plugin'),
                helper.require('/lib/services/files/mockfile-plugin')
                    ])
            );

        FileService = injector.get('fileService');

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

        beforeEach(function() {
            injector = helper.baseInjector.createChild(
                _.flatten([
                    helper.require('/lib/services/file-service'),
                    helper.require('/lib/services/files/file-plugin'),
                    helper.require('/lib/services/files/mockfile-plugin')
                        ])
                );
            config = {
                    defaultBackend: {
                        type: 'MockFS'
                    }

                };

            FileService = injector.get('fileService');
            fileService = new FileService();
            fileService.injectorMap.MockFS = 'Files.Mock';
            fileService.start(config);
            fakeStream = new EventEmitter();
        });


        it("should provide the correct hashes for uploaded files", function() {
            var crypto = require('crypto'),
                stringToHash = fileService.backEnds.defaultBackend.readableString,
                md5Hash = crypto.createHash('md5'),
                shaHash = crypto.createHash('sha256');


            md5Hash.update(stringToHash);
            shaHash.update(stringToHash);

            fileService.put(fakeStream, {filename:'unimportant'});

            fileService.backEnds.defaultBackend.mockWrStream.on('metadata', function(meta) {

                meta.md5.should.equal(md5Hash.digest('hex'));

                meta.sha256.should.equal(shaHash.digest('hex'));
            });
        });


        it("should return a promise for a readstream on get ", function() {

            return fileService.get({filename: 'fake.txt'})
            .should.eventually.deep
            .equal(fileService.backEnds.defaultBackend.mockRdStream);

        });

        it("should return a rejected promise " +
                "if the backend doesn't have a requested file", function() {

            return fileService.get({filename: 'notInDatabase.fake'})
            .should.be.rejected;

        });

        it("should return a rejected promise for attemtps to delete " +
        "a not found file", function() {

            return fileService.delete({filename: "notInDatabase.txt"})
            .should.be.rejected;

        });


        it("should return a promise for the list " +
        "received from call to backend's list method",function() {

            return fileService.list().should.eventually
            .deep.equal(fileService.backEnds.defaultBackend.fileList);

        });

    });
});
