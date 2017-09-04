## Tab下划线动画原理

### 背景

看到了[ant-design Tab](https://ant.design/components/tabs-cn/)组件在切换的时候下划线可以移动, 感觉挺有趣的。所以想看看是怎么实现的。

### 过程

#### 1. 查看HTML结构

通过chrome开发者工具debug了一下, 看了下存在这个bar元素

```html
<div
  class="ant-tabs-ink-bar ant-tabs-ink-bar-animated"
  style="display: block; height: 37px; transform: translate3d(0px, 106px, 0px);"
/>
```

原来都是这个东西在移动, 加上一些`transition`就可以实现从某个地方移动到另外一个地方有过渡的效果了。对应的CSS transition

```css
tabs-right .ant-tabs-ink-bar-animated {
  -webkit-transition: height .3s cubic-bezier(.645, .045, .355, 1),
    -webkit-transform .3s cubic-bezier(.645, .045, .355, 1);
  transition: height .3s cubic-bezier(.645, .045, .355, 1),
    -webkit-transform .3s cubic-bezier(.645, .045, .355, 1);
  transition: transform .3s cubic-bezier(.645, .045, .355, 1),
    height .3s cubic-bezier(.645, .045, .355, 1);
  transition: transform .3s cubic-bezier(.645, .045, .355, 1);
}
```

那么现在的问题就是怎么知道移动的位置, 比如我点击第二个, 它移动到第二tab的位置。这里就涉及到如何去定位tab的问题了。

#### 2. 查看源代码

可以定位到[react-component](https://github.com/react-component/tabs/blob/master/src/InkTabBarMixin.js#L20-L38)这段代码。

```js
function offset(elem) {
  let box;
  let x;
  let y;
  const doc = elem.ownerDocument;
  const body = doc.body;
  const docElem = doc && doc.documentElement;
  box = elem.getBoundingClientRect();
  x = box.left;
  y = box.top;
  x -= docElem.clientLeft || body.clientLeft || 0;
  y -= docElem.clientTop || body.clientTop || 0;
  const w = doc.defaultView || doc.parentWindow;
  x += getScroll(w);
  y += getScroll(w, true);
  return {
    left: x, top: y,
  };
}
```


`offset`函数就是为了获取某个元素在整一个页面的位置, 可以通过x, y轴来确定。

* `elem.ownerDocument` 获取到`document`;

* `getBoundingClientRect`: 获取元素的大小(width/height)跟top/left, 不过它的top/left是相对于视口的, 也就是说如果存在滚动条, 这top/left会随着滚动而改变;
* `document.defaultView`获取的是window对象, 可以通过`window.pageXOffset`或者`window.pageYOffset`获取滚动条滚动的距离
* 最后相加得到某个元素在整一个页面的x, y位置。个人感觉一些代码有点冗余。比如:
  
  ```js
  x -= docElem.clientLeft || body.clientLeft || 0;
  y -= docElem.clientTop || body.clientTop || 0;
  ```
  
所以其实实现这个功能的找到activeTab的width/height还有它相对于父元素的距离。相对于父元素的距离可以通过`offset(container) - offset(activeTab)`来获取。获取activeTab的话更加简单, 可以用它的`offsetWidth, offsetHeight`属性。然后设置到ink-bar的样式里面就行了。