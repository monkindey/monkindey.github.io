## 输入URL之后

当你输入一个URL之后究竟发生了什么事情了呢? 这个感觉很神秘, 让我们一层一层拨开来。

### 转换非ASCII的Unicode字符

对于非ASCII码的字符会进行Punycode编码, 这里科普下Punycode, 主要用于将unicode转换成可以用于DNS系统认识的编码, 比如你可以访问这个[美的.com](http://美的.com), 它其实会被转换成[http://xn--hxyt6q.com/](http://xn--hxyt6q.com/)这个网址。Punycode可以用来防止IDN欺骗, 也就是域名欺骗,原理很简单一些unicode字体存在很相似的字形, 比如下面两个字体(来源维基百科):

```js
var first="а",         //U+0430
    second="a";        //U+0061

alert(first==second);
```

其他例子可以看下这个[帖子](https://www.v2ex.com/t/355961)或者这篇文章[Chrome and Firefox Phishing Attack Uses Domains Identical to Known Safe Sites](https://www.wordfence.com/blog/2017/04/chrome-firefox-unicode-phishing/)(可能需要翻墙)

### 检查HSTS列表

一句话就是让你强行只能用https才能访问这个网站, Chrome客户端会内置预加载 HSTS列表。HSTS可以抵御SSL 剥离攻击, 因为用户很多时候一般不会在域名加上https, 导致服务端会给重定向, 从HTTP切换到HTTPS, 所以攻击者可以在用户访问HTTP页面时替换所有https开头的链接为http，达到阻止用户与服务端建立HTTPS连接的目的。

### DNS查询(域名解析)

* 浏览器先查看自己的缓存, 有就返回, 没有就下一步;
* 找不到浏览器缓存就会去找主机的Hosts文件;
* 主机的Hosts文件也找不到对应的就向本地配置首选的DNS服务器(Mac可以在Network - Preferences - Advanced - DNS 找到)发送DNS请求。

这个DNS请求是一个很好玩的环节, 不断地往返跑动才能知道最后的对应的IP。运营商拿到你DNS请求, 先从它自己的缓存, 看看自己能不能命中, 没有命中的话就替浏览器来递归访问不同级DNS服务器获取IP。比如`www.zhihu.com`, 先找到根域DNS的IP地址, 问它你知道`www.zhihu.com`的域名吗? 它回答说我不知道, 但是我可以知道com的IP地址, 你可以去问它吧, 然后运营商DNS服务器就拿到com的IP地址去问com, 你知道`www.zhihu.com`的IP地址吗? 它说我也不太清楚哦, 但是我知道`zhihu.com`这个域的DNS地址(一般是域名注册商提供), 然后运营商又去问了那个DNS地址了, 最后就找到对应的IP地址了。

### TCP三次握手建立连接

浏览器拿到域名对应的IP之后,  会以一个随机端口向WEB服务80端口发起TCP建立连接请求

* 客户端发送连接试探, SYN=1, 表示我这个是一个连接请求或者连接接受报文, 同时表示这个数据报不携带数据, seq=x, 表示是一个客户端的初始序列值, 这个时候客户端进入SYN-SENT状态;
* 服务端监听到连接请求, 如果同意连接, TCP的ACK SYN都置成1, 确认号为ack=x+1, 也就是告诉客户端说在x之前的数据我都收到, 同时自己选择一个序列号y; 服务端进入SYN-RCVD状态;
* 客户端设置ACK=1, 确认号ack=y+1, 自己的序列号为seq=x+1;

### HTTP

这个时候浏览器发送http请求, 对于http请求的格式是

```
<method> <path> <http-version>
<header>
<body>
```

服务器端接收到请求之后做出响应

```
<http-version><status-code> <statue-message>
<headers>
<body>
```

对于HTTP的各种头部信息是一个比较大的话题, 我们后续应该会新开一个issue来说。

### 浏览器渲染

当http获取到对应的HTML的时候, 这个时候就想要客户端来搞事了, 那么客户端怎么知道这个文本就是html呢? 可以根据服务端返回的响应报文头有一个`Content-Type: text/html; charset=utf-8`来识别。知道了现在给的文本是一个HTML文件, 那么就用渲染引擎进行解析, 对于渲染引擎一般有Safari的webkit, Chrome的Blink, Firefox的Gecko, 还有IE的Trident。

#### HTML解析

HTML其实就是一串字符串, HTML解析器会先语法分析生成tokens。然后根据tokens来创建对应的DOM。期间如果遇见script标签会调用JavaScript解析器。JavaScript是可以操作DOM的。所以HTML解析的时候需要等JavaScript执行完了之后才能继续DOM的创建。这个也是为什么我们要把script标签放到底部的原因。如果HTML需要依赖某个资源的话, 比如CSS, 图片等, 会重新发送请求到对应的服务器。但是这个操作是异步的, 可以继续解析HTML生成对应的DOM, 但是如果资源是JavaScript的话需要停下来解析, 等到请求完JavaScript再执行完JavaScript, 才能继续DOM的构建。

下面咱们用一个例子来解释一下如果外链是JavaScript时候浏览器是一个怎么样的行为。

例子可以参考 [How html resolve js on gist](https://gist.github.com/monkindey/fc7f3ae3a1886aba74889f9e6cdb1e42)

当你跑这个服务器的时候, 因为script标签时在head里面的, 并且它是等了差不多2s的时候才返回js文件的, 所以可以看到浏览器会先白屏差不多2s, 然后才有图片的显示。所以说浏览器会先等JavaScript加载后, 这个过程不是异步的。可以在Chrome开发者工具看到它需要等了2s才后数据返回, 服务端的锅, 哈哈。

<img width="811" alt="screen shot 2017-08-19 at 11 28 21 am" src="https://user-images.githubusercontent.com/6913898/29483168-43a0892e-84d3-11e7-836b-1d4d33f79b47.png">

那么浏览器是不是还要等解析完JavaScript才能继续后面的DOM构建呢? 

如果你在例子中的index.js改成这样子

```js
function sleep(time) {
  const now = Date.now();
  while (Date.now() - now < time * 1000) {}
}

sleep(5);
console.log('hello');
```
你会发现你的页面最少等了`7s`了才有点反应。

#### CSS解析

CSS会被解析成`StyleSheet`对象,每一个对象都有对应的规则。这些规则由选择器和声明构成。当样式规则创建之后, 需要做的事就是样式规则匹配到对应的DOM节点生成对应的Render树。在这里DOM树跟Render树不是一一对应的, 一些不可显示的DOM节点是不会插入到Render树的, 比如head节点, 还有`display:none`的元素。

在构建Render树的时候存在一些难点:

* 样式数据太大
* 如何匹配到对应的DOM
* 如何应用(涉及到优先级与继承)

对于第二个问题, 在解析CSS的时候, 这些规则会根据你的选择器来存放在不同的Hash Map。如果这个选择器是id的话, 它会被放在id map中, 如果是class就放在class map中。下面咱们举一个简单的例子来看, 例子来源于《How Browsers Work》

CSS规则

```css
p.error {color: red}
#messageDiv {height: 50px}
div {margin: 5px}
```

`p.error`会被放在class map中, `#messageDiv`会被放在id map中, `div`会被放在tag map中。

HTML

```html
<p class="error">an error occurred </p>
<div id="messageDiv">this is a message</div>
```

浏览器找到潜在的选择器, 然后根据它们的类别去不同的map中找, 比如对于P元素, 找到选择器是class为error, 然后去class map里面找, 找到`p.error`, 按照css的语法, 这个刚好跟p元素是匹配的, 所以这个`p.error`这个规则就被存在`RenderObject`中。对于div也是一样, 找到id map, 还有tag map。

但是对应这个规则

```css
table div {margin: 5px}
```

这个规则也会从tag map里拿出来, 因为匹配都是从右到左, 刚好上面的HTML有div节点, 所以会找到这个css规则。但是它不会被存储到RenderObject是因为根据CSS语法, 发现这个div元素并不在table的子元素里面, 所以就将它放弃了。

而对应第三个问题, 每一个样式类别都是有自己的权重, 根据权重的高低来决定最后的样式, 如果没有的话就会去继承父类。

#### Layout

在上面已经讲了, 通过DOM与CSS合并成`Render`树, Render树是由`RenderObject`组成的。但是它们还是没有大小和位置概念。计算它们大小和位置就叫做布局。HTML存在一个默认的正常布局流, 从左到右, 自上到下布局。一个页面是两维的, 可以通过(x, y)就可以确定元素位置。所以根RenderObject的位置是(0, 0)。

布局的过程是递归的, 主要还是每一个`RenderObject`的layout函数来完成。遇到每一个`RenderObject`, 对于一些块级元素设置了自身宽高, 那么浏览器就以定义好的宽高来确定该元素的尺寸大小。如果没有设置或者像是inline元素的话, 需要结合它子元素的盒子模型大小才能确定它的大小, 然后再设置子元素的位置。这个过程会递归下去直到没有子元素。

#### Paint

当我们经历layout步骤了, 这个时候我们都确定每一个元素的大小与位置了。这个时候最后一步就是把它渲染出来了, 我们的页面也就出来了。其实一句话就是遍历Render树然后执行每一个RenderObject的paint方法。有两种渲染方式, 一个是软件渲染, 通过CPU来完成绘画, 一种是硬件加速, 通过GPU来完成绘画。


### 未完待续

TODO

* 部分代码佐证
* 例子说明
* 网络层 + 链路层

### 参考

* [How Browsers Work: Behind the scenes of modern web browsers](https://www.html5rocks.com/en/tutorials/internals/howbrowserswork/)
* [What happens when](https://github.com/skyline75489/what-happens-when-zh_CN/blob/master/README.rst)
* [HOW BROWSER works PPT](http://arvindr21.github.io/howBrowserWorks/#/)
* [Inside a super fast CSS engine](https://hacks.mozilla.org/2017/08/inside-a-super-fast-css-engine-quantum-css-aka-stylo/)