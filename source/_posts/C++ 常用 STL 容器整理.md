---
title: 'C++ 常用 STL 容器整理'
date: '2026-05-20T19:47:54+08:00'
updated: '2026-05-20T20:16:18+08:00'
abbrlink: ''
---
# C++ 常用 STL 容器与函数整理

  ## STL 简介

  STL，全称 Standard Template Library，即标准模板库。

  常用内容主要包括：

  | 类型 | 代表内容 |
  |---|---|
  | 顺序容器 | vector、deque、list |
  | 容器适配器 | stack、queue、priority_queue |
  | 关联容器 | set、map、multiset、multimap |
  | 无序关联容器 | unordered_set、unordered_map |
  | 字符串 | string |
  | 工具类型 | pair、tuple |
  | 常用算法 | sort、reverse、lower_bound、unique |

  竞赛常用万能头文件：

```cpp
  #include <bits/stdc++.h>
  using namespace std;
```


  # 常用容器总览

  | 容器 | 特点 | 常见用途 |
  |---|---|---|
  | vector | 动态数组，支持随机访问 | 存数组、邻接表 |
  | deque | 双端队列，头尾都能快速插删 | 滑动窗口、单调队列 |
  | stack | 后进先出 | 括号匹配、DFS |
  | queue | 先进先出 | BFS |
  | priority_queue | 优先队列，默认大根堆 | 贪心、Dijkstra |
  | map | 有序键值对 | 计数、映射 |
  | unordered_map | 无序键值对，平均更快 | 快速计数、查找 |
  | set | 有序去重集合 | 去重、排序、查找 |
  | multiset | 有序可重复集合 | 维护可重复数据 |
  | unordered_set | 无序去重集合 | 快速判重 |
  | string | 字符串 | 文本处理 |
  | bitset | 二进制位集合 | 状态压缩、位运算 |



  # vector

  vector 是动态数组，支持随机访问。

```cpp
  vector<int> v;
  vector<int> v(n);
  vector<int> v(n, 0);
```

  ## 常用成员函数

  | 函数 | 作用 |
  |---|---|
  | v.push_back(x) | 尾部插入元素 |
  | v.emplace_back(x) | 尾部原地构造元素 |
  | v.pop_back() | 删除最后一个元素 |
  | v.size() | 返回元素个数 |
  | v.empty() | 判断是否为空 |
  | v.clear() | 清空所有元素 |
  | v.resize(n) | 修改大小为 n |
  | v.reserve(n) | 预留容量 |
  | v.capacity() | 返回当前容量 |
  | v.front() | 返回第一个元素 |
  | v.back() | 返回最后一个元素 |
  | v[i] | 访问第 i 个元素 |
  | v.at(i) | 安全访问，越界会报错 |
  | v.begin() | 首元素迭代器 |
  | v.end() | 尾后迭代器 |
  | v.insert(pos, x) | 在 pos 位置插入 |
  | v.erase(pos) | 删除指定位置元素 |
  | v.erase(l, r) | 删除区间 [l, r) |
  | v.swap(other) | 交换两个 vector |

  ## 示例

```cpp
  vector<int> v = {3, 1, 2};

  v.push_back(4);
  v.pop_back();

  sort(v.begin(), v.end());

  for(auto x : v)
  {
      cout << x << " ";
  }
```

  ## 复杂度

  | 操作 | 复杂度 |
  |---|---|
  | 随机访问 | O(1) |
  | 尾部插入 | 平均 O(1) |
  | 中间插入/删除 | O(n) |



  # deque

  deque 是双端队列，支持头尾快速插入删除，也支持随机访问。

  `deque<int> dq;`

  ## 常用成员函数

  | 函数 | 作用 |
  |---|---|
  | dq.push_back(x) | 尾部插入 |
  | dq.push_front(x) | 头部插入 |
  | dq.pop_back() | 删除尾部 |
  | dq.pop_front() | 删除头部 |
  | dq.front() | 返回队首 |
  | dq.back() | 返回队尾 |
  | dq[i] | 随机访问 |
  | dq.at(i) | 安全随机访问 |
  | dq.size() | 元素个数 |
  | dq.empty() | 是否为空 |
  | dq.clear() | 清空 |
  | dq.insert(pos, x) | 指定位置插入 |
  | dq.erase(pos) | 删除指定位置 |
  | dq.begin() / dq.end() | 迭代器 |

  ## 常见用途

