// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    express = require('express'),
    passport = require('passport'),
    jwtStrategy = require('passport-jwt').Strategy,
    localStrategy = require('passport-local').Strategy;

module.exports = authRouterFactory;

di.annotate(authRouterFactory, new di.Provide('Http.Api.Auth'));
di.annotate(authRouterFactory, new di.Inject(
        'Auth.Services'
        )
);

function authRouterFactory (
    authService
) {
    function AuthRouter(){
    }

    AuthRouter.prototype.getRouter = function(){
        return this.router;
    };

    AuthRouter.prototype.init = function(){
        var BAD_REQUEST_STATUS = 400;
        var UNAUTHORIZED_STATUS = 401;
        var ERROR_STATUS = 500;
        authService.init();

        this.router = express.Router();

        this.router.use(passport.initialize());

        passport.use(new localStrategy(authService.localStrategyAuth.bind(authService)));

        passport.use(new jwtStrategy(
            authService.jwtVerifyOptions,
            authService.jwtStrategyAuth.bind(authService)));

        this.router.all('/*', function(req, res, next) {
            passport.authenticate(      // middleware for token authentication
                'jwt',
                {session: false},
                function(err, user, challenges){        //callback for error handling
                    if(err){
                        res.status(ERROR_STATUS).send({message: 'Internal server error'});
                    }
                    else if (!user){
                        res.status(UNAUTHORIZED_STATUS).send({message: challenges.message});
                    }
                    else{
                        next();
                    }
                }
            )(req, res, next);
        });
    };

    return new AuthRouter();
}
