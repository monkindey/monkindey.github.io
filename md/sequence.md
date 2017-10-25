## JS递增序列的深入分析


> ### 背景

有一天看到这个[js tips](http://www.jstips.co/), 感觉他的某个写法确实很有趣, 也很是懵懂。所以想去了解下它。对应的写法是这样子的

```js
Array.apply(null, {length: N}).map(Function.call, Number);
```

也就是你可以通过这样子生成一个序列数组

```js
Array.apply(null, {length: 5}).map(Function.call, Number);
```

生成

```js
[0, 1, 2, 3, 4]
```

> ### 过程

#### 初步想法

其实我第一反应是打算这样子实现的, 代码如下:

```js
Array(5).map((va, i) => i)
```

但是它返回的是`[undefined × 5]`, 当时就很郁闷。

#### 借助搜索引擎

咱们暂时先不管`{length: 5}`, 先用Array(5)替代`{length: 5}`, 那`Array.apply(null, Array(5))`跟`Array(5)`有什么区别呢? 各种途径找问题, 真心有问题在**StackOverflow**上面找, 有一篇文章(下面`参考`第二个链接)写的很好。

#### 为什么不是`Array(5)`

首先`Array(5)`可以参考 [Array(len)](http://www.ecma-international.org/ecma-262/6.0/#sec-array-len)

> * Let array be ArrayCreate(0, proto).
* If Type(len) is not Number, then
	* Let defineStatus be CreateDataProperty(array, "0", len).
	* Assert: defineStatus is true.
	* Let intLen be 1.
* Else,
	* Let intLen be ToUint32(len).
	* If intLen ≠ len, throw a RangeError exception.

也就是它会通过`ArrayCreate`来创建一个数组`array`, 如果Type(len)为Number的话, 就让`array`的intLen赋值ToUint32(len), 可以用JavaScript模拟

```js
function Array(len) {
  var ret = [];
  ret.length = len;
  return ret;
}
```

详细可以看一下v8 [runtime-array](https://github.com/v8/v8/blob/6.4.96/src/runtime/runtime-array.cc#L381) 

```c++
factory->NewJSArrayStorage(array, 0, 0, DONT_INITIALIZE_ARRAY_ELEMENTS);
```

再看看`NewJSArrayStorage`的[代码](https://github.com/v8/v8/blob/6.4.96/src/factory.cc#L2028)

```c++
if (capacity == 0) {
  array->set_length(Smi::kZero);
  array->set_elements(*empty_fixed_array());
  return;
}
```

因为capacity是第三个参数为0, 所以会跑这个逻辑, 主要的处理就是设置数组的length为0, 数组元素是`empty_fixed_array`。

真正完成JS初始化的是`ArrayConstructInitializeElements`函数, 具体实现在 [ArrayConstructInitializeElements](https://github.com/v8/v8/blob/6.4.96/src/elements.cc#L4237)

截取`ArrayConstructInitializeElements`函数[部分代码](https://github.com/v8/v8/blob/6.4.96/src/elements.cc#L4239-L4268)

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

Array(len)生成对应的数组的话, 会走`args->length() == 1 && args->at(0)->IsNumber()`这个流程, 然后会跑`JSArray::Initialize`

```c++
void JSArray::Initialize(Handle<JSArray> array, int capacity, int length) {
  ASSERT(capacity >= 0);
  array->GetIsolate()->factory()->NewJSArrayStorage(
       array, length, capacity, INITIALIZE_ARRAY_ELEMENTS_WITH_HOLE);
}
```

重新走了上面的`NewJSArrayStorage`的[流程](https://github.com/v8/v8/blob/6.4.96/src/factory.cc#L2028-L2062), 因为`capacity`不为0, 并且model为`INITIALIZE_ARRAY_ELEMENTS_WITH_HOLE`, 所以会走这个逻辑。

```c++
elms = NewFixedArrayWithHoles(capacity);
```

所以生成的每一个元素都是`hole`类型, 并非`undefined`, 其实这样子就是生成了稀疏数组(sparse array)。

然后我们可以参考MDN里面的[map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map)方法, 可以看到这一段话

> It is not called for missing elements of the array (that is, indexes that have never been set, which have been deleted or which have never been assigned a value)

意思就是说如果数组里某个坐标没有值的话, map函数会直接跳过, 不会执行的。

咱们可以先来看三个例子

**第一个例子**

```js
var arr = ['v', 'a', undefined, 'r'];
arr.map(v => v.toUpperCase())
```
这个会报错`Cannot read property 'toUpperCase' of undefined`, 哦, 原来map的时候不会过滤掉`undefined`的哈, undefined很明显没有toUpperCase方法, 所以报错了。

**第二个例子**

```js
var arr = ['v', 'a', undefined, 'r'];
delete arr[2];
arr.map(v => v.toUpperCase())
```

没有报错, 返回的是`["V", "A", undefined × 1, "R"]`

**第三个例子**

```js
var arr = ['v', 'a'];
arr[3] = 'r'
arr.map(v => v.toUpperCase())
```

结果同上。

所以咱们对于`missing element of the array`的理解就是它其实不是`undefined`, 正如mdn说的它要么被delete掉了要么没有赋值。

咱们现在再来看`Array(5)`, 其实只是创建一个数组对象, 然后把它的length修改成5而已, 所以它里面值都是没有赋值的。所以map循环不会执行对应的callback函数。不然你可以这样子实验

```js
Array(5).map((va, i) => console.log(i))
```
其实在控制台是没有打印出来东西的。

如果这样子你还不相信的话, 咱们再来详细解释下。可以从**ECMA-262**看下[Array.prototype.map](http://www.ecma-international.org/ecma-262/6.0/#sec-array.prototype.map), 咱们先抓住重点, 有那么一段话: 

> 
* Let kPresent be HasProperty(O, Pk).
* ReturnIfAbrupt(kPresent).

在执行callback函数的时候, 有一个检测`HasProperty`, 检测对象有没对应的属性, 而根据[HasProperty (O, P)](http://www.ecma-international.org/ecma-262/6.0/#sec-hasproperty), 其实最后是调用`O.[[HasProperty]](P)`。在这里捎带说下Array在v8里面的数据结构表示, 分成两种, 可以看下[注释](https://github.com/v8/v8/blob/6.4.96/src/objects/js-array.h#L16-L20):

> The JSArray describes JavaScript Arrays. Such an array can be in one of two modes: fast, backing storage is a FixedArray and length <= elements.length(); slow, backing storage is a HashTable with numbers as keys.

在正常的方式

```js
var arr = [1, 2, 3];
```

会创建fast模式。但是如果下面的方式就会创建slow模式, 也就是字典的数据结构来存储数组

```js
// 1
var arr1 = [1, 2, , 4];
// 2
var arr2 = Array(5);

// 3
var arr3 = [];
arr3[2000] = 2000; 
```

`arr1`, `arr2`, `arr3`都会以hashTable来存储数组数据。

arr1可以这样子表示

```js
{
  0: 1,
  1: 2,
  3: 4,
  length: 3
}
```

arr2可以这样子表示

```js
{
  length: 5
}
```

因为我们只对arr2数组加上了length属性, 当然也就是0, 1等下标的属性数组是没有。所以这个场景`HasProperty`返回的是false, 也就是不会走下面的流程即是调用callback

> 
* Let kValue be Get(O, Pk).
* ReturnIfAbrupt(kValue).
* Let mappedValue be Call(callbackfn, T, «kValue, k, O»)

咱们可以从v8代码里找到一些内容, [builtins-array-gen](https://github.com/v8/v8/blob/6.4.96/src/builtins/builtins-array-gen.cc#L552-L558)

```c++
Node* k_present = HasProperty(o(), k(), context(), kHasProperty);
GotoIf(WordNotEqual(k_present, TrueConstant()), &done_element);
```

也就是说如果`HasProperty`执行之后是false的话, 就不会执行下面的操作, 直接goto到`&done_element`位置

#### apply原理

apply可以让你修改function的this绑定, 然后塞数组参数给函数。咱们重点看下它是怎么处理参数的。根据[Section 15.3.4.3](http://es5.github.io/#x15.3.4.3)可以看到: 

> 
1. Let argList be an empty List.
2. Let index be 0.
3. Repeat while index < n
    * Let indexName be ToString(index).
    * Let nextArg be the result of calling the [[Get]] internal method of argArray with indexName as the argument.
    * Append nextArg as the last element of argList.
    * Set index to index + 1.

是不是很枯燥的说明呢? 其实就是加上for去遍历然后push到它自己的argList。可以用JavaScript来模拟下:

```js
Function.prototype.apply = function(thisArg, argArray) {
  var len = argArray.length,
    argList = [];

  for (var i = 0; i < len; i += 1) {
    argList[i] = argArray[i];
  }

  //底层实现的方法, v8当然不是这样子命名, 这里只是一个伪代码
  superMagicalFunctionInvocation(this, thisArg, argList);
};
```

这个时候argList每个值都是`undefined`了,  所以可以map遍历了。也就是咱们已经解决了这个问题: `Array.apply(null, Array(5))`可以循环, 然后遍历赋值。但是咱们看到原来它还可以写成`Array.apply(null, {length: N})`这样子的。为什么的呢? 这个是因为, 咱们继续看那个ES5文档, 有那么一段话: 

> Let len be the result of calling the [[Get]] internal method of argArray with argument "length".

也就是说你传一个`{length: N}`给apply函数, 它要拿到对应length然后设置对应n, n是指循环赋值给argList的次数。上面用js模拟的情况就可以看到。第一句代码:

```js
var len = argArray.length;
```

所以咱们是可以通过`Array.apply(null, {length: N})`来设置。

但是呢, 咱们只是解释到可以通过

```js
Array.apply(null, {length: N}).map((val, i) => i)
```
来生成对应的递增序列。但是这个...

```js
Array.apply(null, {length: N}).map(Function.call, Number);
```
要怎么玩呢? 怎么有那么大的魔力呢?

#### Array map 第二个参数

首先咱们可以在mdn map文档里面找到第二参数的功能是啥呢? 

> thisArg Optional. Value to use as this when executing callback.

咱们举个例子

```js
class Counter {
  constructor() {
    this.increment = 3;
  }
  
  inc(arr) {
    return arr.map(function(val){ return this.increment + val })
  }
}

var c = new Counter();
c.inc([1,2,3]);
```

会报错 `Cannot read property 'increment' of undefined`, 因为this变成了undefined了。为什么会变成了undefined了呢? 这个涉及到JavaScript的this问题, 也是一个经典的问题, 首先我们要明确下this是在运行时才确定的, 不是在定义的时候确定的。this也是一个比较大的话题, 这里也可以简单说下。继续看下ES5文档[15.4.4.19](http://www.ecma-international.org/ecma-262/5.1/#sec-11.2.3), 是有关于Array.prototype.map的

咱们摘出来一些我们想看的东西

> If thisArg was supplied, let T be thisArg; else let T be undefined.

也就是如果map第二个参数加上了thisArg的话, 设置T为thisArg, 没有的话就设置为undefined.

> Let mappedValue be the result of calling the [[Call]] internal method of callbackfn with T as the this value and argument list containing kValue, k, and O

循环调用callbackfn的[[Call]]内置方法并把刚才T当作它的this传过去, 我们知道因为我们没有设置所以T是为undefined, callbackfn也就是上面的

```js
function(val){ return this.increment + val }
```

[13.2.1](http://www.ecma-international.org/ecma-262/5.1/#sec-8.7) [[Call]]是如何操作this的呢? 

> Let funcCtx be the result of establishing a new execution context for function code using the value of F's [[FormalParameters]] internal property, the passed arguments List args, and the this value as described in 10.4.3.

简单来说就是创建一个新的函数上下文funcCtx, 具体[10.4.3](http://www.ecma-international.org/ecma-262/5.1/#sec-10.4.3)会讲解函数如何处理this的, 咱们移步到那里看一看。

> If the function code is strict code, set the ThisBinding to thisArg.
Else if thisArg is null or undefined, set the ThisBinding to the global object.

函数this还会分成有没strict mode情况的。但是咱们没有在上面的代码看到'use strict'的语句, 并且咱们的thisArg根据上面来看应该是undefined, 那么它的ThisBinding应该是global才对呀, 为什么是undefined呢?

咱们看看ES6文档[10.2.1](http://www.ecma-international.org/ecma-262/6.0/#sec-class-definitions)一句很重要的话就是

> All parts of a ClassDeclaration or a ClassExpression are strict mode code.

Class声明或者表达式都是默认严格模式, 这样子是不是很明朗了。所以map操作函数的时候, 不管你放在那里, 都不会去继承上一级的this, 而是自己存在自己的this, 对于this的值有对应的规则可循。这种在method里面执行函数的this有一个名词叫做`shadowing this`来描述这种this情况。

下面有四种解决方案

1. 缓存this, 赋值给其他值

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
	
2. function bind

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

3. Array.prototype.map 设置第二个参数

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

但是这个不是我们讨论的范围之内。所以咱们知道map第二个参数的作用就是设置第一个参数执行的时候的上下文。所以可以得到, 其实这个

```js
Array.apply(null, {length: N}).map(Function.call, Number);
```

就相当于

```js
Array.apply(null, {length: N}).map(Function.call.bind(Number));
```

#### Function.call.bind

一开始看这个, 感觉真的有点烧脑, 还有被`Function.call`给骗了。其实咱们可以先拆分出来。

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
() => Number.call(arguments);
```

因为`() => Number.call(arguments)`是放在map里面的, 所以arguments分别会是`[undefined, index, arr]`

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

很明显都会返回每一个index。


**本文完**

> ### 总结

以后可以多看看[ES5文档](http://es5.github.io/), 从一手文档中可以看到引擎是如何处理JavaScript的, 更深入一层就是看v8源码, 上面一些v8代码如果有一些错误的地方, 请让我们知道, 毕竟看得比较仓促, 文档比较缺乏。

* Array.apply(null, {length: 5}) apply处理的是通过for循环遍历第二个参数设置的长度, 新建一个数组去拿到第二个参数的值, 所以得到的是5个undefined元素的数组;
* Array.prototype.map第二个参数是设置上下文;
* `Function.call.bind(Number)`可以转换成 `(undefined, index, arr) => Number(index, arr)`;
* 所以整一个

  ```js
  Array.apply(null, {length: 5}).map(Function.call, Number);
  ```
  就变成了
  
  ```js
  Array.apply(null, Array(5)).map((undefined, index, arr) => Number(index, arr))
  ```

> ### 参考

* [Create array sequence [0, 1, ..., N-1] in one line](http://www.jstips.co/en/javascript/create-range-0...n-easily-using-one-line/)
* [Creating range in JavaScript - strange syntax](https://stackoverflow.com/questions/18947892/creating-range-in-javascript-strange-syntax/18949651)
* [Array.prototype.map](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Array/map)
* [无意中发现了JavaScript里面Array.map的一个bug?](https://www.zhihu.com/question/60919509)
