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

        /**
         * @api {post} /api/1.1/login/ POST /
         * @apiVersion 1.1.0
         * @apiDescription get a token before accessing other apis
         * @apiName login
         * @apiGroup nodes
         * @apiSuccess {json} a token to be used when accessing other apis:
         *      {
     *       "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiY
     *       WRtaW4iLCJpYXQiOjE0NTI0ODA3MTIsImV4cCI6MTQ1MjU2NzExMn0.Qo-9y
     *       omlkd0WE1jlEA-L1WqA6k_9qJYhkicQL5IUmSg"
     *      }
         */


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
            passport.authenticate(
                'jwt',
                {session: false},
                function(err, user, challenges){
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
