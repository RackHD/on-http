"use strict";
Object.defineProperties(exports, {
  use: {get: function() {
      return use;
    }},
  inject: {get: function() {
      return inject;
    }},
  __esModule: {value: true}
});
var $__injector__,
    $__annotations__,
    $__util__,
    $__providers__;
var Injector = ($__injector__ = require("./injector"), $__injector__ && $__injector__.__esModule && $__injector__ || {default: $__injector__}).Injector;
var $__1 = ($__annotations__ = require("./annotations"), $__annotations__ && $__annotations__.__esModule && $__annotations__ || {default: $__annotations__}),
    Inject = $__1.Inject,
    annotate = $__1.annotate,
    readAnnotations = $__1.readAnnotations;
var isFunction = ($__util__ = require("./util"), $__util__ && $__util__.__esModule && $__util__ || {default: $__util__}).isFunction;
var createProviderFromFnOrClass = ($__providers__ = require("./providers"), $__providers__ && $__providers__.__esModule && $__providers__ || {default: $__providers__}).createProviderFromFnOrClass;
var currentSpec = null;
beforeEach(function() {
  currentSpec = this;
  currentSpec.$$providers = [];
});
afterEach(function() {
  currentSpec.$$providers = null;
  currentSpec.$$injector = null;
  currentSpec = null;
});
function isRunning() {
  return !!currentSpec;
}
function use(mock) {
  if (currentSpec && currentSpec.$$injector) {
    throw new Error('Cannot call use() after inject() has already been called.');
  }
  var providerWrapper = {provider: mock};
  var fn = function() {
    currentSpec.$$providers.push(providerWrapper);
  };
  fn.as = function(token) {
    if (currentSpec && currentSpec.$$injector) {
      throw new Error('Cannot call as() after inject() has already been called.');
    }
    providerWrapper.as = token;
    if (isRunning()) {
      return undefined;
    }
    return fn;
  };
  if (isRunning()) {
    fn();
  }
  return fn;
}
function inject() {
  for (var params = [],
      $__4 = 0; $__4 < arguments.length; $__4++)
    params[$__4] = arguments[$__4];
  var behavior = params.pop();
  annotate(behavior, new (Function.prototype.bind.apply(Inject, $traceurRuntime.spread([null], params)))());
  var run = function() {
    if (!currentSpec.$$injector) {
      var providers = new Map();
      var modules = [];
      var annotations;
      currentSpec.$$providers.forEach(function(providerWrapper) {
        if (!providerWrapper.as) {
          modules.push(providerWrapper.provider);
        } else {
          if (!isFunction(providerWrapper.provider)) {
            providers.set(providerWrapper.as, createProviderFromFnOrClass(function() {
              return providerWrapper.provider;
            }, {
              provide: {
                token: null,
                isPromise: false
              },
              params: []
            }));
          } else {
            annotations = readAnnotations(providerWrapper.provider);
            providers.set(providerWrapper.as, createProviderFromFnOrClass(providerWrapper.provider, annotations));
          }
        }
      });
      currentSpec.$$injector = new Injector(modules, null, providers);
    }
    currentSpec.$$injector.get(behavior);
  };
  return isRunning() ? run() : run;
}
;
