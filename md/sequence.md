# JS递增序列的深入分析


## 背景

有一天看到这个 [JS Tips](http://www.jstips.co/) ，感觉他的某个写法确实很有趣，也很是懵懂，所以想去了解下它。对应的写法是这样子的：

```js
Array.apply(null, {length: 5}).map(Function.call, Number);
```

也就是你可以通过上面的代码生成一个序列数组：

```js
[0, 1, 2, 3, 4]
```

## 过程

### 初步想法

针对上面这个问题，其实我第一反应是打算这样子实现的，代码如下：

```js
Array(5).map((va, i) => i)
```

但是它返回的是`[undefined × 5]`，当时就很郁闷。

原文中的代码可以分成两部分看：

```js
Array.apply(null, { length: 5 })
// => [undefined, undefined, undefined, undefined, undefined]

[undefined, undefined, undefined, undefined, undefined].map(Function.call, Number)
// => [0, 1, 2, 3, 4]
```

思路很明显：

1. 先生成一个长度为5，元素全部为`undefined`的数组
2. 对数组做`map()`操作，转换为0-4的序列

### 为什么不是`Array(5)`

先看第一部分代码，`Array.apply(null, { length: 5 })`跟`Array(5)`有什么区别呢？各种途径找问题，真心是“有问题在[StackOverflow](https://stackoverflow.com/)上面找”，有一篇文章写的很好，参见底部`参考`第二个链接。

首先`Array(5)`可以参考 [Array(len)](http://www.ecma-international.org/ecma-262/6.0/#sec-array-len)

>
* Let array be ArrayCreate(0, proto).
* If Type(len) is not Number, then
	* Let defineStatus be CreateDataProperty(array, "0", len).
	* Assert: defineStatus is true.
	* Let intLen be 1.
* Else,
	* Let intLen be ToUint32(len).
	* If intLen ≠ len, throw a RangeError exception.

也就是它会通过`ArrayCreate`来创建一个数组`array`，如果`Type(len)`为`Number`的话，就让`array`的`intLen`赋值`ToUint32(len)`，可以用JS模拟：

```js
function Array(len) {
  var ret = [];
  ret.length = len;
  return ret;
}
```

详细可以参考V8 [runtime-array](https://github.com/v8/v8/blob/6.4.96/src/runtime/runtime-array.cc#L381)：

```c++
factory->NewJSArrayStorage(array, 0, 0, DONT_INITIALIZE_ARRAY_ELEMENTS);
```

再看看`NewJSArrayStorage`的[代码](https://github.com/v8/v8/blob/6.4.96/src/factory.cc#L2028)：

```c++
if (capacity == 0) {
  array->set_length(Smi::kZero);
  array->set_elements(*empty_fixed_array());
  return;
}
```

因为`capacity`是第三个参数为`0`，所以会跑这个逻辑，主要的处理就是设置数组的`length`为`0`，数组元素是`empty_fixed_array`。

真正完成JS初始化的是`ArrayConstructInitializeElements`函数，具体实现在 [ArrayConstructInitializeElements](https://github.com/v8/v8/blob/6.4.96/src/elements.cc#L4237)

截取`ArrayConstructInitializeElements`函数[部分代码](https://github.com/v8/v8/blob/6.4.96/src/elements.cc#L4239-L4268)：

```c++
if (args->length() == 0) {
  // Optimize the case where there are no parameters passed.
  JSArray::Initialize(array, JSArray::kPreallocatedArrayElements);
  return array;

} else if (args->length() == 1 && args->at(0)->IsNumber()) {
  uint32_t length;
  if (!args->at(0)->ToArrayLength(&length)) {
    return ThrowArrayLengthRangeError(array->GetIsolate());
  }

  // Optimize the case where there is one argument and the argument is a small
  // smi.
  if (length > 0 && length < JSArray::kInitialMaxFastElementArray) {
    ElementsKind elements_kind = array->GetElementsKind();
    JSArray::Initialize(array, length, length);

    if (!IsHoleyElementsKind(elements_kind)) {
      elements_kind = GetHoleyElementsKind(elements_kind);
      JSObject::TransitionElementsKind(array, elements_kind);
    }
  } else if (length == 0) {
    JSArray::Initialize(array, JSArray::kPreallocatedArrayElements);
  } else {
    // Take the argument as the length.
    JSArray::Initialize(array, 0);
    JSArray::SetLength(array, length);
  }
  return array;
}
```

`Array(len)`生成对应的数组的话，会走`args->length() == 1 && args->at(0)->IsNumber()`这个流程, 然后会跑`JSArray::Initialize`：

```c++
void JSArray::Initialize(Handle<JSArray> array, int capacity, int length) {
  ASSERT(capacity >= 0);
  array->GetIsolate()->factory()->NewJSArrayStorage(
       array, length, capacity, INITIALIZE_ARRAY_ELEMENTS_WITH_HOLE);
}
```

重新走了上面的`NewJSArrayStorage`的[流程](https://github.com/v8/v8/blob/6.4.96/src/factory.cc#L2028-L2062), 因为`capacity`不为0，并且`model`为`INITIALIZE_ARRAY_ELEMENTS_WITH_HOLE`，所以会走这个逻辑。

```c++
elms = NewFixedArrayWithHoles(capacity);
```

所以生成的每一个元素都是`hole`类型，并非`undefined`，至此，我们知道`Array(N)`的方式生成的是一个稀疏数组(sparse array)。那为什么稀疏数组调用`map()`不能得到同样的效果呢？


### 理解`Array.prototype.map()`

我们参考MDN里面的[map()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map)方法，可以看到这一段话

> It is not called for missing elements of the array (that is, indexes that have never been set, which have been deleted or which have never been assigned a value)

意思就是说如果数组里某个位置没有值的话，`map()`函数会直接跳过，不会执行的。

咱们可以先来看三个例子：

**第一个例子**

```js
var arr = ['v', 'a', undefined, 'r'];
arr.map(v => v.toUpperCase())
```
这个会报错`Cannot read property 'toUpperCase' of undefined`，哦，原来map的时候不会过滤掉`undefined`的哈！`undefined`很明显没有toUpperCase方法，所以报错了。

**第二个例子**

```js
var arr = ['v', 'a', undefined, 'r'];
delete arr[2];
arr.map(v => v.toUpperCase())
```

没有报错，返回的是`["V", "A", undefined × 1, "R"]`

**第三个例子**

```js
var arr = ['v', 'a'];
arr[3] = 'r'
arr.map(v => v.toUpperCase())
```

结果同上。

所以咱们对于`missing element of the array`的理解就是它其实不是`undefined`，正如MDN说的它要么被`delete`掉了要么没有赋值。

结合上面说的`Array(5)`，它其实只是创建一个数组对象，然后把它的`length`修改成5而已，所以它里面值都是没有赋值的。所以`map()`循环不会执行对应的`callback`函数。不然你可以这样子实验

```js
Array(5).map((va, i) => console.log(i))
```

其实在控制台是没有打印出来东西的。

如果这样子你还不相信的话, 咱们再来详细解释下。可以从**ECMA-262**看下[Array.prototype.map](http://www.ecma-international.org/ecma-262/6.0/#sec-array.prototype.map)，咱们先抓住重点, 有那么一段话：

> 
* Let kPresent be HasProperty(O, Pk).
* ReturnIfAbrupt(kPresent).

在执行`callback`函数的时候，有一个检测`HasProperty`，检测对象有没对应的属性，而根据[HasProperty (O, P)](http://www.ecma-international.org/ecma-262/6.0/#sec-hasproperty) ，其实最后是调用`O.[[HasProperty]](P)`。在这里捎带说下`Array`在V8里面的数据结构表示，分成两种，可以看下[注释](https://github.com/v8/v8/blob/6.4.96/src/objects/js-array.h#L16-L20):

> The JSArray describes JavaScript Arrays. Such an array can be in one of two modes: fast, backing storage is a FixedArray and length <= elements.length(); slow, backing storage is a HashTable with numbers as keys.

用正常的方式：

```js
var arr = [1, 2, 3];
```

会创建**fast**模式。但是如果下面的方式就会创建**slow**模式，也就是以字典的数据结构来存储数组：

```js
// 1
var arr1 = [1, 2, , 4];
// 2
var arr2 = Array(5);

// 3
var arr3 = [];
arr3[2000] = 2000; 
```

`arr1`、`arr2`、`arr3`都会以`hashTable`来存储数组数据。

`arr1`可以这样子表示：

```js
{
  0: 1,
  1: 2,
  3: 4,
  length: 3
}
```

`arr2`可以这样子表示：

```js
{
  length: 5
}
```

因为我们只对`arr2`数组加上了`length`属性，没有`0`、`1`等下标属性，所以这个场景`HasProperty`返回的是`false`，也就是不会走下面的流程，也即不会调用`callback`

> 
* Let kValue be Get(O, Pk).
* ReturnIfAbrupt(kValue).
* Let mappedValue be Call(callbackfn, T, «kValue, k, O»)

咱们可以从V8代码里找到一些内容，[builtins-array-gen](https://github.com/v8/v8/blob/6.4.96/src/builtins/builtins-array-gen.cc#L552-L558)

```c++
Node* k_present = HasProperty(o(), k(), context(), kHasProperty);
GotoIf(WordNotEqual(k_present, TrueConstant()), &done_element);
```

也就是说如果`HasProperty`执行之后是`false`的话，就不会执行下面的操作，直接`goto`到`&done_element`位置。

至此，我们知道了`Array(N).map(callback)`不会执行`callback`，是因为`Array(N)`生成的数组是一个`HashTable`结构的“伪”数组，数组的下标都没被初始化。那为什么`Array.apply(null, { length: 5 })`可以得到一个全部初始化为`undefined`的数组呢？

#### 理解`Function.prototype.apply()`

咱先不管`Array.apply(null, { length: 5 })`，先来看看`Array.apply(null, Array(5))`，后者可以得到同样的效果。

众所周知，`apply()`方法可以让你修改`function`的`this`绑定，然后塞数组参数给函数。咱们重点看下它是怎么处理参数的。根据ES5规范[Section 15.3.4.3](http://es5.github.io/#x15.3.4.3)可以看到: 

> 
1. Let argList be an empty List.
2. Let index be 0.
3. Repeat while index < n
    * Let indexName be ToString(index).
    * Let nextArg be the result of calling the [[Get]] internal method of argArray with indexName as the argument.
    * Append nextArg as the last element of argList.
    * Set index to index + 1.

是不是很枯燥的说明呢? 其实就是加上`for`去遍历第二个参数（`argList`），然后`push`到它自己的`argList`。可以用JS来模拟下:

```js
Function.prototype.apply = function(thisArg, argArray) {
  var len = argArray.length,
    argList = [];

  for (var i = 0; i < len; i += 1) {
    argList[i] = argArray[i];
  }

  // 底层实现的方法, v8当然不是这样子命名, 这里只是一个伪代码
  superMagicalFunctionInvocation(this, thisArg, argList);
};
```

这个时候`argList`每个值都是`undefined`了，所以可以使用数组的`map()`方法遍历了。也就是咱们已经解决了这个问题：`Array.apply(null, Array(5))`可以循环，然后遍历赋值。但是咱们看到原来它还可以写成`Array.apply(null, {length: N})`这样子的。为什么的呢? 这个是因为, 咱们继续看那个ES5文档, 有那么一段话： 

> Let len be the result of calling the [[Get]] internal method of argArray with argument "length".

也就是说你传一个`{length: N}`给`apply`函数, 它要拿到对应`length`然后设置对应`N`, `N`是指循环赋值给`argList`的次数。上面用JS模拟的情况就可以看到。第一句代码:

```js
var len = argArray.length;
```

所以咱们是可以通过`Array.apply(null, {length: N})`来设置。

到此为止，咱们可以通过如下代码来生成对应的递增序列：

```js
Array.apply(null, {length: N}).map((val, i) => i)
```

但是原文这个...

```js
Array.apply(null, {length: N}).map(Function.call, Number);
```

要怎么玩呢？怎么有那么大的魔力呢？

### `Array.prototype.map()`第二个参数

首先咱们可以在MDN文档里面找到第二参数的功能是啥呢？

> thisArg Optional. Value to use as this when executing callback.

咱们举个例子

```js
class Counter {
  constructor() {
    this.increment = 3;
  }
  
  inc(arr) {
    return arr.map(function(val) { return this.increment + val })
  }
}

var c = new Counter();
c.inc([1,2,3]);
```

会报错 `Cannot read property 'increment' of undefined`，因为`this`变成了`undefined`了。为什么会变成了`undefined`了呢？这个涉及到JS的`this`问题，也是一个经典的问题，首先我们要明确下`this`是在运行时才确定的，不是在定义的时候确定的。`this`也是一个比较大的话题，这里也可以简单说下。继续看下ES5文档[15.4.4.19](http://www.ecma-international.org/ecma-262/5.1/#sec-11.2.3) ，是有关于`Array.prototype.map()`的

咱们摘出来一些我们想看的东西：

> If thisArg was supplied, let T be thisArg; else let T be undefined.

也就是如果`map()`第二个参数加上了`thisArg`的话，设置`T`为`thisArg`，没有的话就设置为`undefined`。

> Let mappedValue be the result of calling the [[Call]] internal method of callbackfn with T as the this value and argument list containing kValue, k, and O

循环调用`callbackfn`的`[[Call]]`内置方法并把刚才`T`当作它的`this`传过去，我们知道因为我们没有设置所以`T`是为`undefined`，`callbackfn`也就是上面的

```js
function(val){ return this.increment + val }
```

[13.2.1](http://www.ecma-international.org/ecma-262/5.1/#sec-8.7) `[[Call]]`是如何操作`this`的呢？

> Let funcCtx be the result of establishing a new execution context for function code using the value of F's [[FormalParameters]] internal property, the passed arguments List args, and the this value as described in 10.4.3.

简单来说就是创建一个新的函数上下文`funcCtx`，具体[10.4.3](http://www.ecma-international.org/ecma-262/5.1/#sec-10.4.3)会讲解函数如何处理`this`的, 咱们移步到那里看一看。

> If the function code is strict code, set the ThisBinding to thisArg.
Else if thisArg is null or undefined, set the ThisBinding to the global object.

函数`this`还会分成有没`strict mode`情况的。但是咱们没有在上面的代码看到`'use strict'`的语句，并且咱们的`thisArg`根据上面来看是`undefined`，那么它的`ThisBinding`应该是`global`才对呀，为什么是`undefined`呢？

咱们看看ES6文档[10.2.1](http://www.ecma-international.org/ecma-262/6.0/#sec-class-definitions)一句很重要的话就是

> All parts of a ClassDeclaration or a ClassExpression are strict mode code.

`Class`声明或者表达式都是默认严格模式，这样子是不是很明朗了。所以在严格模式下, `map`操作函数的时候，不管你放在那里，都不会去继承上一级的`this`，而是自己支配自己的`this`，thisArg是`undefined`, 那么`ThisBinding`也为`undefined`。这种在`method`里面执行函数的`this`有一个名词叫做`shadowing this`来描述这种`this`类型。

下面有四种解决方案：

1. 缓存`this`, 赋值给其他值

	```js
	class Counter {
	  constructor() {
	    this.increment = 3;
	  }
	
	  inc(arr) {
	    var that = this;
	    return arr.map(
	      function(val) {
	        return that.increment + val;
	      }
	    );
	  }
	}
	```
	
2. `function bind`

	```js
	class Counter {
	  constructor() {
	    this.increment = 3;
	  }
	
	  inc(arr) {
	    return arr.map(
	      function(val) {
	        return this.increment + val;
	      }.bind(this)
	    );
	  }
	}
	```

3. `Array.prototype.map()`设置第二个参数

	```js
	class Counter {
	  constructor() {
	    this.increment = 3;
	  }
	
	  inc(arr) {
	    return arr.map(function(val) {
	      return this.increment + val;
	    }, this);
	  }
	}
	```

4. ES6的箭头函数

	```js
	class Counter {
	  constructor() {
	    this.increment = 3;
	  }
	
	  inc(arr) {
	    return arr.map(val => this.increment + val);
	  }
	}
	```

但是这个不是我们讨论的范围之内。所以咱们知道`map()`第二个参数的作用就是设置第一个参数执行的时候的上下文。所以可以得到，其实这个：

```js
Array.apply(null, {length: N}).map(Function.call, Number);
```

就相当于

```js
Array.apply(null, {length: N}).map(Function.call.bind(Number));
```

### Function.call.bind

一开始看这个，感觉真的有点烧脑，还有被`Function.call`给骗了。其实咱们可以先拆分出来：

```js
Function.call.bind(Number)
```

<div align="center">⬇</div>

```js
// call其实也是一个函数, 所以它是具备有bind方法的
const call = Function.call;
call.bind(Number);
```

<div align="center">⬇</div>

```js
const call = Function.call;
() => call.apply(Number, arguments);
```

<div align="center">⬇</div>

```js
const call = Function.call;
() => Number.call(...arguments);
```

因为`() => Number.call(...arguments)`是放在`map()`里面的，所以`arguments`分别会是`[undefined, index, arr]`

<div align="center">⬇</div>

```js
const call = Function.call;
(undefined, index, arr) => Number.call(undefined, index, arr);
```

<div align="center">⬇</div>

```js
const call = Function.call;
(undefined, index, arr) => Number(index, arr);
```

很明显都会返回每一个`index`。

## 总结

结合上面的分析过程，原文中的代码有几个关键点：

* `Array(N)`得到的是一个稀疏数组，无法用于`map()`遍历；
* `Function.prototype.apply(thisArg, [argsArray])`方法是通过`for`循环去遍历`argsArray`的，并且循环的次数取决于`argsArray`的`length`属性。所以可以用一个`{length: 5}`去欺骗`apply`方法，从而得到一个初始化为`undefined`的数组;
* `Array.prototype.map()`第二个参数是设置上下文，于是`.map(Function.call, Number)`可以转换成 `.map((undefined, index, arr) => Number(index, arr))`;

所以原文的代码：

```js
Array.apply(null, {length: 5}).map(Function.call, Number);
```

就变成了：
  
```js
Array.apply(null, Array(5)).map((undefined, index, arr) => Number(index, arr))
```

大家以后可以多看看[ES5文档](http://es5.github.io/)，从一手文档中可以看到引擎是如何处理JavaScript的，更深入一层就是看V8源码，上面一些V8代码如果有一些错误的地方，请让我们知道，毕竟看得比较仓促，文档比较缺乏。

最后，大家千万不要在工作中写这样的代码，就算写了也要加注释，不然会被同事砍死的。

## 参考

* [Create array sequence [0, 1, ..., N-1] in one line](http://www.jstips.co/en/javascript/create-range-0...n-easily-using-one-line/)
* [Creating range in JavaScript - strange syntax](https://stackoverflow.com/questions/18947892/creating-range-in-javascript-strange-syntax/18949651)
* [Array.prototype.map](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Array/map)
* [无意中发现了JavaScript里面Array.map的一个bug?](https://www.zhihu.com/question/60919509)