```cpp
  deque<int> dq;

  dq.push_back(1);
  dq.push_front(2);

  cout << dq.front(); // 2
  cout << dq.back();  // 1
```

  常用于：

  | 场景 | 说明 |
  |---|---|
  | 滑动窗口 | 维护区间最大值/最小值 |
  | 单调队列 | 队列内元素保持单调 |
  | 双端操作 | 头尾都需要插入删除 |


  # stack

  stack 是栈，特点是 后进先出。

  stack<int> st;

  ## 常用成员函数

  | 函数 | 作用 |
  |---|---|
  | st.push(x) | 入栈 |
  | st.emplace(x) | 原地构造入栈 |
  | st.pop() | 出栈 |
  | st.top() | 返回栈顶 |
  | st.size() | 元素个数 |
  | st.empty() | 是否为空 |

  ## 示例

```cpp
  stack<int> st;

  st.push(1);
  st.push(2);

  cout << st.top(); // 2
  st.pop();
  cout << st.top(); // 1
```

  注意：stack 不能随机访问，也不能直接遍历。



  # queue

  queue 是队列，特点是 先进先出。

  `queue<int> q;`

  ## 常用成员函数

  | 函数 | 作用 |
  |---|---|
  | q.push(x) | 入队 |
  | q.emplace(x) | 原地构造入队 |
  | q.pop() | 出队 |
  | q.front() | 返回队首 |
  | q.back() | 返回队尾 |
  | q.size() | 元素个数 |
  | q.empty() | 是否为空 |

  ## 示例

```cpp
  queue<int> q;

  q.push(1);
  q.push(2);

  cout << q.front(); // 1
  q.pop();
  cout << q.front(); // 2
```

  常用于 BFS。

  ———

  # priority_queue

  priority_queue 是优先队列，默认是 大根堆。

  `priority_queue<int> pq;`

  ## 常用成员函数

  | 函数 | 作用 |
  |---|---|
  | pq.push(x) | 插入元素 |
  | pq.emplace(x) | 原地构造插入 |
  | pq.pop() | 删除堆顶 |
  | pq.top() | 返回堆顶 |
  | pq.size() | 元素个数 |
  | pq.empty() | 是否为空 |

  ## 大根堆

  `priority_queue<int> pq;`

  ## 小根堆

 ` priority_queue<int, vector<int>, greater<int>> pq;`

  ## 示例

```cpp
  priority_queue<int> pq;

  pq.push(3);
  pq.push(1);
  pq.push(5);

  cout << pq.top(); // 5
```

  常用于：

  | 场景 | 说明 |
  |---|---|
  | 贪心 | 每次取最大/最小 |
  | Dijkstra | 维护当前最短距离 |
  | Top K | 维护前 K 大/小 |


  # map

  map 是有序映射，存储键值对：

  key -> value

  默认按照 key 升序排列。

 ` map<int, int> mp;`

  ## 常用成员函数

  | 函数 | 作用 |
  |---|---|
  | mp[key] | 访问或创建 key 对应的值 |
  | mp.at(key) | 访问 key，不存在会报错 |
  | mp.insert({key, value}) | 插入键值对 |
  | mp.emplace(key, value) | 原地构造插入 |
  | mp.erase(key) | 删除指定 key |
  | mp.erase(it) | 删除迭代器位置 |
  | mp.find(key) | 查找 key |
  | mp.count(key) | 判断 key 是否存在 |
  | mp.lower_bound(key) | 第一个 >= key 的位置 |
  | mp.upper_bound(key) | 第一个 > key 的位置 |
  | mp.size() | 元素个数 |
  | mp.empty() | 是否为空 |
  | mp.clear() | 清空 |
  | mp.begin() / mp.end() | 迭代器 |

  ## 示例：统计次数

```cpp
  map<int, int> mp;

  mp[5]++;
  mp[3]++;
  mp[5]++;

  cout << mp[5]; // 2
```

  ## 遍历

```cpp
  for(auto x : mp)
  {
      cout << x.first << " " << x.second << endl;
  }
```

  | 写法 | 含义 |
  |---|---|
  | x.first | key |
  | x.second | value |

  复杂度：

  | 操作 | 复杂度 |
  |---|---|
  | 插入 | O(log n) |
  | 删除 | O(log n) |
  | 查找 | O(log n) |

  ———

  # unordered_map

  unordered_map 是无序映射，不会按照 key 排序，但平均速度更快。

  `unordered_map<int, int> mp;`

  ## 常用成员函数

  | 函数 | 作用 |
  |---|---|
  | mp[key] | 访问或创建 |
  | mp.insert({key, value}) | 插入 |
  | mp.emplace(key, value) | 原地插入 |
  | mp.erase(key) | 删除 |
  | mp.find(key) | 查找 |
  | mp.count(key) | 判断是否存在 |
  | mp.size() | 元素个数 |
  | mp.empty() | 是否为空 |
  | mp.clear() | 清空 |

  ## map 和 unordered_map 对比

  | 容器 | 是否有序 | 查找复杂度 | 底层结构 |
  |---|---|---|---|
  | map | 有序 | O(log n) | 红黑树 |
  | unordered_map | 无序 | 平均 O(1) | 哈希表 |

  ———

  # set

  set 是有序集合，自动去重。

  `set<int> s;`

  ## 常用成员函数

  | 函数 | 作用 |
  |---|---|
  | s.insert(x) | 插入元素 |
  | s.emplace(x) | 原地插入 |
  | s.erase(x) | 删除值为 x 的元素 |
  | s.erase(it) | 删除迭代器位置 |
  | s.find(x) | 查找元素 |
  | s.count(x) | 判断元素是否存在 |
  | s.lower_bound(x) | 第一个 >= x 的位置 |
  | s.upper_bound(x) | 第一个 > x 的位置 |
  | s.size() | 元素个数 |
  | s.empty() | 是否为空 |
  | s.clear() | 清空 |
  | s.begin() / s.end() | 迭代器 |

  ## 示例

