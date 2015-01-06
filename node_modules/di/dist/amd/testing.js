define(['./injector', './annotations', './util', './providers'], function($__0,$__2,$__4,$__6) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  if (!$__6 || !$__6.__esModule)
    $__6 = {default: $__6};
  var Injector = $__0.Injector;
  var $__3 = $__2,
      Inject = $__3.Inject,
      annotate = $__3.annotate,
      readAnnotations = $__3.readAnnotations;
  var isFunction = $__4.isFunction;
  var createProviderFromFnOrClass = $__6.createProviderFromFnOrClass;
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
        $__8 = 0; $__8 < arguments.length; $__8++)
      params[$__8] = arguments[$__8];
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
  return {
    get use() {
      return use;
    },
    get inject() {
      return inject;
    },
    __esModule: true
  };
});
