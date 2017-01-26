// Copyright 2016, EMC, Inc.

'use strict';

describe('Snmp Serializable V1', function () {
    var encryption;
    var Serializable;

    helper.before(function () {
        return helper.requireGlob('/lib/serializables/**/*.js');
    });

    before(function () {
        encryption = helper.injector.get('Services.Encryption');
        Serializable = helper.injector.get('Serializables.V1.Snmp');
    });

    helper.after();

    describe('serialize', function () {
        beforeEach(function () {
            this.subject = new Serializable();
        });

        it('should redact encrypted community field', function () {
            return this.subject.serialize(
                {
                    config: {
                        host: 'fake-host',
                        community: encryption.encrypt('fake-password')
                    }
                }
            ).should.eventually.have.property('config')
                .that.is.an('object').and.to.have.property('community')
                .and.not.equals('fake-password');
        });
    });

    describe('deserialize', function () {
        beforeEach(function () {
            this.subject = new Serializable();
        });

        it('should conform to a host/community schema', function() {
            return this.subject.deserialize(
                {
                    service: "test",
                    config: {
                        host: 'fake-host',
                        community: 'fake-password'
                    }
                }
            ).should.be.fulfilled;
        });

        it('should fail on a bad host/community key schema', function() {
            return this.subject.deserialize(
                {
                    config: {
                        host: 'fake-host',
                        community: 'fake-public-key'
                    }
                }
            ).should.be.rejectedWith(/SchemaError/);
        });

        it('should fail on a bad host/community key schema', function() {
            return this.subject.deserialize(
                {
                    service: "test",
                    config: {
                        host: 'fake-host'
                    }
                }
            ).should.be.rejectedWith(/SchemaError/);
        });

        it('should encrypt community fields', function() {
            return this.subject.deserialize(
                {
                    service: "test",
                    config: {
                        host: 'fake-host',
                        community: 'fake-password'
                    }
                }
            ).should.eventually.have.property('config')
             .that.is.an('object').and.to.have.property('community')
             .and.not.equals('fake-password');
        });
    });
});
