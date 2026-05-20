---
title: 'C++ 常用 STL 容器整理'
date: '2026-05-20T19:47:54+08:00'
updated: '2026-05-20T19:50:20+08:00'
abbrlink: ''
---
# C++ 常用 STL 容器整理

## 1\. vector

vector 是动态数组，支持随机访问，尾部插入删除效率高。

vector

常用成员函数：

v.push\_back(x)

尾部插入

v.emplace\_back(x)

尾部原地构造

v.pop\_back()

删除尾部元素

v.size()

元素个数

v.empty()

判断是否为空

v.clear()

清空

v.resize(n)

改变大小

v.reserve(n)

预留容量

v.capacity()

当前容量

v.front()

第一个元素

v.back()

最后一个元素

v\[i\]

访问第 i 个元素

v.at(i)

访问第 i 个元素，越界会报错

v.begin()

首元素迭代器

v.end()

尾后迭代器

v.insert(pos, x)

在指定位置插入

v.erase(pos)

删除指定位置

v.erase(l, r)

删除区间 \[l, r)

v.swap(other)

交换两个 vector

例子：

vector

v.push\_back(4); v.pop\_back();

v.insert(v.begin() + 1, 10); v.erase(v.begin());

sort(v.begin(), v.end());

复杂度：

随机访问

O(1)

尾部插入

平均 O(1)

中间插入/删除

O(n)

———

## 2\. deque

deque 是双端队列，支持头尾高效插入删除，也支持随机访问。

deque

常用成员函数：

dq.push\_back(x)

尾部插入

dq.push\_front(x)

头部插入

dq.pop\_back()

删除尾部

dq.pop\_front()

删除头部

dq.front()

队首元素

dq.back()

队尾元素

dq\[i\]

随机访问

dq.at(i)

安全随机访问

dq.size()

元素个数

dq.empty()

是否为空

dq.clear()

清空

dq.insert(pos, x)

指定位置插入

dq.erase(pos)

删除指定位置

dq.begin() / dq.end()

迭代器

常用于单调队列、滑动窗口。

———

## 3\. stack

stack 是栈，后进先出，LIFO。

stack

常用成员函数：

st.push(x)

入栈

st.emplace(x)

原地构造入栈

st.pop()

出栈

st.top()

栈顶元素

st.size()

元素个数

st.empty()

是否为空

注意：stack 不能遍历，也不能随机访问。

———

## 4\. queue

queue 是队列，先进先出，FIFO。

queue

常用成员函数：

q.push(x)

入队

q.emplace(x)

原地构造入队

q.pop()

出队

q.front()

队首元素

q.back()

队尾元素

q.size()

元素个数

q.empty()

是否为空

常用于 BFS。

———

## 5\. priority\_queue

priority\_queue 是优先队列，默认是大根堆。

priority\_queue

常用成员函数：

pq.push(x)

插入

pq.emplace(x)

原地构造插入

pq.pop()

删除堆顶

pq.top()

访问堆顶

pq.size()

元素个数

pq.empty()

是否为空

大根堆：

priority\_queue

小根堆：

priority\_queue<int, vector

常用于贪心、Dijkstra、Top K。

———

## 6\. map

map 是有序映射，存储键值对，按照 key 自动升序排序。

map<int, int> mp;

常用成员函数：

mp\[key\]

访问或创建 key 对应的 value

mp.at(key)

访问 key，对不存在的 key 会报错

mp.insert({key, value})

插入键值对

mp.emplace(key, value)

原地构造插入

mp.erase(key)

删除指定 key

mp.erase(it)

删除迭代器位置

mp.find(key)

查找 key

mp.count(key)

判断 key 是否存在

mp.lower\_bound(key)

第一个 >= key 的位置

mp.upper\_bound(key)

第一个 > key 的位置

mp.size()

元素个数

mp.empty()

是否为空

mp.clear()

清空

mp.begin() / mp.end()

迭代器

例子：

map<int, int> mp;

mp\[5\]++; mp\[3\] = 10;

if(mp.count(5)) { cout << mp\[5\]; }

for(auto x : mp) { cout << x.first << " " << x.second << endl; }

复杂度：插入、删除、查找都是 O(log n)。

———

## 7\. unordered\_map

unordered\_map 是无序映射，不排序，平均查找速度更快。

unordered\_map<int, int> mp;

常用成员函数基本和 map 类似：

mp\[key\]

访问或创建

mp.insert({key, value})

插入

mp.emplace(key, value)

原地插入

mp.erase(key)

删除

mp.find(key)

查找

mp.count(key)

判断是否存在

mp.size()

元素个数

mp.empty()

是否为空

mp.clear()

清空

区别：

map

有序

O(log n)

unordered\_map

无序

平均 O(1)，最坏 O(n)

———

## 8\. set

set 是有序集合，自动去重，默认升序。

set

常用成员函数：

s.insert(x)

插入

s.emplace(x)

原地插入

s.erase(x)

删除值为 x 的元素

s.erase(it)

删除迭代器位置

s.find(x)

查找

s.count(x)

判断是否存在