```cpp
  set<int> s;

  s.insert(3);
  s.insert(1);
  s.insert(3);

  for(auto x : s)
  {
      cout << x << " ";
  }
```

  输出：

  `1 3`


  # 、multiset

  multiset 是有序集合，但允许重复元素。

  `multiset<int> s;`

  ## 常用函数

  | 函数 | 作用 |
  |---|---|
  | s.insert(x) | 插入 |
  | s.erase(x) | 删除所有值为 x 的元素 |
  | s.erase(it) | 删除某一个位置的元素 |
  | s.find(x) | 查找 |
  | s.count(x) | 统计出现次数 |
  | s.lower_bound(x) | 第一个 >= x 的位置 |
  | s.upper_bound(x) | 第一个 > x 的位置 |

  ## 删除一个元素

```cpp
  auto it = s.find(x);

  if(it != s.end())
  {
      s.erase(it);
  }
```

  注意：

  `s.erase(x);`

  会删除所有值为 x 的元素。


  # unordered_set

  unordered_set 是无序集合，自动去重，平均查找速度快。

  `unordered_set<int> s;`

  ## 常用成员函数

  | 函数 | 作用 |
  |---|---|
  | s.insert(x) | 插入 |
  | s.erase(x) | 删除 |
  | s.find(x) | 查找 |
  | s.count(x) | 判断是否存在 |
  | s.size() | 元素个数 |
  | s.empty() | 是否为空 |
  | s.clear() | 清空 |

  适合只需要快速判断某个元素是否出现过的场景。


  # string

  string 是字符串类，比字符数组更方便。

  `string s = "hello";`

  ## 常用成员函数

  | 函数 | 作用 |
  |---|---|
  | s.size() / s.length() | 字符串长度 |
  | s.empty() | 是否为空 |
  | s.clear() | 清空 |
  | s[i] | 访问字符 |
  | s.at(i) | 安全访问 |
  | s.front() | 第一个字符 |
  | s.back() | 最后一个字符 |
  | s.push_back(c) | 尾部添加字符 |
  | s.pop_back() | 删除最后一个字符 |
  | s += t | 拼接字符串 |
  | s.append(t) | 拼接字符串 |
  | s.insert(pos, t) | 插入字符串 |
  | s.erase(pos, len) | 删除子串 |
  | s.replace(pos, len, t) | 替换子串 |
  | s.substr(pos, len) | 截取子串 |
  | s.find(t) | 查找第一次出现位置 |
  | s.rfind(t) | 查找最后一次出现位置 |
  | s.c_str() | 转成 C 风格字符串 |

  ## 示例

```cpp
  string s = "abcdef";

  cout << s.substr(1, 3); // bcd

  if(s.find("cd") != string::npos)
  {
      cout << "found";
  }
```


  # pair

  pair 用来存储两个值。

  `pair<int, int> p = {1, 2};`

  ## 常用写法

```cpp
  cout << p.first;
  cout << p.second;
```

  ## 示例

```cpp
  vector<pair<int, int>> v;

  v.push_back({2, 3});
  v.push_back({1, 5});

  sort(v.begin(), v.end());
```

  pair 默认排序规则：

  | 优先级 | 规则 |
  |---|---|
  | 第一关键字 | 按 first 排序 |
  | 第二关键字 | first 相同，按 second 排序 |

  ———

  # bitset

  bitset 是固定长度的二进制位集合。

