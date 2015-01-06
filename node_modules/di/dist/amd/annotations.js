define(['./util'], function($__0) {
  "use strict";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var isFunction = $__0.isFunction;
  var SuperConstructor = function SuperConstructor() {};
  ($traceurRuntime.createClass)(SuperConstructor, {}, {});
  var TransientScope = function TransientScope() {};
  ($traceurRuntime.createClass)(TransientScope, {}, {});
  var Inject = function Inject() {
    for (var tokens = [],
        $__7 = 0; $__7 < arguments.length; $__7++)
      tokens[$__7] = arguments[$__7];
    this.tokens = tokens;
    this.isPromise = false;
    this.isLazy = false;
  };
  ($traceurRuntime.createClass)(Inject, {}, {});
  var InjectPromise = function InjectPromise() {
    for (var tokens = [],
        $__8 = 0; $__8 < arguments.length; $__8++)
      tokens[$__8] = arguments[$__8];
    this.tokens = tokens;
    this.isPromise = true;
    this.isLazy = false;
  };
  ($traceurRuntime.createClass)(InjectPromise, {}, {}, Inject);
  var InjectLazy = function InjectLazy() {
    for (var tokens = [],
        $__9 = 0; $__9 < arguments.length; $__9++)
      tokens[$__9] = arguments[$__9];
    this.tokens = tokens;
    this.isPromise = false;
    this.isLazy = true;
  };
  ($traceurRuntime.createClass)(InjectLazy, {}, {}, Inject);
  var Provide = function Provide(token) {
    this.token = token;
    this.isPromise = false;
  };
  ($traceurRuntime.createClass)(Provide, {}, {});
  var ProvidePromise = function ProvidePromise(token) {
    this.token = token;
    this.isPromise = true;
  };
  ($traceurRuntime.createClass)(ProvidePromise, {}, {}, Provide);
  function annotate(fn, annotation) {
    fn.annotations = fn.annotations || [];
    fn.annotations.push(annotation);
  }
  function hasAnnotation(fn, annotationClass) {
    if (!fn.annotations || fn.annotations.length === 0) {
      return false;
    }
    for (var $__3 = fn.annotations[Symbol.iterator](),
        $__4; !($__4 = $__3.next()).done; ) {
      var annotation = $__4.value;
      {
        if (annotation instanceof annotationClass) {
          return true;
        }
      }
    }
    return false;
  }
  function readAnnotations(fn) {
    var collectedAnnotations = {
      provide: {
        token: null,
        isPromise: false
      },
      params: []
    };
    if (fn.annotations && fn.annotations.length) {
      for (var $__3 = fn.annotations[Symbol.iterator](),
          $__4; !($__4 = $__3.next()).done; ) {
        var annotation = $__4.value;
        {
          if (annotation instanceof Inject) {
            annotation.tokens.forEach((function(token) {
              collectedAnnotations.params.push({
                token: token,
                isPromise: annotation.isPromise,
                isLazy: annotation.isLazy
              });
            }));
          }
          if (annotation instanceof Provide) {
            collectedAnnotations.provide.token = annotation.token;
            collectedAnnotations.provide.isPromise = annotation.isPromise;
          }
        }
      }
    }
    if (fn.parameters) {
      fn.parameters.forEach((function(param, idx) {
        for (var $__5 = param[Symbol.iterator](),
            $__6; !($__6 = $__5.next()).done; ) {
          var paramAnnotation = $__6.value;
          {
            if (isFunction(paramAnnotation) && !collectedAnnotations.params[idx]) {
              collectedAnnotations.params[idx] = {
                token: paramAnnotation,
                isPromise: false,
                isLazy: false
              };
            } else if (paramAnnotation instanceof Inject) {
              collectedAnnotations.params[idx] = {
                token: paramAnnotation.tokens[0],
                isPromise: paramAnnotation.isPromise,
                isLazy: paramAnnotation.isLazy
              };
            }
          }
        }
      }));
    }
    return collectedAnnotations;
  }
  ;
  return {
    get annotate() {
      return annotate;
    },
    get hasAnnotation() {
      return hasAnnotation;
    },
    get readAnnotations() {
      return readAnnotations;
    },
    get SuperConstructor() {
      return SuperConstructor;
    },
    get TransientScope() {
      return TransientScope;
    },
    get Inject() {
      return Inject;
    },
    get InjectPromise() {
      return InjectPromise;
    },
    get InjectLazy() {
      return InjectLazy;
    },
    get Provide() {
      return Provide;
    },
    get ProvidePromise() {
      return ProvidePromise;
    },
    __esModule: true
  };
});
