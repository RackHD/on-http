"use strict";
Object.defineProperties(exports, {
  createProviderFromFnOrClass: {get: function() {
      return createProviderFromFnOrClass;
    }},
  __esModule: {value: true}
});
var $__annotations__,
    $__util__;
var $__0 = ($__annotations__ = require("./annotations"), $__annotations__ && $__annotations__.__esModule && $__annotations__ || {default: $__annotations__}),
    SuperConstructorAnnotation = $__0.SuperConstructor,
    readAnnotations = $__0.readAnnotations;
var $__1 = ($__util__ = require("./util"), $__util__ && $__util__.__esModule && $__util__ || {default: $__util__}),
    isClass = $__1.isClass,
    isFunction = $__1.isFunction,
    isObject = $__1.isObject,
    toString = $__1.toString;
var EmptyFunction = Object.getPrototypeOf(Function);
var ClassProvider = function ClassProvider(clazz, params, isPromise) {
  this.provider = clazz;
  this.isPromise = isPromise;
  this.params = [];
  this._constructors = [];
  this._flattenParams(clazz, params);
  this._constructors.unshift([clazz, 0, this.params.length - 1]);
};
($traceurRuntime.createClass)(ClassProvider, {
  _flattenParams: function(constructor, params) {
    var SuperConstructor;
    var constructorInfo;
    for (var $__3 = params[Symbol.iterator](),
        $__4; !($__4 = $__3.next()).done; ) {
      var param = $__4.value;
      {
        if (param.token === SuperConstructorAnnotation) {
          SuperConstructor = Object.getPrototypeOf(constructor);
          if (SuperConstructor === EmptyFunction) {
            throw new Error((toString(constructor) + " does not have a parent constructor. Only classes with a parent can ask for SuperConstructor!"));
          }
          constructorInfo = [SuperConstructor, this.params.length];
          this._constructors.push(constructorInfo);
          this._flattenParams(SuperConstructor, readAnnotations(SuperConstructor).params);
          constructorInfo.push(this.params.length - 1);
        } else {
          this.params.push(param);
        }
      }
    }
  },
  _createConstructor: function(currentConstructorIdx, context, allArguments) {
    var constructorInfo = this._constructors[currentConstructorIdx];
    var nextConstructorInfo = this._constructors[currentConstructorIdx + 1];
    var argsForCurrentConstructor;
    if (nextConstructorInfo) {
      argsForCurrentConstructor = allArguments.slice(constructorInfo[1], nextConstructorInfo[1]).concat([this._createConstructor(currentConstructorIdx + 1, context, allArguments)]).concat(allArguments.slice(nextConstructorInfo[2] + 1, constructorInfo[2] + 1));
    } else {
      argsForCurrentConstructor = allArguments.slice(constructorInfo[1], constructorInfo[2] + 1);
    }
    return function InjectedAndBoundSuperConstructor() {
      return constructorInfo[0].apply(context, argsForCurrentConstructor);
    };
  },
  create: function(args) {
    var context = Object.create(this.provider.prototype);
    var constructor = this._createConstructor(0, context, args);
    var returnedValue = constructor();
    if (isFunction(returnedValue) || isObject(returnedValue)) {
      return returnedValue;
    }
    return context;
  }
}, {});
var FactoryProvider = function FactoryProvider(factoryFunction, params, isPromise) {
  this.provider = factoryFunction;
  this.params = params;
  this.isPromise = isPromise;
  for (var $__3 = params[Symbol.iterator](),
      $__4; !($__4 = $__3.next()).done; ) {
    var param = $__4.value;
    {
      if (param.token === SuperConstructorAnnotation) {
        throw new Error((toString(factoryFunction) + " is not a class. Only classes with a parent can ask for SuperConstructor!"));
      }
    }
  }
};
($traceurRuntime.createClass)(FactoryProvider, {create: function(args) {
    return this.provider.apply(undefined, args);
  }}, {});
function createProviderFromFnOrClass(fnOrClass, annotations) {
  if (isClass(fnOrClass)) {
    return new ClassProvider(fnOrClass, annotations.params, annotations.provide.isPromise);
  }
  return new FactoryProvider(fnOrClass, annotations.params, annotations.provide.isPromise);
}
