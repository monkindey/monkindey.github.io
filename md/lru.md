## Vue缓存策略

其实Vue的缓存策略是借鉴一个库 [js-lru](https://github.com/rsms/js-lru)，该缓存策略有两个特点
- LRU(Least Recently Used) 最近使用最少策略
- doubly-linked list 双向链表

我为我自己也是为大家科普下**LRU**算法思路和**双向链表**，知道的话可以自行**忽略**
### LRU

> 基于长时间不被使用，后面使用的可能性就越小的思路

当缓存满了，最近使用最少的数据就会被**T**掉，就好像人在职场一样，你的存在感很小，等公司
人员要优化，你第一个就会被炒了。
### 双向链表

> 引用[链表-维基百科](https://zh.wikipedia.org/wiki/%E9%93%BE%E8%A1%A8)
> 简单一点地理解就是你能知道我，我也能知道你，有一个更加形象的例子就是，
> 你牵着我手，我牵着你手，如图所示
> ![双向链表](https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Doubly-linked-list.svg/610px-Doubly-linked-list.svg.png)

那么问题来了，为什么要用双向链表呢？为什么不用数组呢？
比如我们数组是这样子 **[3, 4, 5, 8, 7]**，根据我们的**LRU**算法，当我们的某个元素
比如**4**被使用了，那么它应该被提到队列的最前面咯，存在感最强了，就会变成**[3, 5, 8, 7, 4]**
如果是数组的话，就要移动差不多**n**个元素哦，也就是**时间复杂度**是 _O(n)_，但是用的是
链表的话**时间复杂度**为_O(1)_，所以**数据结构**在代码层面上是很重要的一个环节哦。

下面引用**js-lru**库的[README.md](https://github.com/rsms/js-lru/blob/master/README.md)的图来介绍下会更加清晰

``` javascript
    entry             entry             entry             entry        
    ______            ______            ______            ______       
   | head |.newer => |      |.newer => |      |.newer => | tail |      
   |  A   |          |  B   |          |  C   |          |  D   |      
   |______| <= older.|______| <= older.|______| <= older.|______|      

removed  <--  <--  <--  <--  <--  <--  <--  <--  <--  <--  <--  added
```

每一个缓存都是有三个重要的函数，一个是**get**，一个是**put**，另外一个是**shift**，
还会维护一些属性比如**tail,  head**(删除就在它的头部开刀)，最重要是**_keymap**，直接把命中
的复杂度优化成_O(1)_，典型的空间换时间；
缓存里面每一项(entry)的结构都是 **older**(指向它的前序节点)，**newer**(指向它的后序节点)， **value**
结合代码来看下

``` javascript
p.get = function(key, returnEntry) {
    var entry = this._keymap[key];
    if (entry === undefined) return;
    if (entry === this.tail) {
        return returnEntry ? entry : entry.value;
    }
    if (entry.newer) {
        if (entry === this.head) {
            this.head = entry.newer;
        }
        entry.newer.older = entry.older; 
    }
    if (entry.older) {
        entry.older.newer = entry.newer; 
    }
    entry.newer = undefined; 
    entry.older = this.tail;
    if (this.tail) {
        this.tail.newer = entry;
    }
    this.tail = entry;
    return returnEntry ? entry : entry.value;
};
```

**get**做的重要的事情就是用_keymap对象用_O(1)_复杂度找到对应的项(entry)，并且将对应的项(entry)在链表中拆出来并且放到**tail**，最近被用到的项(entry)都会放到队尾的，这样子队首(head)
就是我们要开刀的值了，因为它最近没被用到的。

``` javascript
p.put = function(key, value) {
    var removed;
    var entry = this.get(key, true);
    if (!entry) {
        if (this.size === this.limit) {
            removed = this.shift();
        }
        entry = {
            key: key
        };
        this._keymap[key] = entry;
        if (this.tail) {
            this.tail.newer = entry;
            entry.older = this.tail;
        } else {
            this.head = entry;
        }
        this.tail = entry;
        this.size++;
    }
    entry.value = value;

    return removed;
};
```

**put**做的事情就是先保证该缓存里面是不是有这个值，有的话就不塞进去了，没有的话，在看看是不是超出缓存的最大容量了，是的话，就对队头开刀了，并把值塞到队尾。可能画出流程图看起来比较明朗清晰点，不过源代码也不是太难懂。

### vue缓存策略可视化

让你更容易理解它的缓存策略原理，对应的[github](https://github.com/monkindey/vc), 对应的[可视化页面](http://www.monkindey.xyz/vc/)

### 运用于Vue

对于一些复杂的操作，可以把结果缓存起来，可以在[parseDirective](https://github.com/vuejs/vue/blob/dev/src/parsers/directive.js#L78) 等函数看到缓存的运用

### 参考资料
- **[探索vue源码之缓存篇](https://segmentfault.com/a/1190000006670689)**
- **[js-lru's README.md](https://github.com/rsms/js-lru/blob/master/README.md)**
