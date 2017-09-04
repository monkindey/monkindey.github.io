## Bubble

> ### 原理

遍历要排序的序列, 两两比较大小, 如果排序不符合预期就把两个元素调换过来, 重复操作到不需要交换。

> ### 复杂度

1. 最坏时间复杂度 O(n^2)
2. 最优时间复杂度	O(n)
3. 平均时间复杂度 O(n^2)

> ### 例子

比如我们有这个序列`5 1 4 2 8`, 假设咱们是升序, 就是最后会变成`1 2 4 5 8`

##### 第一次

* **5 1** 4 2 8 ➡️ **1 5** 4 2 8 **(**很明显 5 > 1, 所以交换位置**)**
* 1 **5 4** 2 8 ➡️ 1 **4 5** 2 8 **(**5 > 4 交换**)**
* 1 4 **5 2** 8 ➡️ 1 4 **2 5** 8 **(**同理**)**
* 1 4 **2 5** 8 ➡️ 1 4 **2 5** 8 **(**5 < 8, 所以不需要交换**)**

##### 第二次

* 1 **4 2** 5 8 ➡️ 1 **2 4** 5 8 **(**很明显 4 > 2, 所以交换位置**)**
* 1 2 **4 5** 8 ➡️ 1 2 **4 5** 8 **(**4 < 5, 所以不需要交换**)**
* 1 2 4 **5 8** ➡️ 1 2 4 **5 8** **(**5 < 8, 所以不需要交换**)**

第三, 四, 五次就不详细说了, 大概就是这个思路。

> ### 代码实现

```js
function bubble(arr, asc) {
  let tmp;
  arr = arr.concat();
  asc = asc === undefined ? true : asc;
  const compare = (a, b) => (asc ? a > b : a < b);

  for (let i = 0; i < arr.length; i++) {
    for (let j = i; j < arr.length; j++) {
      if (compare(arr[i], arr[j])) {
        tmp = arr[j];
        arr[j] = arr[i];
        arr[i] = tmp;
      }
    }
  }

  return arr;
}
```

> ### 优化

在我们上面的例子中, 我们可以看到原来在咱们第二步的时候已经把整一个序列排好序了。其实就没必要去执行下一步了。那我们是怎么知道已经是排好序的呢? 其实就是如果某一个循环没有交换位置的情况发生的时候就证明已经拍好序了。比如从第三次开始。

* 1 2 **4 5** 8 ➡️ 1 2 **4 5** 8 (没有交换位置, 符合升序)
* 1 2 4 **5 8** ➡️ 1 2 4 **5 8** (没有交换位置, 符合升序)

所以咱们可以设置一个标记, 如果某个第二层循环没有交换位置的话就证明它已经拍好序了。

```js
function bubble(arr, asc) {
  let tmp;
  // 是否已经排好序了
  let sorted = false;
  arr = arr.concat();
  asc = asc === undefined ? true : asc;
  const compare = (a, b) => (asc ? a > b : a < b);

  // 第一层for循环加上sorted的判断
  for (let i = 0; i < arr.length && !sorted; i++) {
    // 先假设它已经拍好序了
    sorted = true;
    for (let j = i; j < arr.length; j++) {
      if (compare(arr[i], arr[j])) {
        tmp = arr[j];
        arr[j] = arr[i];
        arr[i] = tmp;
        // 如果存在交换位置的话就证明它还没拍好序重置标记
        sorted = false;
      }
    }
  }

  return arr;
}
```

### 参考

* [https://en.wikipedia.org/wiki/Bubble_sort](https://en.wikipedia.org/wiki/Bubble_sort)

