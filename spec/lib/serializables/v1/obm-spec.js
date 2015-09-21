// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Obm Serializable V1', function () {
    var encryption;
    var Serializable;

    helper.before(function () {
        return helper.requireGlob('/lib/serializables/**/*.js');
    });

    before(function () {
        encryption = helper.injector.get('Services.Encryption');
        Serializable = helper.injector.get('Serializables.V1.Obm');
    });

    helper.after();

    describe('serialize', function () {
        beforeEach(function () {
            this.subject = new Serializable();
        });

        it('should decrypt password fields in config', function() {
            return this.subject.serialize(
                {
                    service: 'fake-service',
                    config: {
                        password: encryption.encrypt('foobar')
                    }
                }
            ).should.eventually.have.deep.property(
                'config.password'
            ).and.equal('foobar');
        });

        it('should decrypt community fields in config', function() {
            return this.subject.serialize(
                {
                    service: 'fake-service',
                    config: {
                        community: encryption.encrypt('foobar')
                    }
                }
            ).should.eventually.have.deep.property(
                'config.community'
            ).and.equal('foobar');
        });
    });

    describe('deserialize', function () {
        beforeEach(function () {
            this.subject = new Serializable();
        });

        it('should encrypt password fields in config', function() {
            return this.subject.deserialize(
                {
                    service: 'fake-service',
                    config: {
                        password: 'foobar'
                    }
                }
            ).should.eventually.have.deep.property(
                'config.password'
            ).and.not.equal('foobar');
        });

        it('should encrypt community fields in config', function() {
            return this.subject.deserialize(
                {
                    service: 'fake-service',
                    config: {
                        community: 'foobar'
                    }
                }
            ).should.eventually.have.deep.property(
                'config.community'
            ).and.not.equal('foobar');
        });
    });
});