s.lower\_bound(x)

第一个 >= x 的位置

s.upper\_bound(x)

第一个 > x 的位置

s.size()

元素个数

s.empty()

是否为空

s.clear()

清空

s.begin() / s.end()

迭代器

例子：

set

s.insert(3); s.insert(1); s.insert(3);

for(auto x : s) { cout << x << " "; }

输出：

1 3

———

## 9\. multiset

multiset 是允许重复元素的有序集合。

multiset

常用函数和 set 基本一样：

s.insert(x); s.erase(x); s.find(x); s.count(x); s.lower\_bound(x); s.upper\_bound(x);

注意：

s.erase(x);

会删除所有值为 x 的元素。

如果只想删除一个：

auto it = s.find(x); if(it != s.end()) { s.erase(it); }

———

## 10\. unordered\_set

unordered\_set 是无序集合，自动去重，不排序。

unordered\_set

常用成员函数：

s.insert(x)

插入

s.erase(x)

删除

s.find(x)

查找

s.count(x)

判断是否存在

s.size()

元素个数

s.empty()

是否为空

s.clear()

清空

平均复杂度 O(1)。

———

## 11\. pair

pair 用来存两个值。

pair<int, int> p = {1, 2};

常用访问：

p.first; p.second;

例子：

vector<pair<int, int>> v;

v.push\_back({2, 3}); v.push\_back({1, 5});

sort(v.begin(), v.end());

pair 默认排序规则：先按 first 排，first 相同再按 second 排。

———

## 12\. string

string 是字符串类。

string s = "hello";

常用成员函数：

s.size() / s.length()

字符串长度

s.empty()

是否为空

s.clear()

清空

s\[i\]

访问字符

s.at(i)

安全访问

s.front()

第一个字符

s.back()

最后一个字符

s.push\_back(c)

尾部加字符

s.pop\_back()

删除尾部字符

s += t

拼接字符串

s.append(t)

拼接字符串

s.insert(pos, t)

插入字符串

s.erase(pos, len)

删除子串

s.replace(pos, len, t)

替换子串

s.substr(pos, len)

截取子串

s.find(t)

查找第一次出现位置

s.rfind(t)

查找最后一次出现位置

s.c\_str()

转成 C 风格字符串

例子：

string s = "abcdef";

cout << s.substr(1, 3); // bcd

if(s.find("cd") != string::npos) { cout << "found"; }

———

## 13\. bitset

bitset 是固定长度的二进制位集合。

bitset<8> b;

常用成员函数：

b.set()

全部置为 1

b.set(pos)

指定位置置为 1

b.reset()

全部置为 0

b.reset(pos)

指定位置置为 0

b.flip()

全部取反

b.flip(pos)

指定位置取反

b.count()

统计 1 的个数

b.any()

是否存在 1

b.none()

是否全是 0

b.all()

是否全是 1

b.test(pos)

判断某位是否为 1

b.to\_string()

转字符串

b.to\_ulong()

转整数

例子：

bitset<8> b(5);

cout << b; // 00000101 cout << b.count(); // 2

———

## 14\. list

list 是双向链表，适合频繁在中间插入删除。

list

常用成员函数：

l.push\_back(x)

尾部插入

l.push\_front(x)

头部插入

l.pop\_back()

删除尾部

l.pop\_front()

删除头部

l.insert(pos, x)

指定位置插入

l.erase(pos)

删除指定位置

l.remove(x)

删除所有值为 x 的元素

l.sort()

排序

l.reverse()

翻转

l.unique()

删除连续重复元素

l.merge(other)

合并有序链表

l.size()

元素个数

l.empty()

是否为空

l.clear()

清空

注意：list 不支持 l\[i\] 随机访问。

———

## 15\. 常用 algorithm 函数

#include

常用函数：

sort(l, r)

排序

stable\_sort(l, r)

稳定排序

reverse(l, r)

翻转

unique(l, r)

去除连续重复元素

lower\_bound(l, r, x)

第一个 >= x 的位置

upper\_bound(l, r, x)

第一个 > x 的位置

binary\_search(l, r, x)

二分查找

max(a, b)

最大值

min(a, b)

最小值

max\_element(l, r)

最大元素位置

min\_element(l, r)

最小元素位置

swap(a, b)

交换

next\_permutation(l, r)

下一个排列

prev\_permutation(l, r)

上一个排列

count(l, r, x)

统计 x 出现次数

find(l, r, x)

查找 x

fill(l, r, x)

区间填充

accumulate(l, r, init)

求和，需要

例子：

vector

sort(v.begin(), v.end());

int pos = lower\_bound(v.begin(), v.end(), 3) - v.begin();

v.erase(unique(v.begin(), v.end()), v.end());

———

## 常用选择表

动态数组

vector

头尾插入删除

deque

后进先出

stack

先进先出

queue

自动取最大/最小

priority\_queue

有序映射

map

快速映射

unordered\_map

有序去重

set

有序可重复

multiset

快速去重

unordered\_set

字符串处理

string

二进制位处理

bitset

存两个值

pair

频繁中间插入删除

list