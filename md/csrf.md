## CSRF

### 前言

这个名字感觉有点难记, 中文名是**跨站请求伪造**, 英文名是**Cross Site Request Forgery**。那么它是怎么伪造的呢? 又是怎么攻击的呢? 首先它是不会拿到你的cookie, 而是利用浏览器发送请求默认带上cookie的行为。 每一个请求都会带上属于你自己在这个域名之前保留下的cookie, 不管你这个请求是在地址栏还是在嵌入到**任何页面**的请求。

### 背景

> 下面都是假设

比如你已经去访问一个某个银行的网站, 保持之前的cookie了。他们转账的URL请求可能是这样子的`http://bank.com/transfer.do?acct=BOB&amount=100`, acct是接受人, amount是转账金额, 后端一定会以cookie来验证你现在是谁, 然后再做操作。现在假设你已经登录过那家银行了, 然后浏览器保存了它的cookie。

然后有一个攻击网站就在它的网站里面嵌入了这样子的代码, 比如它的受益者是`MARIA`

```html
<img src="http://bank.com/transfer.do?acct=MARIA&amount=100000">
```
当你访问这个网站的时候, 你就给MARIA 10000块了。那这是为什么呢?

### 原理

1. 页面在解析HTML的时候看到有URL都会发送请求, 所以看到img的URL, 浏览器会帮忙发送GET请求;
2. 上面已经说了, 浏览器有默认带上cookie的行为。如果之前登录过就会留下cookie, 所以在发送这个GET请求的时候, 浏览器就带上你的cookie了;
3. 后端验证你的cookie, 确认你是谁然后执行转账操作

这个是最简单的一个攻击;

### 升级

大概知道CSRF的原理, 咱们在对请求伪造再升级下。我们知道GET最好是设计成幂等的, 也就是说不会对数据产生副作用。所以某个银行的转账接口变成了POST的呢？对应HTTP请求

```http
POST http://bank.com/transfer.do HTTP/1.1
acct=BOB&amount=100
```

这个时候img嵌入其实是没什么用的, 后端做了校验了, 所以问题就是我们怎么去伪造一个POST请求。对了, 我们还是有Form表单呢。

```html
<form action="http://bank.com/transfer.do" method="POST">
  <input type="hidden" name="acct" value="MARIA"/>
  <input type="hidden" name="amount" value="100000"/>
  <input type="submit" value="View my pictures"/>
</form>

<script>
  document.forms[0].submit();
</script>
```

攻击者把它嵌入到它自己的网站`http://iamattacker.com`上去, 又可以让你少了10000块钱了。咦, 这个时候你可能会纳闷, 为什么Form表单的POST请求是可以跨域的呢? 这个就跟同源策略有关系了, 对于Form表单的POST, 如果不用iframe的话, 让它更新到iframe的话, 然后保留本页面的话, Form表单是会刷新的, 所以Form表达的POST之后, 本页面是不会获取到POST之后的数据。因为页面刷新, js的生命周期也就没了。所以其实本质上的同源策略是你可以访问其他域名, GET/POST都可以, 但是你的js是不能读取不同域名**返回的内容**。

### 例子

[gist例子](https://gist.github.com/monkindey/53ab4e90df8e9d927fe2b2661eb6bc5f)

### 预防

知道原理, 才能对症下药

#### 1. **GET**是幂等的

服务端不要用GET来实现数据的更新, 产生副作用

#### 2. 只允许JSON数据

因为Form表单提交会到达上面的问题, Form表单一般有两种, 一种是`application/x-www-form-urlencoded`, 另外一种是`multipart/form-data`

#### 3. 检查referrer

如果是外来页面来访问这个URL的话就不给, 比如上面攻击者在自己的网站`http://iamattacker.com`嵌入了一些form表单提交代码, 如果它POST了数据到`http://bank.com/transfer.do`。那么它的HTTP请求会加上referer为`http://iamattacker.com`, 然后`http://bank.com/transfer.do`知道referer不是`bank.com`或者它自己的白名单的话, 就剔除掉, 返回400。

#### 4. CSRF Tokens

* 模版引擎将token渲染到页面
* 客户端发送请求带上token

### 参考

* [OWASP's Cross-Site Request Forgery](https://www.owasp.org/index.php/Cross-Site_Request_Forgery_(CSRF))
* [为什么form表单提交没有跨域问题，但ajax提交有跨域问题？](https://www.zhihu.com/question/31592553)
* [understanding-csrf](https://github.com/pillarjs/understanding-csrf)