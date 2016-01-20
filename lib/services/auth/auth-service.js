// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di');
var jwt = require('jsonwebtoken');
var crypto = require('crypto');

module.exports = authServiceFactory;
di.annotate(authServiceFactory, new di.Provide('Auth.Services'));
di.annotate(authServiceFactory,
    new di.Inject(
        'Services.Configuration'
    )
);
function authServiceFactory(
    configuration
) {
    function AuthService() {
    }

    AuthService.prototype.init = function(){
        this.algorithm = 'HS256';
        this.secretOrKey = 'RackHDRocks!';
        this.ignoreTokenExpiration = false;
        this.encoder = 'base64';

        this.hashConfig = {
            // number of bytes in the Hash
            hashBytes: 64,
            // number of bytes in the slat
            saltBytes: 64,
            // number of iterations to get the final hash, longer means more secure,
            // but also slower
            iterations: 10000
        };

        this.loadFromConf();

        this.jwtSignOptions = {
            algorithm : this.algorithm,
            secretOrKey : this.secretOrKey,
            expiresIn : this.expiresIn
        };

        this.jwtVerifyOptions = {
            algorithm : this.algorithm,
            secretOrKey : this.secretOrKey,
            ignoreExpiration : this.ignoreTokenExpiration
        };
    }

    AuthService.prototype.loadFromConf = function (){
        this.userFromConf = configuration.get('authUsername', 'admin');
        // Read hash and salt from configure file and decode per base64
        this.hashFromConf = new Buffer(configuration.get('authPasswordHash',
                'KcBN9YobNV0wdux8h0fKNqi4uoKCgGl/j8c6YGlG7iA0PB3P9ojbmANGhDlcSBE0iOTIsYsGbtSsbqP4wvsVcw=='),
            this.encoder);

        this.saltFromConf = new Buffer(configuration.get('authPasswordSalt',
                'zlxkgxjvcFwm0M8sWaGojh25qNYO8tuNWUMN4xKPH93PidwkCAvaX2JItLA3p7BSCWIzkw4GwWuezoMvKf3UXg=='),
            this.encoder);

        if (this.hashFromConf.length !== this.hashConfig.hashBytes ||
            this.saltFromConf.length !== this.hashConfig.saltBytes){
            throw new Error('Invalid password hash or salt length in configure file');
        }

        this.expiresIn = configuration.get('authTokenExpireIn', 86400); //86400 = 24 * 60 * 60, 24hours
        if (typeof (this.expiresIn) !== 'number'){
            throw new Error('Invalid token expire value in configure file');
        }
        if (this.expiresIn === 0){
            this.ignoreTokenExpiration = true;
        }
    };

    AuthService.prototype.localStrategyAuth = function (username, password, done) {
        var self =  this;

        self.calcPasswordHash(
            password,
            self.saltFromConf,
            self.hashConfig.iterations,
            self.hashConfig.hashBytes,
            function(err, hashCalculated){
                if(err){
                    return done(err)
                }
                if (!hashCalculated ||
                    username !== self.userFromConf ||
                    hashCalculated.toString(self.encoder) !== self.hashFromConf.toString(self.encoder)) {

                    return done(null, false, {
                        message: 'Invalid username or password'
                    });
                }
                return done(null, username);
            });
    };

    AuthService.prototype.calcPasswordHash = function (password, salt, iteration, bytes, callback) {
        var self = this;

        crypto.pbkdf2(password, salt, self.hashConfig.iterations, self.hashConfig.hashBytes,
            function(err, hash){
                if(err){
                    callback(err);
                }
                callback(null, hash);
            });
    };

    AuthService.prototype.createJwtToken = function (user) {
        var self = this;
        return jwt.sign({
            user: user
        },
        self.secretOrKey,
        self.jwtSignOptions
        );
    };

    AuthService.prototype.jwtStrategyAuth = function(jwt_payload, done) {
        var user = jwt_payload.user;
        if (user === this.userFromConf){
            return done(null, user);
        }
        else{
            return done(null, false);
        }
    };

    return new AuthService();
}
