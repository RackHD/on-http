// Copyright 2014, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

describe('Obm Serializable', function () {
    var Obm;

    helper.before(function () {
        return helper.requireGlob('/lib/serializables/**/*.js');
    });

    before(function () {
        Obm = helper.injector.get('Serializables.V1.Obm');

    });

    helper.after();

    describe('deserialize', function () {
        beforeEach(function () {
            this.subject = new Obm();
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