```cpp
  bitset<8> b;
  bitset<8> b(5);
```

  ## 常用成员函数

  | 函数 | 作用 |
  |---|---|
  | b.set() | 全部置为 1 |
  | b.set(pos) | 指定位置置为 1 |
  | b.reset() | 全部置为 0 |
  | b.reset(pos) | 指定位置置为 0 |
  | b.flip() | 全部取反 |
  | b.flip(pos) | 指定位置取反 |
  | b.count() | 统计 1 的个数 |
  | b.any() | 是否存在 1 |
  | b.none() | 是否全为 0 |
  | b.all() | 是否全为 1 |
  | b.test(pos) | 判断某位是否为 1 |
  | b.to_string() | 转字符串 |
  | b.to_ulong() | 转整数 |

  ## 示例

```cpp
  bitset<8> b(5);

  cout << b << endl;        // 00000101
  cout << b.count() << endl; // 2
```


  # 常用 algorithm 函数

  使用算法函数需要：

  `#include <algorithm>`

  如果使用：

  `#include <bits/stdc++.h>`

  则不需要额外包含。

  ## 常用函数表

  | 函数 | 作用 |
  |---|---|
  | sort(l, r) | 排序 |
  | stable_sort(l, r) | 稳定排序 |
  | reverse(l, r) | 翻转 |
  | unique(l, r) | 去除连续重复元素 |
  | lower_bound(l, r, x) | 第一个 >= x 的位置 |
  | upper_bound(l, r, x) | 第一个 > x 的位置 |
  | binary_search(l, r, x) | 判断是否存在 |
  | max(a, b) | 最大值 |
  | min(a, b) | 最小值 |
  | max_element(l, r) | 最大元素位置 |
  | min_element(l, r) | 最小元素位置 |
  | swap(a, b) | 交换 |
  | next_permutation(l, r) | 下一个排列 |
  | prev_permutation(l, r) | 上一个排列 |
  | count(l, r, x) | 统计出现次数 |
  | find(l, r, x) | 查找元素 |
  | fill(l, r, x) | 区间填充 |

  ## 示例

```cpp
  vector<int> v = {1, 2, 2, 3, 4};

  sort(v.begin(), v.end());

  int pos = lower_bound(v.begin(), v.end(), 3) - v.begin();

  v.erase(unique(v.begin(), v.end()), v.end());
```


  # numeric 常用函数

  需要头文件：

  `#include <numeric>`

  ## 常用函数

  | 函数 | 作用 |
  |---|---|
  | accumulate(l, r, init) | 区间求和 |
  | gcd(a, b) | 最大公约数 |
  | lcm(a, b) | 最小公倍数 |
  | iota(l, r, start) | 递增赋值 |

  ## 示例

```cpp
  vector<int> v = {1, 2, 3, 4};

  int sum = accumulate(v.begin(), v.end(), 0);

  cout << sum; // 10
```


  # 容器选择建议

  | 需求 | 推荐容器 |
  |---|---|
  | 动态数组 | vector |
  | 头尾插入删除 | deque |
  | 后进先出 | stack |
  | 先进先出 | queue |
  | 每次取最大值/最小值 | priority_queue |
  | 键值映射并保持有序 | map |
  | 快速键值映射 | unordered_map |
  | 去重并排序 | set |
  | 可重复并排序 | multiset |
  | 快速去重 | unordered_set |
  | 字符串处理 | string |
  | 二进制状态处理 | bitset |
  | 存两个相关数据 | pair |


  # 常见注意事项

  ## 1. map[key] 会自动创建元素

```cpp
  map<int, int> mp;

  cout << mp[100];
```

  如果 100 不存在，会自动创建：

  `mp[100] = 0;`

  如果只是判断是否存在，建议用：

```cpp
  if(mp.count(100))
  {
      cout << "exists";
  }
```


  ## 2. pop() 不会返回元素

  错误写法：

  `int x = q.pop(); // 错误`

  正确写法：

```cpp
  int x = q.front();
  q.pop();

  stack 同理：

  int x = st.top();
  st.pop();
```


  ## 3. unique 需要配合 erase

```cpp
  sort(v.begin(), v.end());

  v.erase(unique(v.begin(), v.end()), v.end());
```

  unique 只会把重复元素移到后面，不会真正删除。

  ## 4. lower_bound 和 upper_bound 要求有序

```cpp
  sort(v.begin(), v.end());

  auto it = lower_bound(v.begin(), v.end(), x);
```

  如果数组没有排序，二分结果没有意义。


  # 总结

  STL 可以大幅减少手写数据结构的时间。

  | 类型 | 推荐掌握程度 |
  |---|---|
  | vector | 必须熟练 |
  | queue / stack | 必须熟练 |
  | map / set | 必须熟练 |
  | priority_queue | 必须熟练 |
  | unordered_map / unordered_set | 建议熟练 |
  | deque / bitset | 常见题型需要掌握 |
  | algorithm 常用函数 | 必须熟练 |