## Create array sequence `[0, 1, ..., N-1]

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

#### 最开始写法

其实我第一反应是打算这样子实现的, 代码如下:

```js
Array(5).map((va, i) => i)
```

但是它返回的是`[undefined × 5]`, 当时就很郁闷。

#### Google找问题

这样子我就很想知道`Array.apply(null, Array(5))`跟`Array(5)`有什么区别呢? 然后就各种途径找问题, 真心有问题在**StackOverflow**上面找, 有一篇文章(下面`参考`第二个链接)写的很好。

#### 为什么不是`Array(5)`呢?

首先`Array(5)`归根结底是

```js
function Array(len) {
  var ret = [];
  ret.length = len;
  return ret;
}
```

然后我们可以参考mdn里面的map方法, 可以看到这一段话

> It is not called for missing elements of the array (that is, indexes that have never been set, which have been deleted or which have never been assigned a value)

咱们来看三个例子

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

所以咱们对于missing element of the array的理解就是它其实不是undefined, 正如mdn说的它要么被delete掉了要么没有赋值。

咱们现在再来`Array(5)`, 其实只是创建一个数组对象, 然后把它的length修改成5而已, 所以它里面值都是没有赋值的。所以map循环不了呀。不然你可以这样子实验

```js
Array(5).map((va, i) => console.log(i))
```
其实在控制台是没有打印出来东西的。

#### apply原理

apply可以让你修改function的this绑定, 然后塞数组参数给函数。咱们重点看下它是怎么处理参数的。根据[Section 15.3.4.3](http://es5.github.io/#x15.3.4.3)可以看到: 

1. Let argList be an empty List.
2. Let index be 0.
3. Repeat while index < n

    * Let indexName be ToString(index).
    * Let nextArg be the result of calling the [[Get]] internal method of argArray with indexName as the argument.
    * Append nextArg as the last element of argList.
    * Set index to index + 1.

是不是很枯燥的说明的? 其实就是加上for去遍历然后push到它自己的argList。可以用JavaScript来模拟下:

```js
Function.prototype.apply = function(thisArg, argArray) {
  var len = argArray.length,
    argList = [];

  for (var i = 0; i < len; i += 1) {
    argList[i] = argArray[i];
  }

  //底层实现的方法
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

其实咱们可以在mdn map文档里面找到第二参数的功能是啥呢? 

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

Class声明或者表达式都是默认严格模式, 这样子是不是很明朗了。所以map操作函数的时候, 不管你放在那里, 都不会去继承上一级的this, 而是自己存在自己的this, 对于this的值有对应的规则可循。这种在method里面执行函数的this有一个名词叫做`shadowing this`来描述这种this情况

所以咱们可以变成这样子。

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

但是咱们还是可以再简单点的, 用到的是map的第二个参数

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

当然最简单的是用到ES6的箭头函数

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
const call = Function.call
call.bind(Number)
```

<div align="center">⬇</div>

```js
const call = Function.call
() => call.apply(Number, arguments)
```

<div align="center">⬇</div>

```js
const call = Function.call
() => Number.call(arguments)
```

因为`() => Number.call(arguments)`是放在map里面的, 所以arguments分别会是`[undefined, index, arr]`

<div align="center">⬇</div>

```js
const call = Function.call
(undefined, index, arr) => Number.call(undefined, index, arr)
```

<div align="center">⬇</div>

```js
const call = Function.call
(undefined, index, arr) => Number(index, arr)
```

很明显都会返回每一个index。

#### 完结

现在咱们终于有点把它弄清楚了。

> ### 总结

以后多看看[ES5文档](http://es5.github.io/), 从一手文档中可以看到引擎是如何处理JavaScript的。

* Array.apply(null, {length: 5}) apply处理的是通过for循环遍历第二个参数设置的长度, 新建一个数组去拿到第二个参数的值, 所以得到的是5个undefined元素的数组;
* Array.prototype.map第二个参数是设置上下文
* `Function.call.bind(Number)`可以转换成 `(undefined, index, arr) => Number(index, arr)`

> ### 参考

* [Create array sequence [0, 1, ..., N-1] in one line](http://www.jstips.co/en/javascript/create-range-0...n-easily-using-one-line/)
* [Creating range in JavaScript - strange syntax](https://stackoverflow.com/questions/18947892/creating-range-in-javascript-strange-syntax/18949651)
* [Array.prototype.map](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Array/map)
